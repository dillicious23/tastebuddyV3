import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

admin.initializeApp();

// ── Yelp API key stored in Google Secret Manager ──────────────────────────
const yelpApiKey = defineSecret("YELP_API_KEY");

export const yelpSearch = onCall(
    { secrets: [yelpApiKey] },
    async (request) => {
        const {
            latitude,
            longitude,
            location,
            radiusMeters,
            categories,
            openNow,
            price,
        } = request.data as {
            latitude?: number;
            longitude?: number;
            location?: string;
            radiusMeters: number;
            categories: string;
            openNow: boolean;
            price: string;
        };

        const key = yelpApiKey.value();

        let url = `https://api.yelp.com/v3/businesses/search?radius=${radiusMeters}&limit=50&sort_by=distance`;

        if (categories) url += `&categories=${encodeURIComponent(categories)}`;
        if (openNow) url += `&open_now=true`;
        if (price) url += `&price=${price}`;
        if (location) {
            url += `&location=${encodeURIComponent(location)}`;
        } else if (latitude != null && longitude != null) {
            url += `&latitude=${latitude}&longitude=${longitude}`;
        } else {
            throw new HttpsError("invalid-argument", "No location provided");
        }

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${key}`,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            const body = await response.text();
            console.error("Yelp API error:", response.status, body);
            throw new HttpsError("internal", `Yelp API returned ${response.status}`);
        }

        return response.json();
    }
);

// ── Push notification on invite ───────────────────────────────────────────
export const sendRoomInvite = onDocumentCreated(
    "invites/{inviteId}",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (event: any) => {
        const invite = event.data?.data();
        if (!invite) return;

        const docPath = `users/${invite.toUid}`;
        const userDoc = await admin.firestore().doc(docPath).get();

        if (!userDoc.exists) {
            console.log("User not found!");
            return;
        }

        const fcmToken = userDoc.data()?.fcmToken;

        const message = {
            token: fcmToken,
            notification: {
                title: "New Tastebuddy Invite! 🍔",
                body: `${invite.fromUsername} invited you to join a room!`,
            },
            data: {
                roomCode: invite.roomCode,
            },
        };

        await admin.messaging().send(message);
        console.log(`Successfully sent invite to ${invite.toUid}`);
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS HARVESTER
//
// Rooms are deleted after 24 hours via Firestore TTL, so raw rooms cannot be
// queried historically. These two functions save the stats we care about into
// a permanent analytics/ collection before rooms disappear.
//
// Data written to Firestore:
//   analytics/totals               running counters for everything
//   analytics/sessions/records/{id} one doc per completed session
//   analytics/daily/days/{YYYY-MM-DD} daily rollup
//   analytics/locations/points/{id}  lat/lng origin per session
//   analytics/cities/counts/{city}   per-city session counts
//   analytics/cuisines/counts/{name} per-cuisine swipe counts
// ─────────────────────────────────────────────────────────────────────────────

interface DbMember {
    username: string;
    colorIndex: number;
    joinedAt: number;
    avatar?: string;
}

interface DbMatch {
    restaurantId: string;
    agreedCount: number;
    totalCount: number;
    isFull: boolean;
}

interface DbRestaurant {
    id: string;
    name: string;
    cuisine?: string;
    lat?: number;
    lng?: number;
    address?: string;
    price?: string;
    rating?: number | string;
    emoji?: string;
}

interface DbRoom {
    hostId: string;
    status: "waiting" | "swiping" | "ended";
    createdAt: number;
    members: { [uid: string]: DbMember };
    matches: { [restaurantId: string]: DbMatch };
    restaurants: { [id: string]: DbRestaurant };
    swipes?: { [uid: string]: { [rId: string]: string } };
}

// Free reverse geocoding via Nominatim (no API key needed)
async function getCityFromCoords(lat: number, lng: number): Promise<string> {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
        const res = await fetch(url, {
            headers: { "User-Agent": "TastebuddyAnalytics/1.0" },
        });
        if (!res.ok) return "Unknown";
        const data = (await res.json()) as { address?: Record<string, string> };
        const addr = data.address || {};
        return addr.city || addr.town || addr.village || addr.county || "Unknown";
    } catch {
        return "Unknown";
    }
}

async function harvestRoom(
    roomId: string,
    room: DbRoom,
    db: admin.firestore.Firestore
): Promise<void> {
    // Skip if this room was already harvested
    const existing = await db
        .collection("analytics")
        .doc("sessions")
        .collection("records")
        .doc(roomId)
        .get();
    if (existing.exists) return;

    const memberCount = Object.keys(room.members || {}).length;
    const matchList = Object.values(room.matches || {});
    const fullMatches = matchList.filter((m) => m.isFull);
    const isSolo = memberCount <= 1;
    const createdAt = room.createdAt || Date.now();
    const dateKey = new Date(createdAt).toISOString().slice(0, 10);
    const dow = new Date(createdAt).getDay();   // 0=Sun
    const hour = new Date(createdAt).getHours();

    // Swipe totals
    let totalSwipes = 0;
    let yesSwipes = 0;
    let noSwipes = 0;
    for (const userSwipes of Object.values(room.swipes || {})) {
        for (const dir of Object.values(userSwipes)) {
            totalSwipes++;
            if (dir === "yes") yesSwipes++; else noSwipes++;
        }
    }

    // Location from first restaurant in the deck
    const restaurants = Object.values(room.restaurants || {});
    let lat: number | null = null;
    let lng: number | null = null;
    let city = "Unknown";

    if (restaurants.length > 0 && restaurants[0].lat && restaurants[0].lng) {
        lat = restaurants[0].lat;
        lng = restaurants[0].lng;
        city = await getCityFromCoords(lat, lng);
    }

    // Cuisine breakdown across all restaurants shown
    const offeredCuisines: { [name: string]: number } = {};
    for (const rest of restaurants) {
        const c = (rest.cuisine || "Other").split(",")[0].trim();
        offeredCuisines[c] = (offeredCuisines[c] || 0) + 1;
    }

    // Full details for every matched restaurant
    const matchedCuisines: string[] = [];
    const matchedRestaurants: Array<{
        name: string; cuisine: string; price: string;
        rating: string | number; emoji: string;
        address: string; yelpUrl: string;
        agreedCount: number; totalCount: number;
    }> = [];
    for (const match of fullMatches) {
        const rest = (room.restaurants || {})[match.restaurantId];
        if (!rest) continue;
        const cuisine = (rest.cuisine || "Other").split(",")[0].trim();
        matchedCuisines.push(cuisine);
        matchedRestaurants.push({
            name: rest.name || "Unknown",
            cuisine,
            price: rest.price || "",
            rating: rest.rating || "",
            emoji: rest.emoji || "🍽️",
            address: rest.address || "",
            yelpUrl: (rest as any).yelpUrl || "",
            agreedCount: match.agreedCount,
            totalCount: match.totalCount,
        });
    }
    const matchedPrice = matchedRestaurants[0]?.price || "";

    const batch = db.batch();

    // 1. Permanent session record
    batch.set(
        db.collection("analytics").doc("sessions").collection("records").doc(roomId),
        {
            roomId,
            createdAt,
            dateKey,
            status: room.status,
            memberCount,
            isSolo,
            matchCount: fullMatches.length,
            hasMatch: fullMatches.length > 0,
            totalSwipes,
            yesSwipes,
            noSwipes,
            lat,
            lng,
            city,
            matchedCuisines,
            matchedRestaurants,
            offeredCuisines,
            matchedPrice,
            dow,
            hour,
            harvestedAt: Date.now(),
        }
    );

    // 2. Daily rollup
    batch.set(
        db.collection("analytics").doc("daily").collection("days").doc(dateKey),
        {
            date: dateKey,
            sessions: admin.firestore.FieldValue.increment(1),
            soloSessions: admin.firestore.FieldValue.increment(isSolo ? 1 : 0),
            groupSessions: admin.firestore.FieldValue.increment(isSolo ? 0 : 1),
            matches: admin.firestore.FieldValue.increment(fullMatches.length),
            swipes: admin.firestore.FieldValue.increment(totalSwipes),
        },
        { merge: true }
    );

    // 3. Location point
    if (lat && lng) {
        batch.set(
            db.collection("analytics").doc("locations").collection("points").doc(roomId),
            { lat, lng, city, createdAt, memberCount }
        );

        // Per-city counter
        const cityKey = city.replace(/[^a-zA-Z0-9]/g, "_");
        batch.set(
            db.collection("analytics").doc("cities").collection("counts").doc(cityKey),
            {
                city,
                count: admin.firestore.FieldValue.increment(1),
                lastSeen: createdAt,
            },
            { merge: true }
        );
    }

    // 4. Cuisine counters
    for (const [cuisineName, offeredCount] of Object.entries(offeredCuisines)) {
        const safeKey = cuisineName.replace(/[^a-zA-Z0-9]/g, "_");
        batch.set(
            db.collection("analytics").doc("cuisines").collection("counts").doc(safeKey),
            {
                name: cuisineName,
                offered: admin.firestore.FieldValue.increment(offeredCount),
                matched: admin.firestore.FieldValue.increment(
                    matchedCuisines.filter((c) => c === cuisineName).length
                ),
            },
            { merge: true }
        );
    }

    // 5. Global running totals
    batch.set(
        db.collection("analytics").doc("totals"),
        {
            totalSessions: admin.firestore.FieldValue.increment(1),
            totalMatches: admin.firestore.FieldValue.increment(fullMatches.length),
            totalSwipes: admin.firestore.FieldValue.increment(totalSwipes),
            totalSoloSessions: admin.firestore.FieldValue.increment(isSolo ? 1 : 0),
            totalGroupSessions: admin.firestore.FieldValue.increment(isSolo ? 0 : 1),
            lastUpdated: Date.now(),
        },
        { merge: true }
    );

    await batch.commit();
    logger.info(`Harvested ${roomId} — ${city}, ${memberCount} members, ${fullMatches.length} matches`);
}

// Trigger: fires the moment a room's status flips to "ended"
export const harvestOnRoomEnd = onDocumentUpdated(
    "rooms/{roomId}",
    async (event) => {
        const after = event.data?.after?.data() as DbRoom | undefined;
        const before = event.data?.before?.data() as DbRoom | undefined;
        if (!after || after.status !== "ended" || before?.status === "ended") return;

        logger.info(`Room ${event.params.roomId} ended — harvesting`);
        try {
            await harvestRoom(event.params.roomId, after, admin.firestore());
        } catch (err) {
            logger.error(`Harvest failed for ${event.params.roomId}`, err);
        }
    }
);

// Trigger: sweeps rooms older than 20 hours every 6 hours
// Catches sessions that expired without the host pressing End
export const harvestScheduled = onSchedule("every 6 hours", async () => {
    logger.info("Scheduled harvest sweep running");
    const db = admin.firestore();
    const cutoff = Date.now() - 20 * 60 * 60 * 1000;
    const snap = await db.collection("rooms").where("createdAt", "<", cutoff).get();
    logger.info(`Sweeping ${snap.size} rooms older than 20h`);
    for (const docSnap of snap.docs) {
        try {
            await harvestRoom(docSnap.id, docSnap.data() as DbRoom, db);
        } catch (err) {
            logger.error(`Sweep failed for ${docSnap.id}`, err);
        }
    }
});
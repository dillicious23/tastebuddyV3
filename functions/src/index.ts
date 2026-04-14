import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

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

        // Build Yelp URL server-side
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

        // 1. Look up the invited user's FCM token
        const docPath = `users/${invite.toUid}`;
        const userDoc = await admin.firestore().doc(docPath).get();

        if (!userDoc.exists) {
            console.log("User not found!");
            return;
        }

        const fcmToken = userDoc.data()?.fcmToken;

        // 2. Build the exact notification payload
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

        // 3. Send it!
        await admin.messaging().send(message);
        console.log(`Successfully sent invite to ${invite.toUid}`);
    },
);
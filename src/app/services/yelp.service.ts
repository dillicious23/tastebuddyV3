import { Injectable, inject } from '@angular/core';
import { Restaurant } from '../models/restaurant.model';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, fns } from '../core/firebase';

@Injectable({ providedIn: 'root' })
export class YelpService {

    private getVisuals(categories: any[]) {
        const cats = categories.map((c: any) => c.alias.toLowerCase()).join(' ');

        if (cats.includes('pizza')) return { emoji: '🍕', color: '#EF4444', bg: 'linear-gradient(135deg, #EF4444, #7F1D1D)' };
        if (cats.includes('mexican') || cats.includes('tacos')) return { emoji: '🌮', color: '#F59E0B', bg: 'linear-gradient(135deg, #F59E0B, #78350F)' };
        if (cats.includes('sushi') || cats.includes('japanese')) return { emoji: '🍣', color: '#EC4899', bg: 'linear-gradient(135deg, #EC4899, #831843)' };
        if (cats.includes('burger')) return { emoji: '🍔', color: '#EAB308', bg: 'linear-gradient(135deg, #EAB308, #713F12)' };
        if (cats.includes('coffee') || cats.includes('cafe')) return { emoji: '☕', color: '#8B5CF6', bg: 'linear-gradient(135deg, #8B5CF6, #4C1D95)' };
        if (cats.includes('chinese') || cats.includes('asian')) return { emoji: '🥡', color: '#10B981', bg: 'linear-gradient(135deg, #10B981, #064E3B)' };
        if (cats.includes('italian')) return { emoji: '🍝', color: '#F43F5E', bg: 'linear-gradient(135deg, #F43F5E, #881337)' };
        if (cats.includes('thai')) return { emoji: '🍲', color: '#D946EF', bg: 'linear-gradient(135deg, #D946EF, #701A75)' };
        if (cats.includes('seafood')) return { emoji: '🦐', color: '#3B82F6', bg: 'linear-gradient(135deg, #3B82F6, #1E3A8A)' };
        if (cats.includes('dessert') || cats.includes('icecream') || cats.includes('bakeries')) return { emoji: '🍩', color: '#F472B6', bg: 'linear-gradient(135deg, #F472B6, #831843)' };
        if (cats.includes('chicken') || cats.includes('wings')) return { emoji: '🍗', color: '#F97316', bg: 'linear-gradient(135deg, #F97316, #7C2D12)' };

        return { emoji: '🍽️', color: '#64748B', bg: 'linear-gradient(135deg, #64748B, #0F172A)' };
    }

    private getExactDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371000; // Radius of the Earth in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    private customImages: { [key: string]: string } | null = null;

    private async loadCustomImages() {
        if (this.customImages) return;

        try {
            const snap = await getDoc(doc(db, 'config', 'images'));
            if (snap.exists()) {
                this.customImages = snap.data();
            } else {
                this.customImages = {};
            }
        } catch (e) {
            console.error('Could not load custom images from Firestore', e);
            this.customImages = {};
        }
    }

    async getRestaurants(
        lat: number | null,
        lng: number | null,
        radiusMiles: number,
        cuisines?: string | string[],
        openNow: boolean = false,
        price: string[] = ['1', '2', '3', '4'],
        location?: string
    ): Promise<Restaurant[]> {
        const radiusMeters = Math.min(Math.floor(radiusMiles * 1609.34), 40000);

        let catQuery = '';
        if (cuisines && cuisines.length > 0 && !cuisines.includes('all')) {
            catQuery = Array.isArray(cuisines) ? cuisines.join(',') : cuisines;
        }

        if (!location && (lat === null || lng === null)) {
            console.error('🚨 LOCATION BLOCKED: No GPS coordinates or city provided!');
            return [];
        }

        try {

            const searchFn = httpsCallable(fns, 'yelpSearch');

            const requestData = {
                latitude: lat,
                longitude: lng,
                location: location,
                radiusMeters: radiusMeters,
                categories: catQuery || 'restaurants',
                openNow: openNow,
                price: (price && price.length > 0) ? price.join(',') : undefined
            };

            const result = await searchFn(requestData);
            const responseData = result.data as any;

            if (!responseData || !responseData.businesses) {
                console.error('3. 🚨 Yelp rejected the request. Body:', responseData);
                return [];
            }

            const strictBusinesses = responseData.businesses.filter((b: any) => {
                if (!b.coordinates?.latitude || !b.coordinates?.longitude) return false;
                if (!b.rating || b.rating < 2.5) return false;

                // 💥 NEW: The Gas Station Blocklist
                if (b.categories) {
                    const isGasStation = b.categories.some((c: any) =>
                        c.alias.includes('servicestation') ||
                        c.alias.includes('convenience') ||
                        c.title.toLowerCase().includes('gas station') ||
                        c.title.toLowerCase().includes('convenience')
                    );

                    // If it's a gas station, throw it out immediately!
                    if (isGasStation) return false;
                }

                if (lat === null || lng === null) return true;

                const exactMeters = this.getExactDistance(lat, lng, b.coordinates.latitude, b.coordinates.longitude);
                return exactMeters <= radiusMeters;
            });

            await this.loadCustomImages();

            return strictBusinesses.map((b: any) => {
                const hasReservations = b.transactions && b.transactions.includes('restaurant_reservation');
                const visuals = this.getVisuals(b.categories || []);

                let finalImageUrl = b.image_url;

                if (this.customImages) {
                    const normalizedYelpName = b.name.toLowerCase().replace(/['\s-]/g, '');

                    for (const [triggerWord, customUrl] of Object.entries(this.customImages)) {
                        const normalizedTrigger = triggerWord.toLowerCase().replace(/['\s-]/g, '');

                        // 💥 FIX: Guard against accidental blank fields in your Firestore database!
                        if (normalizedTrigger.length > 2 && normalizedYelpName.includes(normalizedTrigger)) {
                            finalImageUrl = customUrl;
                            break;
                        }
                    }
                }

                return {
                    id: b.id,
                    name: b.name,
                    cuisine: b.categories && b.categories.length > 0
                        ? b.categories.map((c: any) => c.title).join(', ')
                        : 'Food',
                    dist: (b.distance / 1609.34).toFixed(1) + ' mi',
                    price: b.price || '$$',
                    rating: b.rating,
                    imageUrl: finalImageUrl,
                    address: b.location?.display_address ? b.location.display_address.join(', ') : '',
                    lat: b.coordinates.latitude,
                    lng: b.coordinates.longitude,
                    yelpUrl: b.url,
                    isOpenNow: !b.is_closed,
                    takesReservations: hasReservations,
                    emoji: visuals.emoji,
                    color: visuals.color,
                    bg: visuals.bg
                };
            });

        } catch (error: any) {
            console.error('🚨 Proxy Firebase Function Error details:', error);
            return [];
        }
    }
}

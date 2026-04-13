import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Restaurant } from '../models/restaurant.model';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class YelpService {
    private http = inject(HttpClient);

    // Your actual Yelp API Key
    private apiKey = 'BcGuIBO_29gP4DdK-1IHudB0S9CRw3WZUtwfxXCaMBOkGePM706cRTrUZVx6NWH-45LRox0LPhr1wb-e2SJOx2QjP4_2Id29SOmtlGaTsKxwnrxrpci9drKjCQ1pZXYx';

    get baseUrl(): string {
        const yelpDirectUrl = 'https://api.yelp.com/v3/businesses/search';

        // If we are on a real iOS or Android device, talk to Yelp directly!
        if (Capacitor.isNativePlatform()) {
            return yelpDirectUrl;
        }

        // If we are testing on localhost in the browser, use the proxy
        return `https://cors-anywhere.herokuapp.com/${yelpDirectUrl}`;
    }

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

        let url = `${this.baseUrl}?radius=${radiusMeters}&limit=50&sort_by=distance`;

        if (catQuery) {
            url += `&categories=${encodeURIComponent(catQuery)}`;
        } else {
            url += `&categories=restaurants`; // Fallback so we don't get dentists
        }

        if (openNow) {
            url += `&open_now=true`;
        }

        if (price && price.length > 0) {
            url += `&price=${price.join(',')}`;
        }

        if (location) {
            url += `&location=${encodeURIComponent(location)}`;
        } else {
            url += `&latitude=${lat}&longitude=${lng}`;
        }

        try {
            let responseData: any;

            // Completely bypass Angular HttpClient on native devices
            if (Capacitor.isNativePlatform()) {
                const options = {
                    url: url,
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Accept': 'application/json'
                    }
                };
                const nativeResponse = await CapacitorHttp.get(options);
                responseData = nativeResponse.data;
            } else {
                // Use Angular HttpClient for the local proxy
                const headers = new HttpHeaders({
                    Authorization: `Bearer ${this.apiKey}`,
                    accept: 'application/json'
                });
                responseData = await firstValueFrom(this.http.get(url, { headers }));
            }

            // The Safety Net: Prevent the silent crash if Yelp rejects the request
            if (!responseData || !responseData.businesses) {
                console.error('Yelp rejected the request:', responseData);
                return [];
            }

            const strictBusinesses = responseData.businesses.filter((b: any) => {
                if (!b.coordinates?.latitude || !b.coordinates?.longitude) return false;
                if (!b.rating || b.rating < 2.5) return false;
                if (lat === null || lng === null) return true;

                const exactMeters = this.getExactDistance(lat, lng, b.coordinates.latitude, b.coordinates.longitude);
                return exactMeters <= radiusMeters;
            });

            return strictBusinesses.map((b: any) => {
                const hasReservations = b.transactions && b.transactions.includes('restaurant_reservation');
                const visuals = this.getVisuals(b.categories || []);

                return {
                    id: b.id,
                    name: b.name,
                    cuisine: b.categories && b.categories.length > 0
                        ? b.categories.map((c: any) => c.title).join(', ')
                        : 'Food',
                    dist: (b.distance / 1609.34).toFixed(1) + ' mi',
                    price: b.price || '$$',
                    rating: b.rating,
                    imageUrl: b.image_url,
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

        } catch (error) {
            console.error('Network or Proxy Error:', error);
            return []; // Graceful failure so the app doesn't crash
        }
    }
}
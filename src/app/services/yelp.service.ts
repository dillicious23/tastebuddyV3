import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Restaurant } from '../models/restaurant.model';

@Injectable({ providedIn: 'root' })
export class YelpService {
    private http = inject(HttpClient);

    private baseUrl = 'https://cors-anywhere.herokuapp.com/https://api.yelp.com/v3/businesses/search';
    private apiKey = 'BcGuIBO_29gP4DdK-1IHudB0S9CRw3WZUtwfxXCaMBOkGePM706cRTrUZVx6NWH-45LRox0LPhr1wb-e2SJOx2QjP4_2Id29SOmtlGaTsKxwnrxrpci9drKjCQ1pZXYx';

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
        if (cats.includes('indpak') || cats.includes('indian')) return { emoji: '🍛', color: '#F59E0B', bg: 'linear-gradient(135deg, #F59E0B, #92400E)' };
        if (cats.includes('salad') || cats.includes('vegan') || cats.includes('vegetarian')) return { emoji: '🥗', color: '#22C55E', bg: 'linear-gradient(135deg, #22C55E, #14532D)' };
        return { emoji: '🍽️', color: '#64748B', bg: 'linear-gradient(135deg, #64748B, #0F172A)' };
    }

    // ✅ Added categories param — empty string means no filter (all cuisines)
    async getRestaurants(lat: number, lng: number, radiusMiles: number, categories: string = ''): Promise<Restaurant[]> {
        const headers = new HttpHeaders({
            Authorization: `Bearer ${this.apiKey}`,
            accept: 'application/json'
        });

        const radiusMeters = Math.min(Math.floor(radiusMiles * 1609.34), 40000);

        let url = `${this.baseUrl}?latitude=${lat}&longitude=${lng}&radius=${radiusMeters}&limit=20&term=restaurants`;

        // ✅ Only add categories if user picked specific ones
        if (categories) {
            url += `&categories=${categories}`;
        }

        const response: any = await firstValueFrom(this.http.get(url, { headers }));

        return response.businesses.map((b: any) => {
            const hasReservations = b.transactions && b.transactions.includes('restaurant_reservation');
            const visuals = this.getVisuals(b.categories || []);
            return {
                id: b.id,
                name: b.name,
                cuisine: b.categories?.length > 0 ? b.categories[0].title : 'Food',
                dist: (b.distance / 1609.34).toFixed(1) + ' mi',
                price: b.price || '$$',
                rating: b.rating,
                imageUrl: b.image_url,
                lat: b.coordinates?.latitude,
                lng: b.coordinates?.longitude,
                yelpUrl: b.url,
                isOpenNow: !b.is_closed,
                takesReservations: hasReservations,
                emoji: visuals.emoji,
                color: visuals.color,
                bg: visuals.bg,
                label: '',
                score: '',
                friends: [],
            };
        });
    }
}
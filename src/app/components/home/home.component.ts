// src/app/components/home/home.component.ts
import { Component, inject, signal, computed, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { ForkupGroup, GroupMember } from '../../models/restaurant.model';
import { generateRoomCode } from '../../data/mock-data';
import { GoogleMapsModule, MapMarker, MapCircle } from '@angular/google-maps';
import { YelpService } from '../../services/yelp.service';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { FormsModule } from '@angular/forms';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, IonicModule, GoogleMapsModule, MapMarker, MapCircle, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private router = inject(Router);
  readonly state = inject(AppStateService);

  @Output() start = new EventEmitter<any[]>(); // <-- Update to emit the array

  private yelp = inject(YelpService);

  // UI state
  showEndDialog = signal(false);
  showSwipeAgainSheet = signal(false);
  creating = signal(false);
  selectedGroup = signal<ForkupGroup | null>(null);
  newRoomCode = signal('');
  mapPulse = signal(0);
  private _rafId = 0;
  loadingLocation = signal(true);

  get myAvatar(): string {
    return localStorage.getItem('userAvatar') || '🦦';
  }

  constructor() {
    this._animatePulse();
  }

  userLocation: google.maps.LatLngLiteral | undefined;
  nearbyRestaurants: any[] = [];
  fullRestaurantList: any[] = [];

  userMarkerIcon: any = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="rgba(96, 165, 250, 0.25)" />
        <circle cx="12" cy="12" r="6" fill="#FFFFFF" />
        <circle cx="12" cy="12" r="4.5" fill="#3B82F6" />
      </svg>
    `),
    scaledSize: { width: 24, height: 24 },
    anchor: { x: 12, y: 12 }
  };

  restaurantIcon: any = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#F59E0B" stroke="#131A24" stroke-width="2.5"/></svg>`),
    scaledSize: { width: 16, height: 16 },
    anchor: { x: 8, y: 8 }
  };

  dropMarkerOptions: google.maps.MarkerOptions = {
    animation: google.maps.Animation.DROP
  };

  get radiusOptions(): google.maps.CircleOptions {
    return {
      // Convert miles from your AppState into meters
      radius: this.state.searchRadius() * 1609.34,
      fillColor: '#60A5FA', // Tastebuddy Blue
      fillOpacity: 0.05,    // Very subtle fill so it doesn't hide roads
      strokeColor: '#60A5FA',
      strokeOpacity: 0.3,
      strokeWeight: 1.5,
      clickable: false,     // Ensures the circle doesn't block clicks on the map itself
    };
  }

  refreshMap() {
    this.nearbyRestaurants = []; // Clear current pins
    this.loadingLocation.set(true);
    this.getUserLocation();
  }

  // 1. Map Yelp's dynamic cuisine text to your preferred emojis
  getEmojiForCuisine(cuisine: string): string {
    const c = cuisine.toLowerCase();

    // 💥 FIX: Added burrito and a few others to be safe!
    if (c.includes('mexican') || c.includes('taco') || c.includes('burrito')) return '🌮';
    if (c.includes('burger') || c.includes('american') || c.includes('fast food')) return '🍔';
    if (c.includes('pizza') || c.includes('italian')) return '🍕';
    if (c.includes('sushi') || c.includes('japanese') || c.includes('seafood')) return '🍣';
    if (c.includes('chinese') || c.includes('thai') || c.includes('asian') || c.includes('noodle')) return '🍜';
    if (c.includes('coffee') || c.includes('cafe') || c.includes('tea')) return '☕';
    if (c.includes('breakfast') || c.includes('brunch')) return '🥞';
    if (c.includes('dessert') || c.includes('ice cream') || c.includes('bakery')) return '🍦';

    return '🍽️'; // Default fallback
  }

  // 2. Dynamically generate the floating SVG marker
  getRestaurantMarker(restaurant: any, index: number): any {
    // Your exact original color palette
    const themes = [
      { bg: 'rgba(74, 222, 128, 0.22)', solid: '#15803D' },  // Green
      { bg: 'rgba(96, 165, 250, 0.22)', solid: '#1D4ED8' },  // Blue
      { bg: 'rgba(245, 158, 11, 0.22)', solid: '#B45309' },  // Orange
      { bg: 'rgba(244, 114, 182, 0.22)', solid: '#BE185D' }, // Pink
      { bg: 'rgba(167, 139, 250, 0.22)', solid: '#6D28D9' }  // Purple
    ];

    // Cycle through colors so the map is diverse
    const theme = themes[index % themes.length];
    const emoji = this.getEmojiForCuisine(restaurant.cuisine);

    // Build the custom SVG with a drop shadow for the floating effect
    const svg = `
                                                                                                                       <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                                                                                                               <ellipse cx="20" cy="34" rx="8" ry="2.5" fill="rgba(0,0,0,0.5)" />

                                                                                                                                               <g transform="translate(0, -4)">
                                                                                                                                                         <circle cx="20" cy="20" r="16" fill="${theme.bg}" />
                                                                                                                                                                   <circle cx="20" cy="20" r="11" fill="${theme.solid}" />
                                                                                                                                                                             <text x="20" y="24" text-anchor="middle" font-size="12" font-family="Arial, sans-serif">${emoji}</text>
                                                                                                                                                                                     </g>
                                                                                                                                                                                           </svg>
                                                                                                                                                                                               `;

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: { width: 40, height: 40 },
      anchor: { x: 20, y: 34 } // Anchors the marker exactly at the shadow's center
    };
  }


  // --- WAYMO-STYLE DARK MAP CONFIGURATION ---
  mapOptions: google.maps.MapOptions = {
    center: { lat: 33.4152, lng: -111.8315 },
    zoom: 14,
    disableDefaultUI: true, // Hides all Google UI buttons (zoom, street view)
    clickableIcons: false,  // Prevents tapping on random map elements
    backgroundColor: '#131A24',
    styles: [
      { elementType: "geometry", stylers: [{ color: "#131A24" }] },
      { elementType: "labels.icon", stylers: [{ visibility: "off" }] }, // Turns off all icons
      { elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#131A24" }] },
      { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
      { featureType: "poi", stylers: [{ visibility: "off" }] }, // Turns off businesses
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#1E293B" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0B0F1A" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] }, // Turns off bus/train lines
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0B0F1A" }] }
    ]
  };

  ngOnInit(): void {
    // 💥 FIX: Check if we already have the map data saved
    const savedLoc = this.state.lastLocation();
    const savedRest = this.state.lastRestaurants();

    if (savedLoc && savedRest.length > 0) {
      // Instantly restore the map without fetching or animations
      this.userLocation = savedLoc;
      this.mapOptions = { ...this.mapOptions, center: this.userLocation };
      this.fullRestaurantList = savedRest;
      this.nearbyRestaurants = savedRest; // Load all at once, no drop delay
      this.loadingLocation.set(false);
    } else {
      // First time loading the app, do the full fetch and animation
      this.getUserLocation();
    }
  }

  selectedRestaurant = signal<any | null>(null);

  openRestaurantCard(r: any) {
    this.selectedRestaurant.set(r);
  }

  closeDetail() {
    this.selectedRestaurant.set(null);
  }

  getUserLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          this.loadingLocation.set(false);
          this.userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
          this.mapOptions = { ...this.mapOptions, center: this.userLocation };

          try {
            this.fullRestaurantList = await this.yelp.getRestaurants(
              this.userLocation.lat,
              this.userLocation.lng,
              this.state.searchRadius()
              // (Make sure your Yelp service is also passing state.selectedCuisines() here!)
            );

            // 💥 FIX: Log the parameters we just used so the "Stale" detector resets to false
            this.state.lastFetchRadius.set(this.state.searchRadius());
            this.state.lastFetchCuisines.set(this.state.selectedCuisines());

            this.state.lastLocation.set(this.userLocation);
            this.state.lastRestaurants.set(this.fullRestaurantList);

            this.fullRestaurantList.forEach((restaurant, index) => {
              setTimeout(async () => {
                this.nearbyRestaurants.push(restaurant);
                if (Capacitor.isNativePlatform()) {
                  await Haptics.impact({ style: ImpactStyle.Light });
                }
              }, index * 80);
            });

          } catch (error) {
            console.error('Yelp fetch failed:', error);
            this.loadingLocation.set(false);
          }
        },
        (error) => {
          console.error('Location denied', error);
          this.loadingLocation.set(false);
        },
        { enableHighAccuracy: true }
      );
    }
  }

  onStartClicked() {
    // FIX: Emit the full list so we don't miss any if the user clicks quickly
    this.start.emit(this.fullRestaurantList);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this._rafId);
  }

  // ── Map pulse animation ────────────────────────────────────
  private _animatePulse(): void {
    const start = performance.now();
    const tick = (now: number) => {
      this.mapPulse.set(((now - start) / 2300) % 1);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  // ── Getters ────────────────────────────────────────────────
  get hasGroups(): boolean {
    return this.state.groups().length > 0;
  }

  get recentGroups(): ForkupGroup[] {
    return this.state.groups().filter(g => !g.isLive).slice(0, 2);
  }

  get activeGroup(): ForkupGroup | undefined {
    return this.state.groups().find(g => g.isLive);
  }

  getLastMatch(group: ForkupGroup): string | null {
    for (const s of group.sessions) {
      const full = s.matches.find(m => m.isFull);
      if (full) return `${full.restaurant.emoji} ${full.restaurant.name}`;
    }
    return null;
  }

  getMemberNames(members: GroupMember[]): string {
    if (members.length === 1) return members[0].username;
    if (members.length === 2) return `${members[0].username} & ${members[1].username}`;
    return `${members[0].username}, ${members[1].username} & ${members[2].username}`;
  }

  getMemberShort(members: GroupMember[]): string {
    if (members.length <= 2) return this.getMemberNames(members);
    return `${members[0].username}, ${members[1].username} & ${members[2].username}`;
  }

  memberClass(colorIndex: number): string {
    return `av-${colorIndex}`;
  }

  // ── Actions ────────────────────────────────────────────────
  async startSession() {
    this.creating.set(true);
    try {
      const code = await this.state.startSession(
        this.userLocation?.lat ?? 33.4152,
        this.userLocation?.lng ?? -111.8315
      );
      this.router.navigate(['/tabs/swipe'], { queryParams: { code } });
    } finally {
      this.creating.set(false);
    }
  }

  goJoin(): void {
    this.router.navigate(['/join']);
  }

  goProfile(): void {
    this.router.navigate(['/tabs/profile']);
  }

  goRejoin(): void {
    this.router.navigate(['/tabs/swipe']);
  }

  confirmEnd(): void {
    this.showEndDialog.set(true);
  }

  async doEnd(): Promise<void> {
    await this.state.endSession();
    this.showEndDialog.set(false);
  }

  openSwipeAgain(group: ForkupGroup): void {
    this.selectedGroup.set(group);
    this.newRoomCode.set(generateRoomCode());
    this.showSwipeAgainSheet.set(true);
  }

  async confirmSwipeAgain(): Promise<void> {
    this.showSwipeAgainSheet.set(false);
    if (!this.selectedGroup()) return;
    this.creating.set(true);
    try {
      const code = await this.state.startSession(
        this.userLocation?.lat ?? 33.4152,
        this.userLocation?.lng ?? -111.8315,
        this.newRoomCode()
      );
      this.router.navigate(['/tabs/swipe'], { queryParams: { code } });
    } finally {
      this.creating.set(false);
    }
  }

  async shareCode() {
    const code = this.state.activeRoomCode();
    const inviteLink = `https://tastebuddy.app/join/${code}`;

    try {
      // 💥 1. Check if we are running on a real phone (iOS/Android)
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'Join my Tastebuddy room!',
          text: `Help me decide where to eat! Tap the link or enter code ${code}`,
          url: inviteLink,
          dialogTitle: 'Invite friends'
        });
      } else {
        // If testing on the web, force the fallback
        throw new Error('Not running on a native device');
      }
    } catch (error) {
      // 💥 2. Fallback: Copy the FULL link and show an alert so you know it worked
      navigator.clipboard.writeText(inviteLink).then(() => {
        alert(`Invite link copied to clipboard!\n\n${inviteLink}`);
      }).catch(() => {
        // Just in case the clipboard API is completely blocked
        alert(`Tell your friends to join room: ${code}`);
      });
    }
  }

  goGroupDetail(id: string): void {
    this.router.navigate(['/tabs/groups', id]);
  }

  // 💥 NEW: Signal to track the city search
  searchLocation = signal<string>('');

  async performSearch() {
    const city = this.searchLocation().trim();
    if (!city) return;

    this.loadingLocation.set(true);
    this.nearbyRestaurants = []; // Clear current list

    try {
      const results = await this.yelp.getRestaurants(
        null, null, // No GPS needed
        this.state.searchRadius(),
        this.state.selectedCuisines(),
        city // Pass the city string here
      );

      this.fullRestaurantList = results;

      // If we got results, center the map on the first restaurant found in that city
      if (results.length > 0 && results[0].lat !== undefined && results[0].lng !== undefined) {
        this.userLocation = { lat: results[0].lat, lng: results[0].lng };
        this.mapOptions = { ...this.mapOptions, center: this.userLocation };
      }

      this.state.lastRestaurants.set(results);
      this.loadingLocation.set(false);

      // Re-trigger the pin dropping animation
      results.forEach((r, i) => setTimeout(async () => {
        this.nearbyRestaurants.push(r);

        // 💥 NEW: Trigger a light haptic "tick" on the phone
        if (Capacitor.isNativePlatform()) {
          await Haptics.impact({ style: ImpactStyle.Light });
        }
      }, i * 80));

    } catch (error) {
      console.error('City search failed', error);
      this.loadingLocation.set(false);
      alert('Could not find that location. Try a city name or zip code.');
    }
  }

  // 💥 NEW: Clear search and go back to GPS
  resetToCurrentLocation() {
    this.searchLocation.set('');
    this.getUserLocation();
  }
}

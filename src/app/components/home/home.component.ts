// src/app/components/home/home.component.ts
import { Component, inject, signal, computed, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { ForkupGroup, GroupMember } from '../../models/restaurant.model';
import { generateRoomCode } from '../../data/mock-data';
import { GoogleMapsModule, MapMarker } from '@angular/google-maps';
import { YelpService } from '../../services/yelp.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, IonicModule, GoogleMapsModule, MapMarker],
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

  // 1. Map Yelp's dynamic cuisine text to your preferred emojis
  getEmojiForCuisine(cuisine: string): string {
    const c = cuisine.toLowerCase();
    if (c.includes('mexican') || c.includes('taco')) return '🌮';
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
    this.getUserLocation();
  }

  // NEW: Ask the phone/browser for GPS coordinates
  getUserLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          this.userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
          this.mapOptions = { ...this.mapOptions, center: this.userLocation };

          try {
            // 1. Fetch the data and store it safely in the background
            this.fullRestaurantList = await this.yelp.getRestaurants(
              this.userLocation.lat,
              this.userLocation.lng,
              this.state.searchRadius()
            );

            // 2. Loop through the list and drop them on the map with a delay!
            this.fullRestaurantList.forEach((restaurant, index) => {
              setTimeout(() => {
                // By pushing them one by one, the *ngFor creates them individually,
                // triggering the DROP animation for each specific pin.
                this.nearbyRestaurants.push(restaurant);
              }, index * 80); // 80 millisecond delay between each drop
            });

          } catch (error) {
            console.error('Yelp fetch failed:', error);
          }
        },
        (error) => console.error('Location denied', error),
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
    // FIX: Pass the user's real live location, or use the fallback
    const code = await this.state.startSession(
      this.userLocation?.lat ?? 33.4152,
      this.userLocation?.lng ?? -111.8315
    );
    this.router.navigate(['/tabs/swipe'], { queryParams: { code } });
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
      await this.state.startSession();
      this.router.navigate(['/tabs/swipe']);
    } finally {
      this.creating.set(false);
    }
  }

  shareCode(): void {
    // In production: navigator.share({ text: this.state.activeRoomCode() })
    console.log('Share code:', this.state.activeRoomCode());
  }

  goGroupDetail(id: string): void {
    this.router.navigate(['/tabs/groups', id]);
  }
}

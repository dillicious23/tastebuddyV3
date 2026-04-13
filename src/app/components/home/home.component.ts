import { Component, inject, signal, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core'; import { CommonModule } from '@angular/common';
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
import { Geolocation } from '@capacitor/geolocation';
import { FirebaseSessionService } from 'src/app/services/firebase-session.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, IonicModule, GoogleMapsModule, MapMarker, MapCircle, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  readonly state = inject(AppStateService);
  private yelp = inject(YelpService);

  @Output() start = new EventEmitter<any[]>();

  // UI state
  showEndDialog = signal(false);
  showSwipeAgainSheet = signal(false);
  creating = signal(false);
  selectedGroup = signal<ForkupGroup | null>(null);
  newRoomCode = signal('');
  mapPulse = signal(0);
  private _rafId = 0;
  loadingLocation = signal(true);
  searchLocation = signal<string>('');

  userLocation: google.maps.LatLngLiteral | undefined;
  nearbyRestaurants: any[] = [];
  fullRestaurantList: any[] = [];
  selectedRestaurant = signal<any | null>(null);

  showInviteSheet = signal(false);
  availableUsers = signal<any[]>([]);
  loadingUsers = signal(false);
  isInviting = signal(false);

  constructor() {
    this._animatePulse();
  }

  private fb = inject(FirebaseSessionService);

  // 💥 NEW: Ionic hook so it checks for fresh data every time the tab opens
  ngOnInit(): void {
    const savedLoc = this.state.lastLocation();
    const savedRest = this.state.lastRestaurants();

    if (savedLoc && savedRest.length > 0) {
      if (this.state.isDataStale()) {
        console.log('[HOME] Filters changed! Auto-refreshing map...');
        this.refreshMap();
      } else {
        console.log('[HOME] Data is still fresh. Restoring map.');
        this.userLocation = savedLoc;
        this.mapOptions = { ...this.mapOptions, center: this.userLocation };
        this.fullRestaurantList = savedRest;
        this.nearbyRestaurants = savedRest;
        this.loadingLocation.set(false);
      }
    } else {
      this.getUserLocation();
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this._rafId);
  }

  // 💥 NEW: Detects if we are using GPS or the custom city search bar
  refreshMap() {
    this.nearbyRestaurants = [];
    this.loadingLocation.set(true);

    if (this.searchLocation().trim() !== '') {
      this.performSearch();
    } else {
      this.getUserLocation();
    }
  }

  // 💥 THE FUSE & FALLBACK LOGIC
  // 💥 THE FUSE & NATIVE CAPACITOR LOGIC
  async getUserLocation() {
    console.log('[GEO] 1. getUserLocation() called');
    this.loadingLocation.set(true);

    let locationResolved = false;

    // 4-Second Fuse for Desktop Testing
    const fuse = setTimeout(() => {
      if (!locationResolved) {
        console.warn('[GEO] 2. MANUAL TIMEOUT (4s) hit! Forcing fallback.');
        locationResolved = true;
        this.handleLocationFallback();
      }
    }, 4000);

    try {
      // 💥 THIS IS THE FIX: Ask the native device, not the web browser!
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: Capacitor.isNativePlatform(),
        timeout: 4000,
        maximumAge: 0
      });

      if (locationResolved) return; // Ignore if the fuse already blew

      locationResolved = true;
      clearTimeout(fuse);
      console.log('[GEO] 3. Fuse defused. Got native coordinates.');

      this.userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
      this.mapOptions = { ...this.mapOptions, center: this.userLocation };

      await this.fetchYelpData(this.userLocation.lat, this.userLocation.lng);

    } catch (error: any) {
      if (locationResolved) return;
      locationResolved = true;
      clearTimeout(fuse);
      console.warn('[GEO] Native Geolocation Error!', error.message);
      this.handleLocationFallback();
    }
  }

  async handleLocationFallback() {
    console.log('[FALLBACK] Triggered! Using Mesa, AZ');
    this.userLocation = { lat: 33.4152, lng: -111.8315 };
    this.mapOptions = { ...this.mapOptions, center: this.userLocation };

    // Skip dropping animation for fallback to load instantly
    const results = await this.fetchYelpData(this.userLocation.lat, this.userLocation.lng, true);
    if (results) this.nearbyRestaurants = [...results];
  }

  // 💥 NEW: Unified fetcher to ensure we always pass the right filters
  async fetchYelpData(lat: number | null, lng: number | null, instantLoad = false, city?: string) {
    try {
      const results = await this.yelp.getRestaurants(
        lat, lng,
        this.state.searchRadius(),
        this.state.yelpCategoryString(), // 💥 FIX: Send the aliases to Yelp!
        this.state.openNow(),
        this.state.priceFilter(),
        city
      );

      this.fullRestaurantList = results;

      // Reset the stale data trackers (Make sure it tracks the string now!)
      this.state.lastFetchRadius.set(this.state.searchRadius());
      this.state.lastFetchCuisines.set(this.state.yelpCategoryString()); this.state.lastFetchOpenNow.set(this.state.openNow());
      this.state.lastFetchPrice.set(this.state.priceFilter().join(','));

      if (lat && lng) {
        this.state.lastLocation.set({ lat, lng });
      }
      this.state.lastRestaurants.set(this.fullRestaurantList);

      if (!instantLoad) {
        results.forEach((restaurant, index) => {
          setTimeout(async () => {
            this.nearbyRestaurants.push(restaurant);
            if (Capacitor.isNativePlatform()) {
              await Haptics.impact({ style: ImpactStyle.Light });
            }
          }, index * 80);
        });
      }

      return results;
    } catch (error) {
      console.error('Yelp fetch failed:', error);
      return null;
    } finally {
      this.loadingLocation.set(false);
    }
  }

  async performSearch() {
    const city = this.searchLocation().trim();
    if (!city) return;

    this.loadingLocation.set(true);
    this.nearbyRestaurants = [];

    const results = await this.fetchYelpData(null, null, false, city);

    // 💥 FIX: Check both lat and lng to explicitly guarantee they are numbers
    if (results && results.length > 0 && typeof results[0].lat === 'number' && typeof results[0].lng === 'number') {

      // 💥 FIX: Build a concrete object so TypeScript knows it is 100% safe
      const newLoc = { lat: results[0].lat, lng: results[0].lng };

      this.userLocation = newLoc;
      this.mapOptions = { ...this.mapOptions, center: this.userLocation };
      this.state.lastLocation.set(newLoc); // Pass the safe object to state

    } else {
      alert('Could not find that location. Try a city name or zip code.');
    }
  }

  resetToCurrentLocation() {
    this.searchLocation.set('');
    this.getUserLocation();
  }

  // ── Helpers & Map config ────────────────────────────────────
  get myAvatar(): string { return localStorage.getItem('userAvatar') || '🦦'; }

  openRestaurantCard(r: any) { this.selectedRestaurant.set(r); }
  closeDetail() { this.selectedRestaurant.set(null); }
  onStartClicked() { this.start.emit(this.fullRestaurantList); }

  private _animatePulse(): void {
    const start = performance.now();
    const tick = (now: number) => {
      this.mapPulse.set(((now - start) / 2300) % 1);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

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

  dropMarkerOptions: google.maps.MarkerOptions = { animation: google.maps.Animation.DROP };

  get radiusOptions(): google.maps.CircleOptions {
    return {
      radius: this.state.searchRadius() * 1609.34,
      fillColor: '#60A5FA', fillOpacity: 0.05, strokeColor: '#60A5FA',
      strokeOpacity: 0.3, strokeWeight: 1.5, clickable: false,
    };
  }

  getEmojiForCuisine(cuisine: string): string {
    const c = cuisine.toLowerCase();
    if (c.includes('mexican') || c.includes('taco') || c.includes('burrito')) return '🌮';
    if (c.includes('burger') || c.includes('american') || c.includes('fast food')) return '🍔';
    if (c.includes('pizza') || c.includes('italian')) return '🍕';
    if (c.includes('sushi') || c.includes('japanese') || c.includes('seafood')) return '🍣';
    if (c.includes('chinese') || c.includes('thai') || c.includes('asian') || c.includes('noodle')) return '🍜';
    if (c.includes('coffee') || c.includes('cafe') || c.includes('tea')) return '☕';
    if (c.includes('breakfast') || c.includes('brunch')) return '🥞';
    if (c.includes('dessert') || c.includes('ice cream') || c.includes('bakery')) return '🍦';
    return '🍽️';
  }

  getRestaurantMarker(restaurant: any, index: number): any {
    const themes = [
      { bg: 'rgba(74, 222, 128, 0.22)', solid: '#15803D' },
      { bg: 'rgba(96, 165, 250, 0.22)', solid: '#1D4ED8' },
      { bg: 'rgba(245, 158, 11, 0.22)', solid: '#B45309' },
      { bg: 'rgba(244, 114, 182, 0.22)', solid: '#BE185D' },
      { bg: 'rgba(167, 139, 250, 0.22)', solid: '#6D28D9' }
    ];
    const theme = themes[index % themes.length];
    const emoji = this.getEmojiForCuisine(restaurant.cuisine);
    const svg = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><ellipse cx="20" cy="34" rx="8" ry="2.5" fill="rgba(0,0,0,0.5)" /><g transform="translate(0, -4)"><circle cx="20" cy="20" r="16" fill="${theme.bg}" /><circle cx="20" cy="20" r="11" fill="${theme.solid}" /><text x="20" y="24" text-anchor="middle" font-size="12" font-family="Arial, sans-serif">${emoji}</text></g></svg>`;
    return { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), scaledSize: { width: 40, height: 40 }, anchor: { x: 20, y: 34 } };
  }

  mapOptions: google.maps.MapOptions = {
    center: { lat: 33.4152, lng: -111.8315 },
    zoom: 14, disableDefaultUI: true, clickableIcons: false, backgroundColor: '#131A24',
    styles: [
      { elementType: "geometry", stylers: [{ color: "#131A24" }] },
      { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#131A24" }] },
      { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#1E293B" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0B0F1A" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0B0F1A" }] }
    ]
  };

  // Group Getters
  get hasGroups(): boolean { return this.state.groups().length > 0; }
  get recentGroups(): ForkupGroup[] { return this.state.groups().filter(g => !g.isLive).slice(0, 2); }
  get activeGroup(): ForkupGroup | undefined { return this.state.groups().find(g => g.isLive); }
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
  memberClass(colorIndex: number): string { return `av-${colorIndex}`; }

  // Actions


  async openInviteSheet() {
    this.showInviteSheet.set(true);
    this.loadingUsers.set(true);

    try {
      // Fetch all registered users from Firestore (they have FCM tokens)
      const firestoreUsers = await this.fb.getAvailableUsers();

      // Also pull in knownFriends from local history as a fallback
      const knownFriends = this.state.knownFriends();

      // Merge both lists, Firestore users take priority (they have fcmToken)
      const mergedMap = new Map<string, any>();
      for (const u of firestoreUsers) {
        mergedMap.set(u.uid, u);
      }
      for (const f of knownFriends) {
        if (f.uid && !mergedMap.has(f.uid)) {
          mergedMap.set(f.uid, f);
        }
      }

      // Exclude people already in the active room
      const inRoomUids = new Set(
        this.state.activeMembers().map(m => m.uid).filter(Boolean)
      );

      this.availableUsers.set(
        Array.from(mergedMap.values()).filter(u => !inRoomUids.has(u.uid))
      );
    } catch (e) {
      console.error('Failed to load users:', e);
      this.availableUsers.set([]);
    } finally {
      this.loadingUsers.set(false);
    }
  }

  async sendInvite(targetUser: any) {
    this.isInviting.set(true);
    const code = this.state.activeRoomCode();

    // Call the Mailman!
    await this.fb.sendPushInvite(targetUser.uid, this.state.username(), code);

    this.isInviting.set(false);
    this.showInviteSheet.set(false);

    alert(`Invite sent to ${targetUser.username}!`);
  }

  async startSession() {
    this.creating.set(true);
    try {
      const code = await this.state.startSession(this.userLocation?.lat ?? 33.4152, this.userLocation?.lng ?? -111.8315);
      this.router.navigate(['/tabs/swipe'], { queryParams: { code } });
    } finally { this.creating.set(false); }
  }
  goJoin(): void { this.router.navigate(['/join']); }
  goProfile(): void { this.router.navigate(['/tabs/profile']); }
  goRejoin(): void { this.router.navigate(['/tabs/swipe']); }
  confirmEnd(): void { this.showEndDialog.set(true); }
  async doEnd(): Promise<void> { await this.state.endSession(); this.showEndDialog.set(false); }
  openSwipeAgain(group: ForkupGroup): void {
    this.selectedGroup.set(group); this.newRoomCode.set(generateRoomCode()); this.showSwipeAgainSheet.set(true);
  }
  async confirmSwipeAgain(): Promise<void> {
    this.showSwipeAgainSheet.set(false); if (!this.selectedGroup()) return;
    this.creating.set(true);
    try {
      const code = await this.state.startSession(this.userLocation?.lat ?? 33.4152, this.userLocation?.lng ?? -111.8315, this.newRoomCode());
      this.router.navigate(['/tabs/swipe'], { queryParams: { code } });
    } finally { this.creating.set(false); }
  }
  async shareCode() {
    const code = this.state.activeRoomCode();
    const inviteLink = `https://tastebuddyv2.web.app/join/${code}`;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'Join my Tastebuddy room!', text: `Help me decide where to eat! Tap the link or enter code ${code}`, url: inviteLink });
      } else { throw new Error('Not running on native'); }
    } catch (error) {
      navigator.clipboard.writeText(inviteLink).then(() => alert(`Invite link copied!\n\n${inviteLink}`)).catch(() => alert(`Join room: ${code}`));
    }
  }
  goGroupDetail(id: string): void { this.router.navigate(['/tabs/groups', id]); }
}
// src/app/components/home/home.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { ForkupGroup, GroupMember } from '../../models/restaurant.model';
import { generateRoomCode } from '../../data/mock-data';
import { GoogleMapsModule, MapMarker } from '@angular/google-maps';

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
        (position) => {
          this.userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          // Reassign mapOptions to trigger Angular to re-render the center
          this.mapOptions = {
            ...this.mapOptions,
            center: this.userLocation
          };
        },
        (error) => {
          console.error('Location access denied or failed.', error);
        },
        { enableHighAccuracy: true } // Forces GPS chip for precision
      );
    }
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
  async startSession(): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      const code = await this.state.startSession();
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

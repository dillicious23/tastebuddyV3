// src/app/components/home/home.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { ForkupGroup, GroupMember } from '../../models/restaurant.model';
import { generateRoomCode } from '../../data/mock-data';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, IonicModule],
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

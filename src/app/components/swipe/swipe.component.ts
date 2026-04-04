// src/app/components/swipe/swipe.component.ts
import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  ElementRef, ViewChild, HostListener, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { Restaurant } from '../../models/restaurant.model';
import { RESTAURANTS, MEMBERS } from '../../data/mock-data';
import { CardContentComponent } from './card-content.component';

type SwipeDir = 'left' | 'right' | null;

@Component({
  selector: 'app-swipe',
  standalone: true,
  imports: [CommonModule, IonicModule, CardContentComponent],
  templateUrl: './swipe.component.html',
  styleUrls: ['./swipe.component.scss'],
})
export class SwipeComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private state = inject(AppStateService);
  private cdr = inject(ChangeDetectorRef);

  // Card data
  deck = [...RESTAURANTS];
  topIdx = signal(0);

  // Drag state
  dragX = signal(0);
  dragY = signal(0);
  dragActive = false;
  startX = 0;
  startY = 0;
  isBusy = false;

  // Derived direction indicator (for LIKE/NOPE badge)
  swipeDir = computed<SwipeDir>(() => {
    const x = this.dragX();
    if (x > 80) return 'right';
    if (x < -80) return 'left';
    return null;
  });

  // Card rotation (max ±18°)
  cardRotation = computed(() => (this.dragX() / window.innerWidth) * 18);

  // Animated badge opacity
  badgeOpacity = computed(() => Math.min(Math.abs(this.dragX()) / 80, 1));

  // UI state signals
  showDetailSheet = signal(false);
  showToast = signal(false);
  outOfCards = signal(false);
  matchCount = signal(0);
  showLeaveConfirm = signal(false);

  // Session info (passed via router state in production; using service here)
  roomCode = this.state.activeRoomCode;
  isSolo = this.state.isSolo;
  members = this.state.activeMembers;
  isWaiting = this.state.isWaiting;

  // Selected card (behind top — for detail sheet)
  get currentCard(): Restaurant {
    return this.deck[this.topIdx() % this.deck.length];
  }

  get nextCard(): Restaurant {
    return this.deck[(this.topIdx() + 1) % this.deck.length];
  }

  get thirdCard(): Restaurant {
    return this.deck[(this.topIdx() + 2) % this.deck.length];
  }

  get memberNames(): string {
    const m = this.members();
    if (m.length === 0) return '';
    if (m.length === 1) return m[0].username;
    if (m.length === 2) return `${m[0].username} & ${m[1].username}`;
    return `${m[0].username}, ${m[1].username} & ${m[2].username}`;
  }

  ngOnInit(): void {
    // Simulate a friend joining after 3 s if solo (demo only)
    if (this.state.isSolo()) {
      setTimeout(() => {
        this.state.friendJoined(MEMBERS[1]);
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 3500);
      }, 3000);
    }
  }

  ngOnDestroy(): void { }

  // ── Touch / mouse handlers ────────────────────────────────
  onDragStart(e: TouchEvent | MouseEvent): void {
    if (this.isBusy) return;
    this.dragActive = true;
    const point = 'touches' in e ? e.touches[0] : e;
    this.startX = point.clientX;
    this.startY = point.clientY;
  }

  onDragMove(e: TouchEvent | MouseEvent): void {
    if (!this.dragActive || this.isBusy) return;
    e.preventDefault();
    const point = 'touches' in e ? e.touches[0] : e;
    this.dragX.set(point.clientX - this.startX);
    this.dragY.set((point.clientY - this.startY) * 0.08);
  }

  onDragEnd(): void {
    if (!this.dragActive || this.isBusy) return;
    this.dragActive = false;
    const x = this.dragX();
    if (x > 80) this.swipeCard('right');
    else if (x < -80) this.swipeCard('left');
    else { this.dragX.set(0); this.dragY.set(0); }
  }

  // ── Button swipe (no gesture) ─────────────────────────────
  btnSwipe(dir: 'left' | 'right'): void {
    this.swipeCard(dir);
  }

  // ── Core swipe logic ──────────────────────────────────────
  swipeCard(dir: 'left' | 'right'): void {
    if (this.isBusy) return;
    this.isBusy = true;

    // Snap card off screen
    const targetX = dir === 'right' ? window.innerWidth * 1.4 : -window.innerWidth * 1.4;
    this.dragX.set(targetX);
    this.dragY.set(20);

    setTimeout(() => {
      const next = (this.topIdx() + 1) % this.deck.length;

      // Check for match (demo: 3rd right-swipe = match on Sakura)
      if (dir === 'right' && this.matchCount() === 0 && next >= 2 && !this.isSolo()) {
        this.matchCount.update(n => n + 1);
        this.state.addMatch();
        this.router.navigate(['/match']);
      }

      this.topIdx.set(next);
      this.dragX.set(0);
      this.dragY.set(0);
      this.cdr.detectChanges();

      // Out of cards after one full loop
      if (next === 0) {
        this.outOfCards.set(true);
      }

      setTimeout(() => { this.isBusy = false; }, 50);
    }, 340);
  }

  // ── Detail sheet actions ──────────────────────────────────
  openDetail(): void { this.showDetailSheet.set(true); }
  closeDetail(): void { this.showDetailSheet.set(false); }
  detailPass(): void { this.showDetailSheet.set(false); this.swipeCard('left'); }
  detailLike(): void { this.showDetailSheet.set(false); this.swipeCard('right'); }

  // ── Session results ───────────────────────────────────────
  goSessionResults(): void {
    this.router.navigate(['/session-results']);
  }

  // ── Waiting room ──────────────────────────────────────────
  beginSwiping(): void {
    this.state.startSwiping();
  }

  shareCode(): void {
    const code = this.state.activeRoomCode();
    if (navigator.clipboard) navigator.clipboard.writeText(code);
    // In production: navigator.share({ text: code })
  }

  // ── Leave ─────────────────────────────────────────────────
  confirmLeave(): void { this.showLeaveConfirm.set(true); }
  doLeave(): void {
    this.showLeaveConfirm.set(false);
    this.router.navigate(['/tabs/home']);
  }

  // ── Out-of-cards options ──────────────────────────────────
  expandRadius(): void {
    // In production: update search radius and reload deck
    this.outOfCards.set(false);
    this.topIdx.set(0);
  }

  lowerBar(): void {
    this.outOfCards.set(false);
    this.topIdx.set(0);
  }

  startOver(): void {
    this.outOfCards.set(false);
    this.topIdx.set(0);
  }

  // ── Score colour ──────────────────────────────────────────
  scoreColor(score: string): string {
    return score === '3/3' ? '#F5C518' : '#4ADE80';
  }

  // ── Member colour class ───────────────────────────────────
  memberClass(idx: number): string { return `av-${idx}`; }
}

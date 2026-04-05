// src/app/components/swipe/swipe.component.ts
import {
  Component, OnInit, OnDestroy, inject, signal, computed, effect,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { Restaurant } from '../../models/restaurant.model';
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

  // Card data — driven from Firebase via state.deck signal
  get deck(): Restaurant[] { return this.state.deck(); }
  topIdx = signal(0);

  // Drag state
  dragX = signal(0);
  dragY = signal(0);
  dragActive = false;
  startX = 0;
  startY = 0;
  isBusy = false;
  localLikes = 0;

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

  swipeProgress = computed(() => Math.min(Math.abs(this.dragX()) / (window.innerWidth / 2), 1));

  backCard1Scale = computed(() => 0.95 + (this.swipeProgress() * 0.05));
  backCard1Y = computed(() => 10 - (this.swipeProgress() * 10));

  backCard2Scale = computed(() => 0.89 + (this.swipeProgress() * 0.06));
  backCard2Y = computed(() => 20 - (this.swipeProgress() * 10));

  // UI state signals
  showDetailSheet = signal(false);
  showToast = signal(false);
  outOfCards = signal(false);
  matchCount = signal(0);
  showLeaveConfirm = signal(false);

  // Session info
  roomCode = this.state.activeRoomCode;
  isSolo = this.state.isSolo;
  members = this.state.activeMembers;
  isWaiting = this.state.isWaiting;
  copied = signal(false);

  // Navigate to /match when Firebase detects a full consensus
  private _matchWatcher = effect(() => {
    const match = this.state.latestMatch();
    const waiting = this.state.isWaiting();
    if (match && !waiting) {
      // Consume and clear immediately so this doesn't re-fire
      this.state.latestMatch.set(null);
      this.state.addMatch();
      this.router.navigate(['/match']);
    }
  }, { allowSignalWrites: true });

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

  ngOnInit(): void { }

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
    if (this.isBusy || !this.deck.length) return;
    this.isBusy = true;

    const swipedRestaurant = this.currentCard;

    // 💥 NEW: Instantly track likes locally
    if (dir === 'right') this.localLikes++;

    // Record to Firebase
    this.state.recordSwipe(swipedRestaurant.id, dir === 'right' ? 'yes' : 'no');

    const targetX = dir === 'right' ? window.innerWidth * 1.4 : -window.innerWidth * 1.4;
    this.dragX.set(targetX);
    this.dragY.set(20);

    setTimeout(() => {
      this.isBusy = false;

      const next = (this.topIdx() + 1) % this.deck.length;

      this.topIdx.set(next);
      this.dragX.set(0);
      this.dragY.set(0);
      this.cdr.detectChanges();

      // Out of cards after one full loop
      if (next === 0) {

        // 💥 FIXED: Check localLikes for instantaneous response
        if (this.isSolo() && this.localLikes > 0) {
          this.goSessionResults();
        } else {
          this.outOfCards.set(true);
        }
      }
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
  async beginSwiping(): Promise<void> {
    await this.state.startSwiping();
  }

  async shareCode(): Promise<void> {
    const code = this.state.activeRoomCode();
    const shareText = `Join my Tastebuddy room! Code: ${code}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Tastebuddy Room',
          text: shareText,
        });
      } catch (err) {
        console.log('Share dismissed or failed');
      }
    } else {
      // Fallback if they are on a desktop browser that doesn't support sharing
      this.copyCode();
    }
  }

  // 💥 NEW: Dedicated copy method with visual feedback
  async copyCode(): Promise<void> {
    const code = this.state.activeRoomCode();
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000); // Reset after 2 seconds
    }
  }

  // ── Leave ─────────────────────────────────────────────────
  confirmLeave(): void { this.showLeaveConfirm.set(true); }
  async doLeave(): Promise<void> {
    this.showLeaveConfirm.set(false);
    await this.state.endSession();
    this.router.navigate(['/tabs/home']);
  }

  // ── Out-of-cards options ──────────────────────────────────
  expandRadius(): void {
    this.outOfCards.set(false);
    this.topIdx.set(0);
    this.localLikes = 0; // Reset
  }

  lowerBar(): void {
    this.outOfCards.set(false);
    this.topIdx.set(0);
    this.localLikes = 0; // Reset
  }

  startOver(): void {
    this.outOfCards.set(false);
    this.topIdx.set(0);
    this.localLikes = 0; // Reset
  }

  // ── Score colour ──────────────────────────────────────────
  scoreColor(score: string): string {
    return score === '3/3' ? '#F5C518' : '#4ADE80';
  }

  // ── Member colour class ───────────────────────────────────
  memberClass(idx: number): string { return `av-${idx}`; }
}

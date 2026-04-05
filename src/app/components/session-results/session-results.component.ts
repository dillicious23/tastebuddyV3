import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { Restaurant } from '../../models/restaurant.model';

@Component({
  selector: 'app-session-results',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
<div class="screen" style="background:var(--surface)">

  <div class="back-row safe-top">
    <div class="back-pill" (click)="goBack()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
      <span>Back to swiping</span>
    </div>
  </div>

  <div style="padding:8px 17px 10px">
    <h1 style="font-size:20px;font-weight:900;letter-spacing:-.3px;margin-bottom:2px">Session results</h1>
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;color:var(--tx5)">Room {{ roomCode() }} · {{ memberNames() }}</span>
      <div class="pill pill-green" style="font-size:9px;padding:2px 7px">● Live</div>
    </div>
  </div>

  <div class="scroll-area" style="flex:1;padding:0 12px">

    <ng-container *ngIf="liveMatches().length > 0">
      <p class="section-header">Matched · everyone agreed</p>
      
      <div class="match-result-card green-card br-lg" style="margin-bottom:10px;overflow:hidden;cursor:pointer" 
           *ngFor="let m of liveMatches()" (click)="openDetail(m.restaurant)">
        <div class="result-image" [style.background]="m.restaurant.bg">
          <img *ngIf="m.restaurant.imageUrl" [src]="m.restaurant.imageUrl" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:1;" />
          <span *ngIf="!m.restaurant.imageUrl" style="font-size:46px; position:relative; z-index:2">{{ m.restaurant.emoji }}</span>
          <div style="position:absolute;top:8px;right:10px;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);border-radius:20px;padding:3px 9px;font-size:10px;color:var(--star);font-weight:700;z-index:10">
            ⭐ {{ m.restaurant.rating }}
          </div>
        </div>
        <div style="padding:10px 13px">
          <div style="font-size:15px;font-weight:800;margin-bottom:3px">{{ m.restaurant.name }}</div>
          <div style="font-size:10px;color:var(--tx3);margin-bottom:10px">{{ m.restaurant.cuisine }} · {{ m.restaurant.dist }} · {{ m.restaurant.price }}</div>
          <div style="font-size:10px;color:var(--green);font-weight:600">✓ {{ m.agreedCount }}/{{ m.totalCount }} agreed</div>
        </div>
      </div>
    </ng-container>

    <ng-container *ngIf="partialMatches().length > 0">
      <p class="section-header">Backup match · {{ partialMatches()[0].agreedCount }}/{{ partialMatches()[0].totalCount }} agreed</p>
      
      <div class="ghost-card br-lg" style="display:flex;align-items:center;gap:9px;padding:10px 12px;margin-bottom:10px;cursor:pointer" 
           *ngFor="let m of partialMatches()" (click)="openDetail(m.restaurant)">
        <div style="width:42px;height:42px;border-radius:11px;background:var(--card);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;position:relative;overflow:hidden;">
          <img *ngIf="m.restaurant.imageUrl" [src]="m.restaurant.imageUrl" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:1;" />
          <span *ngIf="!m.restaurant.imageUrl" style="position:relative; z-index:2">{{ m.restaurant.emoji }}</span>
        </div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700;color:var(--tx1)">{{ m.restaurant.name }}</div>
          <div style="font-size:10px;color:var(--tx3);margin-top:1px">{{ m.restaurant.cuisine }} · {{ m.restaurant.dist }} · {{ m.restaurant.price }}</div>
        </div>
      </div>
    </ng-container>

    <button class="btn-danger" (click)="endSession()" style="margin-top:20px; margin-bottom: 40px;">
      End session · save to group history
    </button>
  </div>

  <div class="sheet-overlay" *ngIf="selectedRestaurant()" (click)="closeDetail()">
    <div class="sheet-body" (click)="$event.stopPropagation()">
      <div class="sheet-handle"></div>

      <div class="detail-header">
        <div class="detail-icon" [style.background]="selectedRestaurant()!.bg" style="position:relative; overflow:hidden;">
          <img *ngIf="selectedRestaurant()!.imageUrl" [src]="selectedRestaurant()!.imageUrl" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:1;" />
          <span *ngIf="!selectedRestaurant()!.imageUrl" style="position:relative; z-index:2">{{ selectedRestaurant()!.emoji }}</span>
        </div>
        <div class="detail-meta">
          <h3 class="detail-name" style="margin:0;">{{ selectedRestaurant()!.name }}</h3>
          <p class="detail-sub" style="margin:0;">{{ selectedRestaurant()!.cuisine }} · {{ selectedRestaurant()!.price }}</p>
          <div class="detail-rating">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M5 1L6.2 3.8L9 4.1L7 6L7.6 9L5 7.5L2.4 9L3 6L1 4.1L3.8 3.8Z" fill="#F5C518" />
            </svg>
            <span style="font-size:11px;font-weight:700;color:var(--star)">{{ selectedRestaurant()!.rating }}</span>
            <span style="font-size:10px;color:var(--tx5)">· {{ selectedRestaurant()!.reviewCount ?? 312 }} reviews</span>
          </div>
        </div>
      </div>

      <div class="info-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span [style.color]="selectedRestaurant()!.isOpenNow ? '#4ADE80' : '#F87171'" style="font-weight: 700;">
          {{ selectedRestaurant()!.isOpenNow ? 'Open right now' : 'Currently closed' }}
        </span>
      </div>
      <div class="info-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        <span style="color:var(--blue)">{{ selectedRestaurant()!.dist }} away</span>
      </div>

      <div class="detail-actions" style="margin-top: 15px;">
        <a *ngIf="selectedRestaurant()!.yelpUrl" [href]="selectedRestaurant()!.yelpUrl" target="_blank" class="detail-like" style="display:flex;align-items:center;justify-content:center;text-decoration:none;width:100%;">
          <img src="assets/icon/yelp_burst.svg" style="width: 14px; height: 14px; margin-right: 6px; object-fit: contain;" alt="Yelp Logo">
          Open in Yelp
        </a>
      </div>
    </div>
  </div>

</div>
  `,
  styles: [`
    :host { display:block; height:100%; }
    .result-image { height:80px; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; }
    
    .back-row { padding: 14px 16px 6px; }
    .back-pill {
      display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px;
      background: rgba(11, 15, 26, 0.70); backdrop-filter: blur(14px);
      border: 0.5px solid rgba(255, 255, 255, 0.12); border-radius: 20px;
      color: #E2E8F0; cursor: pointer; transition: opacity 0.2s;
    }
    .back-pill span { font-size: 13px; font-weight: 700; letter-spacing: -0.2px; }
    .back-pill:active { opacity: 0.7; background: rgba(11, 15, 26, 0.90); }

    /* 💥 RESTORED: Sheet Styles */
    .detail-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .detail-icon { width: 54px; height: 54px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0; }
    .detail-name { font-size: 17px; font-weight: 800; color: var(--tx1); }
    .detail-sub { font-size: 11px; color: var(--tx3); }
    .detail-rating { display: flex; align-items: center; gap: 4px; }
    .detail-like { height: 44px; background: var(--green); border: none; border-radius: 12px; font-size: 13px; color: var(--green-ink); font-weight: 800; cursor: pointer; }
    .info-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 12px; }
  `],
})
export class SessionResultsComponent {
  private router = inject(Router);
  public state = inject(AppStateService);

  roomCode = this.state.activeRoomCode;
  members = this.state.activeMembers;
  memberNames = computed(() => this.members().map(m => m.username).join(', '));

  liveMatches = this.state.liveMatches;
  partialMatches = this.state.partialMatches;

  // 💥 RESTORED: Signal for the detail sheet
  selectedRestaurant = signal<Restaurant | null>(null);

  openDetail(r: Restaurant): void { this.selectedRestaurant.set(r); }
  closeDetail(): void { this.selectedRestaurant.set(null); }

  goBack(): void { this.router.navigate(['/tabs/swipe']); }
  endSession(): void {
    this.state.endSession();
    this.router.navigate(['/tabs/home']);
  }
}
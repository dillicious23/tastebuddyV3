import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'app-session-results',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
<div class="screen" style="background:var(--surface)">

  <div class="back-row safe-top" (click)="goBack()">
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path d="M9 3L5 7l4 4" stroke="#475569" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span style="font-size:11px;color:var(--tx4)">Back to swiping</span>
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
      <p class="section-header" style="display:flex;align-items:center;gap:5px">
        <svg width="9" height="9" viewBox="0 0 9 9">
          <path d="M4.5 1L5.4 3.5L8 3.7L6.2 5.3L6.8 8L4.5 6.6L2.2 8L2.8 5.3L1 3.7L3.6 3.5Z" fill="#4ADE80"/>
        </svg>
        Matched · everyone agreed
      </p>

      <div class="match-result-card green-card br-lg" style="margin-bottom:10px;overflow:hidden" *ngFor="let m of liveMatches()">
        <div class="result-image" [style.background]="m.restaurant.bg">
          <span style="font-size:46px">{{ m.restaurant.emoji }}</span>
          <div style="position:absolute;top:8px;right:10px;background:rgba(0,0,0,.5);border-radius:20px;padding:2px 7px;font-size:9px;color:var(--star);font-weight:700">
            ⭐ {{ m.restaurant.rating }}
          </div>
        </div>
        <div style="padding:10px 13px">
          <div style="font-size:15px;font-weight:800;margin-bottom:3px">{{ m.restaurant.name }}</div>
          <div style="font-size:10px;color:var(--tx3);margin-bottom:10px">{{ m.restaurant.cuisine }} · {{ m.restaurant.dist }} · {{ m.restaurant.price }}</div>
          <div style="font-size:10px;color:var(--green);font-weight:600;margin-bottom:10px">✓ {{ m.agreedCount }}/{{ m.totalCount }} agreed · full match</div>
        </div>
      </div>
    </ng-container>

    <ng-container *ngIf="partialMatches().length > 0">
      <p class="section-header">Backup match · {{ partialMatches()[0].agreedCount }}/{{ partialMatches()[0].totalCount }} agreed</p>
      
      <div class="ghost-card br-lg" style="display:flex;align-items:center;gap:9px;padding:10px 12px;margin-bottom:10px" *ngFor="let m of partialMatches()">
        <div style="width:42px;height:42px;border-radius:11px;background:var(--card);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">{{ m.restaurant.emoji }}</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700;color:var(--tx1)">{{ m.restaurant.name }}</div>
          <div style="font-size:10px;color:var(--tx3);margin-top:1px">{{ m.restaurant.cuisine }} · {{ m.restaurant.dist }} · {{ m.restaurant.price }}</div>
          <div style="font-size:10px;color:var(--tx5);margin-top:3px">{{ m.agreedCount }} people agreed</div>
        </div>
      </div>
    </ng-container>

    <div *ngIf="liveMatches().length === 0 && partialMatches().length === 0" style="text-align:center;padding:40px 20px;">
      <div style="font-size:40px;margin-bottom:10px;">🍽️</div>
      <h2 style="font-size:16px;font-weight:800;color:var(--tx1)">No matches yet</h2>
      <p style="font-size:12px;color:var(--tx3)">Keep swiping! Matches will appear here when you agree on a spot.</p>
    </div>

    <button class="btn-secondary" style="margin-bottom:8px" (click)="goBack()">
      ← Keep swiping for more options
    </button>

    <button class="btn-danger" (click)="endSession()">
      End session · save to group history
    </button>

    <div style="height:16px"></div>
  </div>

</div>
  `,
  styles: [`
    :host { display:block;height:100%; }
    .result-image { height:80px;display:flex;align-items:center;justify-content:center;position:relative; }
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

  goBack(): void { this.router.navigate(['/tabs/swipe']); }
  endSession(): void {
    this.state.endSession();
    this.router.navigate(['/tabs/home']);
  }
}
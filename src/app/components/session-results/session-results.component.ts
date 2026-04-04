// ═══════════════════════════════════════════════════════════════
// SESSION RESULTS SCREEN
// ═══════════════════════════════════════════════════════════════
// src/app/components/session-results/session-results.component.ts

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { RESTAURANTS, MEMBERS } from '../../data/mock-data';
import { SessionMatch } from '../../models/restaurant.model';

@Component({
  selector: 'app-session-results',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
<div class="screen" style="background:var(--surface)">

  <!-- Back -->
  <div class="back-row safe-top" (click)="goBack()">
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path d="M9 3L5 7l4 4" stroke="#475569" stroke-width="1.6"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span style="font-size:11px;color:var(--tx4)">Back to swiping</span>
  </div>

  <div style="padding:8px 17px 10px">
    <h1 style="font-size:20px;font-weight:900;letter-spacing:-.3px;margin-bottom:2px">Session results</h1>
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;color:var(--tx5)">Room {{ roomCode }} · {{ memberNames }}</span>
      <div class="pill pill-green" style="font-size:9px;padding:2px 7px">● Live</div>
    </div>
  </div>

  <div class="scroll-area" style="flex:1;padding:0 12px">

    <!-- Full match -->
    <p class="section-header" style="display:flex;align-items:center;gap:5px">
      <svg width="9" height="9" viewBox="0 0 9 9">
        <path d="M4.5 1L5.4 3.5L8 3.7L6.2 5.3L6.8 8L4.5 6.6L2.2 8L2.8 5.3L1 3.7L3.6 3.5Z" fill="#4ADE80"/>
      </svg>
      Matched · everyone agreed
    </p>

    <div class="match-result-card green-card br-lg" style="margin-bottom:10px;overflow:hidden">
      <div class="result-image" [style.background]="fullMatch.restaurant.bg">
        <span style="font-size:46px">{{ fullMatch.restaurant.emoji }}</span>
        <div style="position:absolute;top:8px;right:10px;background:rgba(0,0,0,.5);border-radius:20px;padding:2px 7px;font-size:9px;color:var(--star);font-weight:700">
          ⭐ {{ fullMatch.restaurant.rating }}
        </div>
      </div>
      <div style="padding:10px 13px">
        <div style="font-size:15px;font-weight:800;margin-bottom:3px">{{ fullMatch.restaurant.name }}</div>
        <div style="font-size:10px;color:var(--tx3);margin-bottom:10px">{{ fullMatch.restaurant.cuisine }} · {{ fullMatch.restaurant.dist }} · {{ fullMatch.restaurant.price }}</div>
        <div style="font-size:10px;color:var(--green);font-weight:600;margin-bottom:10px">✓ {{ fullMatch.agreedCount }}/{{ fullMatch.totalCount }} agreed · full match</div>
        <div style="display:flex;gap:7px">
          <button style="flex:1;height:38px;background:rgba(74,222,128,.14);border:.5px solid rgba(74,222,128,.30);border-radius:11px;font-size:11px;font-weight:700;color:var(--green);cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:4px">
            <svg width="10" height="11" viewBox="0 0 10 11">
              <path d="M5 0C3.1 0 1.5 1.7 1.5 3.7C1.5 6.5 5 10.5 5 10.5S8.5 6.5 8.5 3.7C8.5 1.7 6.9 0 5 0Z" fill="#4ADE80"/>
              <circle cx="5" cy="3.7" r="1.5" fill="var(--green-bg)"/>
            </svg>
            Navigate
          </button>
          <button style="flex:1;height:38px;background:rgba(96,165,250,.10);border:.5px solid rgba(96,165,250,.25);border-radius:11px;font-size:11px;font-weight:700;color:var(--blue);cursor:pointer;font-family:inherit">Reserve</button>
        </div>
      </div>
    </div>

    <!-- Partial match -->
    <p class="section-header">Backup match · 2/3 agreed</p>
    <div class="ghost-card br-lg" style="display:flex;align-items:center;gap:9px;padding:10px 12px;margin-bottom:10px">
      <div style="width:42px;height:42px;border-radius:11px;background:var(--card);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">🍜</div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:700;color:var(--tx1)">Noodle House 28</div>
        <div style="font-size:10px;color:var(--tx3);margin-top:1px">Asian Fusion · 1.2 mi · $$</div>
        <div style="font-size:10px;color:var(--tx5);margin-top:3px">Alex & Jamie agreed · Marcus still swiping</div>
      </div>
      <div style="background:rgba(96,165,250,.10);border:.5px solid rgba(96,165,250,.22);border-radius:10px;padding:6px 10px;font-size:10px;color:var(--blue);font-weight:600;cursor:pointer;flex-shrink:0">Map</div>
    </div>

    <!-- Keep swiping -->
    <button class="btn-secondary" style="margin-bottom:8px" (click)="goBack()">
      ← Keep swiping for more options
    </button>

    <!-- End session -->
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
  private state = inject(AppStateService);

  roomCode = this.state.activeRoomCode();
  members = MEMBERS.slice(0, 3);
  memberNames = this.members.map(m => m.username).join(', ');

  fullMatch: SessionMatch = {
    restaurant: RESTAURANTS[2],
    agreedCount: 3,
    totalCount: 3,
    isFull: true,
  };

  goBack(): void { this.router.navigate(['/tabs/swipe']); }
  endSession(): void {
    this.state.endSession();
    this.router.navigate(['/tabs/home']);
  }
}
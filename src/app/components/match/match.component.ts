// ═══════════════════════════════════════════════════════════════
// MATCH SCREEN
// ═══════════════════════════════════════════════════════════════
// src/app/components/match/match.component.ts

import { Component, inject, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { Restaurant } from '../../models/restaurant.model';

@Component({
  selector: 'app-match',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
<div class="match-screen" (click)="keepSwiping()">

  <div class="cf" *ngFor="let c of confetti"
       [style.left]="c.left" [style.top]="c.top"
       [style.background]="c.color"
       [style.border-radius]="c.round ? '50%' : '2px'"
       [style.animation-delay]="c.delay"></div>

  <div class="match-glow"></div>

  <div class="match-content safe-top">
    <p class="match-label">Everyone agreed!</p>

    <div class="match-emoji">{{ match?.emoji }}</div>

    <div class="match-card">
      <h2 class="match-name">{{ match?.name }}</h2>
      <p class="match-sub">{{ match?.cuisine }} · {{ match?.dist }} · {{ match?.price }} · ⭐ {{ match?.rating }}</p>
      <div class="match-members">
        <div class="avatar-stack">
          <div *ngFor="let m of members()"
               class="avatar" [ngClass]="'av-' + m.colorIndex"
               style="width:27px;height:27px;font-size:11px;border-color:#050E06">
            {{ m.initial }}
          </div>
        </div>
        <span class="match-names">{{ memberNames() }}</span>
      </div>
    </div>

    <div class="match-ctas">
      <button class="btn-navigate" (click)="navigate($event)">
        <svg width="12" height="13" viewBox="0 0 12 13">
          <path d="M6 0C3.8 0 2 1.8 2 4C2 7 6 12 6 12S10 7 10 4C10 1.8 8.2 0 6 0Z" fill="#052E16"/>
          <circle cx="6" cy="4" r="1.5" fill="#4ADE80"/>
        </svg>
        Navigate
      </button>
      <button class="btn-results" (click)="goResults($event)">Session results</button>
    </div>

    <button class="btn-backup" (click)="keepSwiping()">
      Keep swiping for a backup →
    </button>

    <p class="dismiss-hint">tap anywhere to dismiss</p>
  </div>
</div>
  `,
  styles: [`
    :host { display:block;height:100%; }
    .match-screen {
      height:100%;display:flex;flex-direction:column;
      background:linear-gradient(160deg,#071A08 0%,#050D14 50%,#0A0712 100%);
      position:relative;overflow:hidden;cursor:pointer;
    }
    .match-glow {
      position:absolute;top:22%;left:50%;transform:translate(-50%,-50%);
      width:280px;height:280px;border-radius:50%;
      background:radial-gradient(circle,rgba(74,222,128,.14) 0%,transparent 70%);
      animation:glow 3s ease-in-out infinite;
    }
    .cf { position:absolute;width:7px;height:7px;animation:cfFall 3s ease-in infinite; }
    .match-content { position:relative;z-index:10;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 22px;text-align:center; }
    .match-label { font-size:10px;font-weight:700;color:#4ADE80;text-transform:uppercase;letter-spacing:.22em;margin-bottom:13px;animation:matchPop .5s ease-out both; }
    .match-emoji { font-size:96px;line-height:1;margin-bottom:14px;filter:drop-shadow(0 0 28px rgba(74,222,128,.32));animation:matchPop .45s cubic-bezier(.22,1.4,.36,1) .1s both; }
    .match-card { width:100%;background:rgba(255,255,255,.05);backdrop-filter:blur(12px);border:.5px solid rgba(74,222,128,.28);border-radius:22px;padding:15px 18px;margin-bottom:14px;animation:matchPop .5s cubic-bezier(.22,1.4,.36,1) .18s both; }
    .match-name { font-size:21px;font-weight:900;letter-spacing:-.4px;color:#F1F5F9;margin-bottom:3px; }
    .match-sub  { font-size:11px;color:#475569;margin-bottom:12px; }
    .match-members { display:flex;align-items:center;justify-content:center;gap:9px; }
    .match-names { font-size:10px;color:#475569; }
    .match-ctas { display:flex;gap:8px;width:100%;margin-bottom:8px;animation:matchPop .5s cubic-bezier(.22,1.4,.36,1) .28s both; }
    .btn-navigate { flex:1;height:47px;background:#4ADE80;border:none;border-radius:13px;font-size:12px;color:#052E16;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px; }
    .btn-results  { flex:1;height:47px;background:rgba(255,255,255,.07);border:.5px solid rgba(255,255,255,.12);border-radius:13px;font-size:12px;color:#94A3B8;font-weight:700;cursor:pointer;font-family:inherit; }
    .btn-backup   { width:100%;height:43px;background:rgba(255,255,255,.04);border:.5px solid rgba(255,255,255,.08);border-radius:13px;font-size:11px;color:#475569;cursor:pointer;font-family:inherit;margin-bottom:12px; }
    .dismiss-hint { font-size:9px;color:#1A2232; }
  `]
})
export class MatchComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private state = inject(AppStateService);

  // Safely grab the match. Uses any to bypass strict type checking if latestMatch isn't fully typed yet.
  match: Restaurant | null = (this.state as any).latestMatch?.() ?? this._lastFromHistory();

  members = this.state.activeMembers;

  confetti = [
    { left: '14%', top: '7%', color: '#4ADE80', round: false, delay: '0s' },
    { left: '76%', top: '5%', color: '#60A5FA', round: true, delay: '.4s' },
    { left: '36%', top: '10%', color: '#F5C518', round: false, delay: '.8s' },
    { left: '86%', top: '14%', color: '#4ADE80', round: true, delay: '1.2s' },
    { left: '10%', top: '18%', color: '#A78BFA', round: false, delay: '1.6s' },
    { left: '60%', top: '8%', color: '#F87171', round: true, delay: '.2s' },
    { left: '26%', top: '6%', color: '#60A5FA', round: false, delay: '1.4s' },
  ];

  ngOnInit(): void { }
  ngOnDestroy(): void { }

  memberNames = computed(() =>
    this.members().map(m => m.username).join(' & ')
  );

  navigate(e: Event): void {
    e.stopPropagation();
    if (this.match?.name) {
      const query = encodeURIComponent(this.match.name);
      // FIXED: Corrected the template literal from 0{query} to ${query}
      window.open(`https://maps.google.com/?q=${query}`, '_blank');
    }
  }

  goResults(e: Event): void {
    e.stopPropagation();
    this.router.navigate(['/session-results']);
  }

  keepSwiping(): void {
    this.router.navigate(['/tabs/swipe']);
  }

  // Fallback: grab the last matched restaurant from state if latestMatch was cleared
  private _lastFromHistory(): Restaurant | null {
    const deck = (this.state as any).deck ? (this.state as any).deck() : [];
    return deck.length > 0 ? deck[0] : null;
  }
}
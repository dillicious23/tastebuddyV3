// ═══════════════════════════════════════════════════════════════
// GROUP DETAIL COMPONENT
// ═══════════════════════════════════════════════════════════════
// src/app/components/group-detail/group-detail.component.ts

import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { ForkupGroup } from '../../models/restaurant.model';
import { generateRoomCode } from '../../data/mock-data';

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
<div class="screen" style="background:var(--surface)">

  <!-- Back -->
  <div class="back-row safe-top">
  <div class="back-pill" (click)="goBack()">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 18l-6-6 6-6"/>
    </svg>
    <span>Groups</span>
  </div>
</div>

  <ng-container *ngIf="group">
    <!-- Header -->
    <div class="gh-header">
      <div class="avatar-stack">
        <div *ngFor="let m of group.members.slice(0,4)"
             class="avatar" [ngClass]="'av-' + m.colorIndex"
             style="width:36px;height:36px;font-size:14px;border-color:var(--surface)">
          {{ m.initial }}
        </div>
      </div>
      <div class="gh-meta">
        <div class="gh-name">{{ shortName }}</div>
        <div class="gh-sub">{{ group.sessions.length }} sessions · {{ matchCount }} matches</div>
      </div>
    </div>

    <div style="padding: 0 12px 10px;">
      <button class="btn-primary" style="width: 100%;" (click)="swipeAgain()">
        Swipe again with this group
      </button>
    </div>

    <!-- Session history -->
    <div class="scroll-area" style="flex:1;padding:0 12px 16px">
      <p class="section-header">Session history</p>

      <div *ngFor="let s of group.sessions" class="session-row ghost-card br-md">
        <div class="session-top">
          <span style="font-size:11px;font-weight:600;color:var(--tx1)">{{ s.timeAgo }}</span>
          <span style="font-size:9px;color:var(--tx7)">Room {{ s.roomCode }}</span>
        </div>

        <!-- Match -->
        <ng-container *ngIf="s.matches[0] && s.matches[0].isFull">
          <div class="session-match">
            <div class="session-icon" [style.background]="s.matches[0].restaurant.bg">
              {{ s.matches[0].restaurant.emoji }}
            </div>
            <div class="session-info">
              <span class="session-name">{{ s.matches[0].restaurant.name }}</span>
              <span class="session-meta">{{ s.matches[0].restaurant.cuisine }} · matched {{ s.matches[0].agreedCount }}/{{ s.matches[0].totalCount }}</span>
            </div>
            <div class="map-btn">Map</div>
          </div>
        </ng-container>

        <!-- No match -->
        <ng-container *ngIf="!s.matches.length || !s.matches[0].isFull">
          <div class="no-match-row">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="5.5" stroke="#334155" stroke-width="1.1"/>
              <path d="M7 4.5V7L9 9" stroke="#334155" stroke-width="1.1" stroke-linecap="round"/>
            </svg>
            <span style="font-size:11px;color:var(--tx6)">No match · session ended</span>
          </div>
        </ng-container>
      </div>
    </div>
  </ng-container>

</div>
  `,
  styles: [`
    // ── Top Bar Pill ──────────────────────────────────────────────
.back-row {
    padding: max(env(safe-area-inset-top), 14px) 16px 6px;
    display: flex;
    align-items: center;
}

.back-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    
    // Glassmorphism effect
    background: rgba(11, 15, 26, 0.70);
    backdrop-filter: blur(14px);
    
    // Border and Shape
    border: 0.5px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    
    // Typography & Color
    color: #E2E8F0;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.2s, opacity 0.2s;

    span {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: -0.2px;
    }

    svg {
        display: block;
        color: var(--tx5);
    }

    &:active {
        opacity: 0.7;
        background: rgba(11, 15, 26, 0.90);
    }
}
    .gh-header { display:flex;align-items:center;gap:10px;padding:8px 16px 10px; }
    .gh-meta   { display:flex;flex-direction:column;gap:1px; }
    .gh-name   { font-size:15px;font-weight:800;color:var(--tx1); }
    .gh-sub    { font-size:10px;color:var(--tx7); }
    .session-row { padding:11px 12px;margin-bottom:8px; }
    .session-top { display:flex;justify-content:space-between;align-items:center;margin-bottom:7px; }
    .session-match { display:flex;align-items:center;gap:10px; }
    .session-icon { width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0; }
    .session-info { flex:1;display:flex;flex-direction:column;gap:1px; }
    .session-name { font-size:12px;font-weight:700;color:var(--tx1); }
    .session-meta { font-size:10px;color:var(--tx3); }
    .map-btn { background:rgba(96,165,250,.10);border:.5px solid rgba(96,165,250,.22);border-radius:9px;padding:5px 10px;font-size:10px;color:var(--blue);font-weight:600;cursor:pointer; }
    .no-match-row { display:flex;align-items:center;gap:7px;opacity:.55; }
  `],
})
export class GroupDetailComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private state = inject(AppStateService);

  group: ForkupGroup | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.group = this.state.groups().find(g => g.id === id) ?? null;
  }

  get shortName(): string {
    if (!this.group) return '';
    const m = this.group.members;
    if (m.length === 1) return m[0].username;
    if (m.length === 2) return `${m[0].username} & ${m[1].username}`;
    return `${m[0].username}, ${m[1].username} & ${m[2].username}`;
  }

  get matchCount(): number {
    return this.group?.sessions.filter(s => s.matches.some(m => m.isFull)).length ?? 0;
  }

  swipeAgain(): void {
    this.state.startSession();
    this.router.navigate(['/tabs/swipe']);
  }

  goBack(): void { this.router.navigate(['/tabs/groups']); }
}
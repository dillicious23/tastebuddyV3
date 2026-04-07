// ═══════════════════════════════════════════════════════════════
// GROUP DETAIL COMPONENT
// ═══════════════════════════════════════════════════════════════
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { ForkupGroup } from '../../models/restaurant.model';

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
<div class="screen" style="background:var(--surface)">

  <div class="back-row safe-top">
    <div class="back-pill" (click)="goBack()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
      <span>Groups</span>
    </div>
  </div>

  <ng-container *ngIf="group">
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

    <div class="scroll-area" style="flex:1;padding:0 12px 16px">
      <p class="section-header">Session history</p>

      <button class="btn-danger" style="margin-top: 24px; margin-bottom: 24px; width: 100%;" 
              (click)="showDeleteConfirm.set(true)">
        Delete group history
      </button>

      <div *ngFor="let s of group.sessions" class="session-row ghost-card br-md">
        
        <div class="session-top" (click)="toggleSession(s.roomCode)" style="cursor: pointer; margin-bottom: 0;">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:13px;font-weight:700;color:var(--tx1)">{{ s.timeAgo }}</span>
            <span style="font-size:10px;color:var(--tx5)">
              Room {{ s.roomCode }} · 
              <span *ngIf="s.matches.length">{{ s.matches.length }} Like{{ s.matches.length === 1 ? '' : 's' }}</span>
              <span *ngIf="!s.matches.length">0 Likes</span>
            </span>
          </div>
          <svg [style.transform]="expandedSession() === s.roomCode ? 'rotate(180deg)' : 'rotate(0deg)'" 
               width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tx5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        <div *ngIf="expandedSession() === s.roomCode" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05);">
          
          <ng-container *ngIf="s.matches.length > 0">
            <div *ngFor="let match of s.matches" class="session-match" style="margin-bottom: 10px;">
              <div class="session-icon" [style.background]="match.restaurant.bg">
                {{ match.restaurant.emoji }}
              </div>
              <div class="session-info">
                <span class="session-name">{{ match.restaurant.name }}</span>
                <span class="session-meta">{{ match.restaurant.cuisine }} · matched {{ match.agreedCount }}/{{ match.totalCount }}</span>
              </div>
              <div class="map-btn" (click)="openMap(match.restaurant)">Map</div>
            </div>
          </ng-container>

          <ng-container *ngIf="!s.matches.length">
            <div class="no-match-row">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <circle cx="7" cy="7" r="5.5" stroke="#334155" stroke-width="1.1"/>
                <path d="M7 4.5V7L9 9" stroke="#334155" stroke-width="1.1" stroke-linecap="round"/>
              </svg>
              <span style="font-size:11px;color:var(--tx6)">No matches in this session</span>
            </div>
          </ng-container>
        </div>

      </div>
    </div>
  </ng-container>

  <div class="sheet-overlay" *ngIf="showDeleteConfirm()" (click)="showDeleteConfirm.set(false)">
    <div class="sheet-body end-dialog" (click)="$event.stopPropagation()">
      <div class="sheet-handle"></div>
      <div class="dialog-emoji" style="font-size: 40px; margin-bottom: 10px; text-align: center;">🗑️</div>
      <h3 class="dialog-title" style="text-align: center; font-size: 18px; font-weight: 800; color: var(--tx1); margin-bottom: 8px;">Delete group history?</h3>
      <p class="dialog-body" style="text-align: center; font-size: 13px; color: var(--tx3); margin-bottom: 24px; padding: 0 10px;">
        This will permanently remove this group and all its past sessions from your device.
      </p>
      <button class="btn-danger" style="margin-bottom:8px; width: 100%;" (click)="doDelete()">Delete group</button>
      <button class="btn-secondary" style="width: 100%; background: var(--card); border: 0.5px solid rgba(255,255,255,0.1); border-radius: 12px; height: 48px; color: var(--tx1); font-weight: 700;" (click)="showDeleteConfirm.set(false)">Cancel</button>
    </div>
  </div>

</div>
  `,
  styles: [`
    .back-row { padding: max(env(safe-area-inset-top), 14px) 16px 6px; display: flex; align-items: center; }
    .back-pill { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: rgba(11, 15, 26, 0.70); backdrop-filter: blur(14px); border: 0.5px solid rgba(255, 255, 255, 0.12); border-radius: 20px; color: #E2E8F0; cursor: pointer; transition: background 0.2s, opacity 0.2s; }
    .back-pill span { font-size: 13px; font-weight: 700; letter-spacing: -0.2px; }
    .back-pill svg { display: block; color: var(--tx5); }
    .back-pill:active { opacity: 0.7; background: rgba(11, 15, 26, 0.90); }
    .gh-header { display:flex;align-items:center;gap:10px;padding:8px 16px 10px; }
    .gh-meta   { display:flex;flex-direction:column;gap:1px; }
    .gh-name   { font-size:15px;font-weight:800;color:var(--tx1); }
    .gh-sub    { font-size:10px;color:var(--tx7); }
    .session-row { padding:11px 12px;margin-bottom:8px; }
    .session-top { display:flex;justify-content:space-between;align-items:center; }
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

  showDeleteConfirm = signal(false);
  group: ForkupGroup | null = null;
  
  // 💥 NEW: Track which session is currently expanded
  expandedSession = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.group = this.state.groups().find(g => g.id === id) ?? null;
  }

  // 💥 NEW: Toggle the accordion open and closed
  toggleSession(roomCode: string): void {
    if (this.expandedSession() === roomCode) {
      this.expandedSession.set(null); // Close it if it's already open
    } else {
      this.expandedSession.set(roomCode); // Open the new one
    }
  }

  openMap(restaurant: any): void {
    const url = `https://maps.google.com/?q=$${restaurant.lat},${restaurant.lng}`;
    window.open(url, '_system');
  }

  doDelete(): void {
    if (this.group?.id) {
      this.state.deleteGroup(this.group.id);
      this.showDeleteConfirm.set(false);
      this.router.navigate(['/tabs/groups'], { replaceUrl: true });
    }
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

  goBack(): void { 
    this.router.navigate(['/tabs/groups']); 
  }
}
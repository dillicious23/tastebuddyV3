// src/app/components/launch/launch.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { RANDOM_USERNAMES } from '../../utils/usernames';

@Component({
  selector: 'app-launch',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  template: `
<div class="launch-screen">
  <div class="glow"></div>

  <div class="content">
    <img src="assets/icon2.png" alt="Tastebuddy Logo" class="custom-app-logo" />
    
    <div class="logo-text">taste<span>buddy</span></div>
    <p class="tagline">Decide where to eat. Together.</p>

    <div class="username-card">
      <p class="label-caps" style="margin-bottom:8px">Your Profile</p>

      <div class="name-row">
        <div class="avatar-container" (click)="cycleAvatar()">
          <div class="otter-avatar">{{ userAvatar() }}</div>
          <div class="edit-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </div>
        </div>

        <div class="input-wrap" [class.focused]="focused()">
          <input #nameInput
                 class="name-input huge-text"
                 type="text"
                 [(ngModel)]="username"
                 (ngModelChange)="username = $event"
                 (focus)="focused.set(true)"
                 (blur)="focused.set(false)"
                 placeholder="Your Name"
                 maxlength="20"/>
          <span class="cursor" *ngIf="focused()"></span>
        </div>
      </div>

      <p class="label-caps" style="margin:10px 0 6px">Or pick one</p>
      <div class="chips">
        <button *ngFor="let s of displaySuggestions()"
                class="chip"
                [class.active]="username === s"
                (click)="pick(s)">{{ s }}</button>
                
        <button class="chip chip-shuffle" (click)="shuffle()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 3 21 3 21 8"></polyline>
            <line x1="4" y1="20" x2="21" y2="3"></line>
            <polyline points="21 16 21 21 16 21"></polyline>
            <line x1="15" y1="15" x2="21" y2="21"></line>
            <line x1="4" y1="4" x2="9" y2="9"></line>
          </svg>
        </button>
      </div>
    </div>

    <p class="no-account">No account needed. Saved to this device.</p>

    <button class="btn-primary" (click)="proceed()">Looks good · let's go →</button>
  </div>
</div>
  `,
  styleUrls: ['./launch.component.scss'],
})
export class LaunchComponent implements OnInit {
  private router = inject(Router);
  private stateService = inject(AppStateService);

  // 💥 NEW: Exact same list from your Profile component
  readonly allAvatars = [
    '🦦', '🐻', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸',
    '🍔', '🍕', '🌮', '🍣', '🥗', '🍦', '🍩', '🥑', '🥞', '🥐',
    '🌶️', '🍜', '🥩', '🍱', '🫕', '🥟',
  ];

  userAvatar = signal<string>(this.allAvatars[0]);
  username = localStorage.getItem('tb_username') || '';
  focused = signal(false);

  // Holds the 3 randomly selected names currently showing in the chips
  displaySuggestions = signal<string[]>([]);

  ngOnInit() {
    if (localStorage.getItem('tb_has_launched')) {
      this.router.navigate(['/tabs/home'], { replaceUrl: true });
    }
    this.refreshSuggestions();
  }

  // 💥 NEW: Cycles through the avatar list on tap
  cycleAvatar(): void {
    const currentIdx = this.allAvatars.indexOf(this.userAvatar());
    const nextIdx = (currentIdx + 1) % this.allAvatars.length;
    this.userAvatar.set(this.allAvatars[nextIdx]);
  }

  // 💥 NEW: Grabs 3 completely random names from your 100+ list
  refreshSuggestions(): void {
    const shuffled = [...RANDOM_USERNAMES].sort(() => 0.5 - Math.random());
    this.displaySuggestions.set(shuffled.slice(0, 3));
  }

  pick(s: string): void {
    this.username = s;
  }

  shuffle(): void {
    this.refreshSuggestions();
    this.username = this.displaySuggestions()[0]; // Auto-select the first new one
  }

  proceed(): void {
    const name = this.username.trim() || this.displaySuggestions()[0];
    this.stateService.setUsername(name);

    // 💥 CRITICAL: Save the chosen avatar so ProfileComponent loads it later!
    localStorage.setItem('userAvatar', this.userAvatar());
    localStorage.setItem('tb_has_launched', 'true');

    this.router.navigate(['/tabs/home'], { replaceUrl: true });
  }
}
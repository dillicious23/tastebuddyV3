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
    <span class="fork-icon">🍽️</span>
    <div class="logo-text">taste<span>buddy</span></div>
    <p class="tagline">Decide where to eat. Together.</p>

    <!-- Username card -->
    <div class="username-card">
      <p class="label-caps" style="margin-bottom:8px">Your username</p>

      <div class="name-row">
        <div class="otter-avatar">🦦</div>

        <!-- Active input — blinking border shows it's ready to type -->
        <div class="input-wrap" [class.focused]="focused()">
          <input #nameInput
                 class="name-input"
                 type="text"
                 [(ngModel)]="username"
                 (ngModelChange)="username = $event"
                 (focus)="focused.set(true)"
                 (blur)="focused.set(false)"
                 maxlength="20"/>
          <span class="cursor" *ngIf="focused()"></span>
        </div>
      </div>

      <p class="label-caps" style="margin:10px 0 6px">Or pick one</p>
      <div class="chips">
        <button *ngFor="let s of suggestions"
                class="chip"
                [class.active]="username === s"
                (click)="pick(s)">{{ s }}</button>
        <button class="chip chip-shuffle" (click)="shuffle()">
          <svg width="9" height="9" viewBox="0 0 9 9">
            <path d="M7.5 4.5A3 3 0 1 1 4.5 1.5M4.5 1.5V0M4.5 1.5L3 3M4.5 1.5L6 3"
                  stroke="#4ADE80" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Shuffle
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
export class LaunchComponent {
  private router = inject(Router);
  private stateService = inject(AppStateService);

  // Pre-populate from localStorage if returning user
  username = localStorage.getItem('tb_username') || '';
  focused = signal(false);
  suggestions = USERNAME_SUGGESTIONS;

  ngOnInit() {
    // Skip if they have already completed this screen
    if (localStorage.getItem('tb_has_launched')) {
      this.router.navigate(['/tabs/home'], { replaceUrl: true });
    }
  }

  pick(s: string): void { this.username = s; }
  shuffle(): void {
    const others = this.suggestions.filter(s => s !== this.username);
    this.username = others[Math.floor(Math.random() * others.length)];
  }

  proceed(): void {
    const name = this.username.trim() || USERNAME_SUGGESTIONS[0];
    this.stateService.setUsername(name);
    localStorage.setItem('tb_has_launched', 'true');
    this.router.navigate(['/tabs/home'], { replaceUrl: true });
  }
}

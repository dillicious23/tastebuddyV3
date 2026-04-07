import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';

const CUISINE_OPTIONS = [
  { id: 'all', label: 'All cuisines', emoji: '🍽️', yelpAlias: '' },
  { id: 'asian', label: 'Asian', emoji: '🍜', yelpAlias: 'asianfusion,chinese,thai,vietnamese,korean' },
  { id: 'italian', label: 'Italian', emoji: '🍕', yelpAlias: 'italian' },
  { id: 'american', label: 'American', emoji: '🍔', yelpAlias: 'newamerican,tradamerican,hotdogs,burgers' },
  { id: 'mexican', label: 'Mexican', emoji: '🌮', yelpAlias: 'mexican,tacos' },
  { id: 'japanese', label: 'Japanese', emoji: '🍣', yelpAlias: 'japanese,sushi' },
  { id: 'healthy', label: 'Healthy', emoji: '🥗', yelpAlias: 'salad,vegetarian,vegan' },
  { id: 'indian', label: 'Indian', emoji: '🍛', yelpAlias: 'indpak' },
  { id: 'coffee', label: 'Coffee & Tea', emoji: '☕', yelpAlias: 'coffee' },
  { id: 'desserts', label: 'Desserts', emoji: '🍩', yelpAlias: 'desserts' },
  { id: 'bakeries', label: 'Bakeries', emoji: '🥐', yelpAlias: 'bakeries' },
];

// Export so YelpService can use it
export function toYelpCategories(selected: string[]): string {
  if (!selected.length || selected.includes('all')) return '';
  return selected
    .map(id => CUISINE_OPTIONS.find(c => c.id === id)?.yelpAlias ?? '')
    .filter(Boolean)
    .join(',');
}

@Component({
  selector: 'app-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  template: `
<div class="screen prefs-screen">

  <div class="back-row safe-top" (click)="goBack()">
    <svg width="14" height="14" viewBox="0 0 14 14">
      <path d="M9 3L5 7l4 4" stroke="#475569" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span style="font-size:11px;color:var(--tx4)">Profile</span>
  </div>

  <!-- ── RADIUS ── -->
  <ng-container *ngIf="type === 'radius'">
    <div class="pref-body">
      <h1 class="pref-title">Search radius</h1>
      <p class="pref-sub">How far to search for restaurants</p>

      <div class="radius-display">
        <span class="radius-val">{{ radius() }}</span>
        <span class="radius-unit">miles</span>
      </div>

      <div class="slider-wrap">
        <input type="range" min="0.5" max="10" step="0.5"
               [value]="radius()"
               (input)="radius.set(+$any($event.target).value)"/>
        <div class="slider-labels">
          <span>0.5 mi</span>
          <span>10 mi</span>
        </div>
      </div>

      <p class="label-caps" style="margin-bottom:10px">Quick select</p>
      <div class="preset-row">
        <button *ngFor="let p of [0.5,1,2,5,10]"
                class="preset-btn"
                [class.active]="radius() === p"
                (click)="radius.set(p)">
          {{ p }}
        </button>
      </div>

      <div class="preview-block">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.5" stroke="#60A5FA" stroke-width="1.1"/>
          <path d="M8 5.5V8L10 10" stroke="#60A5FA" stroke-width="1.1" stroke-linecap="round"/>
        </svg>
        <span>At {{ radius() }} miles: <strong style="color:var(--tx1)">~{{ estimatedCount }} restaurants</strong> available</span>
      </div>

      <button class="btn-primary" (click)="saveRadius()">Save</button>
    </div>
  </ng-container>

  <!-- ── CUISINE ── -->
  <ng-container *ngIf="type === 'cuisine'">
    <div class="pref-body">
      <h1 class="pref-title">Cuisine filters</h1>
      <p class="pref-sub">Only show restaurants that match your taste</p>

      <div class="cuisine-grid">
        <button *ngFor="let c of cuisines"
                class="cuisine-btn"
                [class.active]="selected().includes(c.id)"
                (click)="toggleCuisine(c.id)">
          <span class="cuisine-emoji">{{ c.emoji }}</span>
          <span class="cuisine-label">{{ c.label }}</span>
          <svg *ngIf="selected().includes(c.id)" width="14" height="14" viewBox="0 0 14 14" class="check-icon">
            <circle cx="7" cy="7" r="5.5" fill="var(--green)"/>
            <path d="M4.5 7l2 2 3.5-3.5" stroke="#052E16" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <button class="btn-primary" style="margin-top:16px" (click)="saveCuisine()">
        Save {{ selected().length === 1 && selected()[0] === 'all' ? '(all cuisines)' : '(' + selected().length + ' selected)' }}
      </button>
    </div>
  </ng-container>

</div>
  `,
  styles: [`
    :host { display:block;height:100%; }
    .prefs-screen { display:flex;flex-direction:column;height:100%;background:var(--surface); }
    .back-row { display:flex;align-items:center;gap:5px;padding:max(env(safe-area-inset-top),12px) 16px 0;cursor:pointer; }
    .pref-body { flex:1;padding:18px 20px;display:flex;flex-direction:column;overflow-y:auto; }
    .pref-title { font-size:20px;font-weight:900;letter-spacing:-.3px;margin-bottom:4px;color:var(--tx1); }
    .pref-sub   { font-size:12px;color:var(--tx5);margin-bottom:24px; }
    .radius-display { text-align:center;margin-bottom:20px; }
    .radius-val  { font-size:52px;font-weight:900;color:var(--green);letter-spacing:-1px;line-height:1; }
    .radius-unit { font-size:14px;color:var(--tx5);display:block;margin-top:2px; }
    .slider-wrap { margin-bottom:24px; }
    .slider-labels { display:flex;justify-content:space-between;margin-top:8px;font-size:10px;color:var(--tx5); }
    .preset-row { display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:20px; }
    .preset-btn { height:44px;background:var(--card-alt);border:.5px solid rgba(255,255,255,.07);border-radius:12px;font-size:12px;font-weight:600;color:var(--tx4);cursor:pointer;font-family:inherit;transition:all 100ms;
      &.active { background:rgba(74,222,128,.12);border-color:rgba(74,222,128,.35);color:var(--green);font-weight:700; }
    }
    .preview-block { display:flex;align-items:center;gap:10px;background:rgba(22,32,64,.20);border:.5px solid rgba(96,165,250,.15);border-radius:14px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:var(--tx3); }
    .cuisine-grid { display:grid;grid-template-columns:1fr 1fr;gap:8px; }
    .cuisine-btn { display:flex;align-items:center;gap:9px;background:var(--card-alt);border:.5px solid rgba(255,255,255,.07);border-radius:14px;padding:12px 13px;cursor:pointer;font-family:inherit;text-align:left;position:relative;transition:all 100ms;
      &.active { background:rgba(74,222,128,.10);border-color:rgba(74,222,128,.28); }
    }
    .cuisine-emoji { font-size:20px; }
    .cuisine-label { font-size:12px;font-weight:600;color:var(--tx1);flex:1; }
    .check-icon { position:absolute;top:8px;right:8px; }
  `],
})
export class PreferencesComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private state = inject(AppStateService);

  type = '';
  radius = signal(2);
  selected = signal<string[]>(['all']);
  cuisines = CUISINE_OPTIONS;

  ngOnInit(): void {
    this.type = this.route.snapshot.paramMap.get('type') ?? 'radius';
    this.radius.set(this.state.searchRadius());
    // Load previously saved cuisines
    const saved = this.state.selectedCuisines();
    this.selected.set(saved.length > 0 ? saved : ['all']);
  }

  get estimatedCount(): number {
    return Math.round(this.radius() * 15);
  }

  toggleCuisine(id: string): void {
    if (id === 'all') { this.selected.set(['all']); return; }
    const s = this.selected().filter(x => x !== 'all');
    this.selected.set(s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    if (this.selected().length === 0) this.selected.set(['all']);
  }

  saveRadius(): void {
    this.state.setSearchRadius(this.radius());
    this.router.navigate(['/tabs/profile']);
  }

  saveCuisine(): void {
    // ✅ Actually save — this was the bug, it was missing before
    this.state.setCuisines(this.selected());
    this.router.navigate(['/tabs/profile']);
  }

  goBack(): void { this.router.navigate(['/tabs/profile']); }
}
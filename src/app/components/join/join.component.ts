// src/app/components/join/join.component.ts
import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './join.component.html',
  styleUrls: ['./join.component.scss'],
})
export class JoinComponent {
  private router = inject(Router);

  chars = signal<string[]>([]);
  loading = signal(false);
  error = signal(false);

  readonly PAD = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['A–Z', '0', '⌫'],
  ];

  get displayChars(): (string | null)[] {
    return Array.from({ length: 4 }, (_, i) => this.chars()[i] ?? null);
  }

  boxClass(i: number): string {
    const filled = i < this.chars().length;
    const active = i === this.chars().length;
    if (this.error()) return 'code-box error';
    if (filled) return 'code-box filled';
    if (active) return 'code-box active';
    return 'code-box';
  }

  boxChar(i: number): string {
    if (this.chars()[i]) return this.chars()[i];
    return i === this.chars().length ? '|' : '_';
  }

  tap(key: string): void {
    if (key === '⌫') { this.chars.update(c => c.slice(0, -1)); this.error.set(false); return; }
    if (key === 'A–Z') return; // open alpha keyboard in production
    if (this.chars().length >= 4) return;
    this.error.set(false);
    this.chars.update(c => [...c, key]);
    if (this.chars().length === 4) this.submit();
  }

  async submit(): Promise<void> {
    this.loading.set(true);
    await new Promise(r => setTimeout(r, 900));
    const code = this.chars().join('');
    if (code === '7X4K') {
      this.router.navigate(['/tabs/swipe']);
    } else {
      this.loading.set(false);
      this.error.set(true);
      this.chars.set([]);
    }
  }

  goBack(): void { this.router.navigate(['/tabs/home']); }
}

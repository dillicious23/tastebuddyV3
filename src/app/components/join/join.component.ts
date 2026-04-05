// src/app/components/join/join.component.ts
import { Component, signal, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { Clipboard } from '@capacitor/clipboard';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './join.component.html',
  styleUrls: ['./join.component.scss'],
})
export class JoinComponent implements AfterViewInit {
  private router = inject(Router);
  private state = inject(AppStateService);

  @ViewChild('codeInput') codeInputRef!: ElementRef<HTMLInputElement>;

  code = signal('');
  loading = signal(false);
  error = signal(false);

  ngAfterViewInit(): void {
    // Auto-focus the input so the keyboard opens immediately
    setTimeout(() => this.codeInputRef?.nativeElement.focus(), 150);
  }

  // Derive display chars from the code string
  get chars(): string[] {
    return this.code().toUpperCase().slice(0, 4).split('');
  }

  // 💥 UPGRADED: Uses native Capacitor Clipboard for Android/iOS support
  async handlePaste() {
    try {
      // Ask the native phone OS for the clipboard contents directly
      const { value } = await Clipboard.read();
      const text = value || '';

      const match = text.match(/([A-Z0-9]{4})\/?$/i);

      if (match) {
        this.code.set(match[1].toUpperCase());
        this.error.set(false);
        this.submit(); // Auto-join!
      } else {
        alert('We couldn\'t find a valid link in your clipboard. Make sure you copied it!');
      }
    } catch (err) {
      console.error('Could not read clipboard', err);
      alert('Failed to read the clipboard. Please try typing the code manually.');
    }
  }

  boxClass(i: number): string {
    const len = this.chars.length;
    const filled = i < len;
    const active = i === len;
    if (this.error()) return 'code-box error';
    if (filled) return 'code-box filled';
    if (active) return 'code-box active';
    return 'code-box';
  }

  boxChar(i: number): string {
    return this.chars[i] ?? (i === this.chars.length ? '|' : '_');
  }

  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    this.code.set(clean);
    this.error.set(false);

    if (clean.length === 4) {
      this.submit();
    }
  }

  async submit(): Promise<void> {
    const code = this.code();
    if (code.length < 4 || this.loading()) return;

    this.loading.set(true);
    const success = await this.state.joinSession(code);
    this.loading.set(false);

    if (success) {
      this.router.navigate(['/tabs/swipe']);
    } else {
      this.error.set(true);
      this.code.set('');
      setTimeout(() => this.codeInputRef?.nativeElement.focus(), 50);
    }
  }

  focusInput(): void {
    this.codeInputRef?.nativeElement.focus();
  }

  goBack(): void { this.router.navigate(['/tabs/home']); }
}

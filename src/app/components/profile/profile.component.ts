// src/app/components/profile/profile.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { USERNAME_SUGGESTIONS } from '../../data/mock-data';
import { FirebaseSessionService } from '../../services/firebase-session.service';
import { ToastController } from '@ionic/angular';
import { copyToClipboard } from '../../utils/clipboard';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent {
  private router = inject(Router);
  readonly state = inject(AppStateService);
  private fb = inject(FirebaseSessionService);
  private toastController = inject(ToastController);

  codeCopied = signal(false);

  async copyFriendCode() {
    const code = this.state.friendCode; // This is a standard variable, not a Signal!
    if (!code) return;

    try {
      // 1. Copy to clipboard
      const success = await copyToClipboard(code);
      if (!success) return;

      // 2. Show a success toast
      const toast = await this.toastController.create({
        message: 'Friend Code copied to clipboard!',
        duration: 2000,
        cssClass: 'custom-toast',
        position: 'top',
        icon: 'checkmark-circle'
      });
      await toast.present();
    } catch (e) {
      console.error('Failed to copy friend code', e);
    }
  }


  readonly allAvatars = [
    '🦦', '🐻', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸',
    '🍔', '🍕', '🌮', '🍣', '🥗', '🍦', '🍩', '🥑', '🥞', '🥐',
    '🌶️', '🍜', '🥩', '🍱', '🫕', '🥟',
  ];

  userAvatar = signal<string>(localStorage.getItem('userAvatar') || '🦦');
  showAvatarPicker = signal(false);

  editing = signal(false);
  editedName = signal('');
  // notificationsOn = signal(true);

  readonly suggestions = USERNAME_SUGGESTIONS;

  openAvatarPicker(): void { this.showAvatarPicker.set(true); }
  closeAvatarPicker(): void { this.showAvatarPicker.set(false); }

  togglePrice(tier: string): void {
    const current = [...this.state.priceFilter()];
    const idx = current.indexOf(tier);
    if (idx > -1) {
      if (current.length > 1) current.splice(idx, 1);
    } else {
      current.push(tier);
    }
    this.state.setPriceFilter(current.sort());
  }

  selectAvatar(avatar: string): void {
    this.userAvatar.set(avatar);
    localStorage.setItem('userAvatar', avatar);
    this.showAvatarPicker.set(false);
  }

  startEdit(): void {
    this.editedName.set(this.state.username());
    this.editing.set(true);
  }

  saveEdit(): void {
    const name = this.editedName().trim();
    if (name) this.state.setUsername(name);
    this.editing.set(false);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  pickSuggestion(s: string): void {
    this.editedName.set(s);
  }

  shuffle(): void {
    const others = this.suggestions.filter(s => s !== this.editedName());
    this.editedName.set(others[Math.floor(Math.random() * others.length)]);
  }

  goPreferences(type: string): void {
    this.router.navigate(['/tabs/preferences', type]);
  }

  get radiusLabel(): string {
    return `${this.state.searchRadius()} miles`;
  }

  get cuisineLabel(): string {
    const cuisines = this.state.selectedCuisines();
    if (!cuisines || cuisines.length === 0 || cuisines.includes('all')) return 'All';
    if (cuisines.length === 1) return cuisines[0].charAt(0).toUpperCase() + cuisines[0].slice(1);
    return `${cuisines.length} selected`;
  }
}
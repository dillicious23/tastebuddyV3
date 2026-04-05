// src/app/components/profile/profile.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { USERNAME_SUGGESTIONS } from '../../data/mock-data';

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

  readonly avatars = ['🍔', '🍕', '🌮', '🍣', '🥗', '🍦', '🍩', '🥑', '🥞', '🥐'];
  userAvatar = signal(localStorage.getItem('userAvatar') || this.avatars[Math.floor(Math.random() * this.avatars.length)]);

  editing = signal(false);
  editedName = signal('');
  locationOn = signal(true);
  notificationsOn = signal(true);

  readonly suggestions = USERNAME_SUGGESTIONS;

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
}

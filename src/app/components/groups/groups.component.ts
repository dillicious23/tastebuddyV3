// src/app/components/groups/groups.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AppStateService } from '../../services/app-state.service';
import { ForkupGroup, GroupMember, SessionMatch } from '../../models/restaurant.model';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './groups.component.html',
  styleUrls: ['./groups.component.scss'],
})
export class GroupsComponent {
  private router = inject(Router);
  readonly state = inject(AppStateService);

  get groups(): ForkupGroup[] { return this.state.groups(); }
  get isEmpty(): boolean { return this.groups.length === 0; }

  getShortName(members: GroupMember[]): string {
    if (members.length === 1) return members[0].username;
    if (members.length === 2) return `${members[0].username} & ${members[1].username}`;
    return `${members[0].username}, ${members[1].username} & ${members[2].username}`;
  }

  getLastMatch(group: ForkupGroup): SessionMatch | null {
    for (const s of group.sessions) {
      const full = s.matches.find(m => m.isFull);
      if (full) return full;
    }
    return null;
  }

  goDetail(id: string): void {
    this.router.navigate(['/tabs/groups', id]);
  }

  startSession(): void { this.router.navigate(['/tabs/home']); }
  goJoin(): void { this.router.navigate(['/join']); }
  rejoin(): void { this.router.navigate(['/tabs/swipe']); }
}

// src/app/services/app-state.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { AppState, GroupMember, ForkupGroup } from '../models/restaurant.model';
import { INITIAL_STATE, generateRoomCode } from '../data/mock-data';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  // Reactive signals — all components read from these
  private _state = signal<AppState>({ ...INITIAL_STATE });

  // Public selectors
  readonly state = this._state.asReadonly();
  readonly username = computed(() => this._state().username);
  readonly hasActiveSession = computed(() => this._state().hasActiveSession);
  readonly activeRoomCode = computed(() => this._state().activeRoomCode);
  readonly activeMembers = computed(() => this._state().activeMembers);
  readonly matchCount = computed(() => this._state().matchCount);
  readonly isSolo = computed(() => this._state().isSolo);
  readonly isWaiting = computed(() => this._state().isWaiting ?? false);
  readonly groups = computed(() => this._state().groups);
  readonly searchRadius = computed(() => this._state().searchRadius);

  startSession(): string {
    const code = generateRoomCode();
    this._state.update(s => ({
      ...s,
      hasActiveSession: true,
      isWaiting: true,
      activeRoomCode: code,
      matchCount: 0,
    }));
    return code;
  }

  startSwiping(): void {
    this._state.update(s => ({ ...s, isWaiting: false }));
  }

  endSession(): void {
    this._state.update(s => ({
      ...s,
      hasActiveSession: false,
      activeRoomCode: '',
      matchCount: 0,
    }));
  }

  setUsername(name: string): void {
    this._state.update(s => ({ ...s, username: name }));
  }

  setSearchRadius(radius: number): void {
    this._state.update(s => ({ ...s, searchRadius: radius }));
  }

  addMatch(): void {
    this._state.update(s => ({ ...s, matchCount: s.matchCount + 1 }));
  }

  friendJoined(member: GroupMember): void {
    this._state.update(s => ({
      ...s,
      isSolo: false,
      activeMembers: [...s.activeMembers, member],
    }));
  }
}

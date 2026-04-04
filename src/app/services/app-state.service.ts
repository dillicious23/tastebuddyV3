// src/app/services/app-state.service.ts
import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GroupMember, ForkupGroup, AppState, Restaurant } from '../models/restaurant.model';
import { generateRoomCode, RESTAURANTS } from '../data/mock-data';
import { FirebaseSessionService, DbRoom, DbMember } from './firebase-session.service';

// ── Persistent device identity (survives page refresh) ──────────
function getOrCreateUid(): string {
  let uid = localStorage.getItem('tb_uid');
  if (!uid) {
    uid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('tb_uid', uid);
  }
  return uid;
}

function getStoredUsername(): string {
  return localStorage.getItem('tb_username') ?? '';
}

// ── Group history persistence ───────────────────────────────────
const GROUPS_KEY = 'tb_groups';

function loadGroups(): ForkupGroup[] {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ForkupGroup[];
    // Restore Date objects (JSON serialises them as strings)
    return parsed.map(g => ({
      ...g,
      sessions: g.sessions.map(s => ({
        ...s,
        date: new Date(s.date),
      })),
    }));
  } catch {
    return [];
  }
}

function saveGroups(groups: ForkupGroup[]): void {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

// ── Blank starting state (no prefilled data) ────────────────────
const BLANK_STATE: AppState = {
  username: getStoredUsername(),
  hasActiveSession: false,
  isWaiting: false,
  activeRoomCode: '',
  activeMembers: [],
  matchCount: 0,
  isSolo: true,
  searchRadius: 2,
  groups: loadGroups(),  // ← restored from localStorage
};

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly fb = inject(FirebaseSessionService);

  // Device identity
  readonly myUid = getOrCreateUid();

  // Reactive signals
  private _state = signal<AppState>({ ...BLANK_STATE });

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

  // Live deck from DB
  readonly deck = signal<Restaurant[]>([...RESTAURANTS]);

  // Match info for match screen
  readonly latestMatch = signal<Restaurant | null>(null);

  // Room listener subscription
  private _roomSub: Subscription | null = null;

  // ── Room listener ────────────────────────────────────────────
  listenToRoom(code: string): void {
    this._roomSub?.unsubscribe();
    this._roomSub = this.fb.listenRoom$(code).subscribe(room => {
      if (!room) return;

      const members = this._dbMembersToGroupMembers(room.members ?? {});
      const matchCount = Object.values(room.matches ?? {})
        .filter(m => m.isFull).length;

      // Find the latest full match restaurant
      const fullMatches = Object.values(room.matches ?? {}).filter(m => m.isFull);
      if (fullMatches.length > 0) {
        const lastMatch = fullMatches[fullMatches.length - 1];
        const restaurant = (room.restaurants ?? {})[lastMatch.restaurantId];
        if (restaurant) this.latestMatch.set(restaurant);
      }

      // Update deck from DB
      const dbRestaurants = Object.values(room.restaurants ?? {});
      if (dbRestaurants.length > 0) this.deck.set(dbRestaurants);

      this._state.update(s => ({
        ...s,
        activeMembers: members,
        isSolo: members.length <= 1,
        matchCount,
        isWaiting: room.status === 'waiting',
        hasActiveSession: room.status !== 'ended',
      }));
    });
  }

  stopListening(): void {
    this._roomSub?.unsubscribe();
    this._roomSub = null;
  }

  // ── Create session ───────────────────────────────────────────
  async startSession(): Promise<string> {
    const code = generateRoomCode();
    await this.fb.createRoom(code, this.myUid, this._state().username);

    this._state.update(s => ({
      ...s,
      hasActiveSession: true,
      isWaiting: true,
      activeRoomCode: code,
      matchCount: 0,
      activeMembers: [{
        initial: s.username[0]?.toUpperCase() ?? 'U',
        colorIndex: 0,
        username: s.username,
      }],
      isSolo: true,
    }));

    this.listenToRoom(code);
    return code;
  }

  // ── Join session ─────────────────────────────────────────────
  async joinSession(code: string): Promise<boolean> {
    const room = await this.fb.joinRoom(code, this.myUid, this._state().username);
    if (!room) return false;

    const members = this._dbMembersToGroupMembers(room.members);
    this._state.update(s => ({
      ...s,
      hasActiveSession: true,
      isWaiting: room.status === 'waiting',
      activeRoomCode: code,
      matchCount: 0,
      activeMembers: members,
      isSolo: members.length <= 1,
    }));

    this.listenToRoom(code);
    return true;
  }

  // ── Start swiping ────────────────────────────────────────────
  async startSwiping(): Promise<void> {
    const code = this._state().activeRoomCode;
    if (code) await this.fb.setStatus(code, 'swiping');
    this._state.update(s => ({ ...s, isWaiting: false }));
  }

  // ── Record swipe ─────────────────────────────────────────────
  async recordSwipe(restaurantId: string, dir: 'yes' | 'no'): Promise<void> {
    const code = this._state().activeRoomCode;
    if (!code) return;
    await this.fb.recordSwipe(code, this.myUid, restaurantId, dir);
  }

  // ── End session ──────────────────────────────────────────────
  async endSession(): Promise<void> {
    const s = this._state();
    const code = s.activeRoomCode;

    // Snapshot the room from Firebase before clearing so we can save matches
    let room = null;
    if (code) {
      try { room = await this.fb.getRoom(code); } catch { /* ignore */ }
      await this.fb.endRoom(code);
    }
    this.stopListening();

    // Build a PastSession from the live Firebase data
    if (code && s.activeMembers.length > 0) {
      const fullMatches = Object.values(room?.matches ?? {})
        .filter(m => m.isFull)
        .map(m => ({
          restaurant: (room?.restaurants ?? {})[m.restaurantId],
          agreedCount: m.agreedCount,
          totalCount: m.totalCount,
          isFull: true,
        }))
        .filter(m => !!m.restaurant);

      const pastSession = {
        date: new Date(),
        roomCode: code,
        matches: fullMatches,
        timeAgo: 'just now',
      };

      // Find or create a group matching these members
      const usernameKey = s.activeMembers.map(m => m.username).sort().join(',');
      const currentGroups = this._state().groups;
      const existingIdx = currentGroups.findIndex(g =>
        g.members.map(m => m.username).sort().join(',') === usernameKey
      );

      let updatedGroups: ForkupGroup[];
      if (existingIdx >= 0) {
        // Prepend the new session to the existing group
        updatedGroups = currentGroups.map((g, i) =>
          i === existingIdx
            ? { ...g, isLive: false, sessions: [pastSession, ...g.sessions] }
            : g
        );
      } else {
        // Create a new group entry
        const newGroup: ForkupGroup = {
          id: code,
          members: s.activeMembers,
          isLive: false,
          sessions: [pastSession],
        };
        updatedGroups = [newGroup, ...currentGroups];
      }

      saveGroups(updatedGroups);
      this._state.update(st => ({ ...st, groups: updatedGroups }));
    }

    // Clear active session state
    this._state.update(st => ({
      ...st,
      hasActiveSession: false,
      isWaiting: false,
      activeRoomCode: '',
      matchCount: 0,
      activeMembers: [],
      isSolo: true,
    }));
  }

  // ── Username ─────────────────────────────────────────────────
  setUsername(name: string): void {
    localStorage.setItem('tb_username', name);
    this._state.update(s => ({ ...s, username: name }));
  }

  // ── Search radius ────────────────────────────────────────────
  setSearchRadius(radius: number): void {
    this._state.update(s => ({ ...s, searchRadius: radius }));
  }

  // ── Legacy helpers (still used by some components) ──────────
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

  // ── Private helpers ──────────────────────────────────────────
  private _dbMembersToGroupMembers(dbMembers: { [uid: string]: DbMember }): GroupMember[] {
    return Object.values(dbMembers ?? {})
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map(m => ({
        initial: m.initial,
        colorIndex: m.colorIndex,
        username: m.username,
      }));
  }
}

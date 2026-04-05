import { Injectable, signal, computed, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { GroupMember, ForkupGroup, AppState, Restaurant, SessionMatch } from '../models/restaurant.model';
import { generateRoomCode, RESTAURANTS } from '../data/mock-data';
import { FirebaseSessionService, DbMember } from './firebase-session.service';

// ── Persistent device identity ──────────
function getOrCreateUid(): string {
  let uid = localStorage.getItem('tb_uid');
  if (!uid) { uid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('tb_uid', uid); }
  return uid;
}
function getStoredUsername(): string { return localStorage.getItem('tb_username') ?? ''; }

// ── Group history persistence ──────────
const GROUPS_KEY = 'tb_groups';
function loadGroups(): ForkupGroup[] {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as ForkupGroup[]).map(g => ({
      ...g, sessions: g.sessions.map(s => ({ ...s, date: new Date(s.date) }))
    }));
  } catch { return []; }
}
function saveGroups(groups: ForkupGroup[]): void { localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); }

const BLANK_STATE: AppState = {
  username: getStoredUsername(), hasActiveSession: false, isWaiting: false, activeRoomCode: '', activeMembers: [], matchCount: 0, isSolo: true, searchRadius: 2, groups: loadGroups()
};

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly fb = inject(FirebaseSessionService);

  readonly myUid = getOrCreateUid();
  private _state = signal<AppState>({ ...BLANK_STATE });

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

  readonly deck = signal<Restaurant[]>([...RESTAURANTS]);
  readonly latestMatch = signal<Restaurant | null>(null);

  // NEW: Live signals for the results screen
  readonly liveMatches = signal<SessionMatch[]>([]);
  readonly partialMatches = signal<SessionMatch[]>([]);

  private _seenMatchIds = new Set<string>();
  private _roomSub: Subscription | null = null;

  listenToRoom(code: string): void {
    this._roomSub?.unsubscribe();
    this._roomSub = this.fb.listenRoom$(code).subscribe(room => {
      if (!room) return;

      const members = this._dbMembersToGroupMembers(room.members ?? {});
      const memberCount = Object.keys(room.members ?? {}).length;

      // Map raw Firebase matches to our UI model
      const allMatches: SessionMatch[] = Object.values(room.matches ?? {})
        .map(m => ({
          restaurant: (room.restaurants ?? {})[m.restaurantId],
          agreedCount: m.agreedCount,
          totalCount: m.totalCount,
          isFull: m.isFull
        }))
        .filter(m => !!m.restaurant);

      const fullMatches = allMatches.filter(m => m.isFull);
      const partialMatches = allMatches.filter(m => !m.isFull && m.agreedCount > 0).sort((a, b) => b.agreedCount - a.agreedCount);

      this.liveMatches.set(fullMatches);
      this.partialMatches.set(partialMatches);

      // Trigger the pop-up if a new match occurred
      for (const m of fullMatches) {
        if (!this._seenMatchIds.has(m.restaurant.id) && memberCount >= 2) {
          this._seenMatchIds.add(m.restaurant.id);
          this.latestMatch.set(m.restaurant);
        }
      }

      const dbRestaurants = Object.values(room.restaurants ?? {});

      if (dbRestaurants.length > 0) {
        // 💥 THE FIX: Object.values() shuffles randomly on every snapshot!
        // We check if we already have these specific restaurants in our deck.
        // If we do, we completely ignore the incoming array to keep the card order perfectly stable.
        const firstIncomingId = dbRestaurants[0].id;
        const alreadyLoaded = this.deck().some(r => r.id === firstIncomingId);

        if (!alreadyLoaded) {
          this.deck.set(dbRestaurants);
        }
      }

      this._state.update(s => ({
        ...s,
        activeMembers: members,
        isSolo: memberCount <= 1,
        matchCount: fullMatches.length,
        isWaiting: room.status === 'waiting',
        hasActiveSession: room.status !== 'ended'
      }));
    });
  }

  stopListening(): void {
    this._roomSub?.unsubscribe();
    this._roomSub = null;
    this._seenMatchIds.clear();
    this.latestMatch.set(null);
    this.liveMatches.set([]);
    this.partialMatches.set([]);
  }

  async startSession(lat: number = 33.4152, lng: number = -111.8315): Promise<string> {
    const code = generateRoomCode();

    await this.fb.createRoom(code, this.myUid, this._state().username, lat, lng, this._state().searchRadius);

    this._state.update(s => ({
      ...s,
      hasActiveSession: true,
      isWaiting: true,
      activeRoomCode: code,
      matchCount: 0,
      activeMembers: [{ initial: s.username[0]?.toUpperCase() ?? 'U', colorIndex: 0, username: s.username }],
      isSolo: true
    }));

    this.listenToRoom(code);
    return code;
  }

  async joinSession(code: string): Promise<boolean> {
    const room = await this.fb.joinRoom(code, this.myUid, this._state().username);
    if (!room) return false;
    const members = this._dbMembersToGroupMembers(room.members);
    this._state.update(s => ({ ...s, hasActiveSession: true, isWaiting: room.status === 'waiting', activeRoomCode: code, matchCount: 0, activeMembers: members, isSolo: members.length <= 1 }));
    this.listenToRoom(code);
    return true;
  }

  async startSwiping(): Promise<void> {
    const code = this._state().activeRoomCode;
    if (code) await this.fb.setStatus(code, 'swiping');
    this._state.update(s => ({ ...s, isWaiting: false }));
  }

  async recordSwipe(restaurantId: string, dir: 'yes' | 'no'): Promise<void> {
    const code = this._state().activeRoomCode;
    if (!code) return;
    await this.fb.recordSwipe(code, this.myUid, restaurantId, dir);
  }

  async endSession(): Promise<void> {
    const s = this._state();
    const code = s.activeRoomCode;

    if (code) { await this.fb.endRoom(code); }

    // Save to history using actual liveMatches array!
    if (code && s.activeMembers.length > 0) {
      const pastSession = { date: new Date(), roomCode: code, matches: this.liveMatches(), timeAgo: 'just now' };
      const usernameKey = s.activeMembers.map(m => m.username).sort().join(',');
      const currentGroups = this._state().groups;
      const existingIdx = currentGroups.findIndex(g => g.members.map(m => m.username).sort().join(',') === usernameKey);

      let updatedGroups: ForkupGroup[];
      if (existingIdx >= 0) {
        updatedGroups = currentGroups.map((g, i) => i === existingIdx ? { ...g, isLive: false, sessions: [pastSession, ...g.sessions] } : g);
      } else {
        updatedGroups = [{ id: code, members: s.activeMembers, isLive: false, sessions: [pastSession] }, ...currentGroups];
      }
      saveGroups(updatedGroups);
      this._state.update(st => ({ ...st, groups: updatedGroups }));
    }

    this.stopListening();
    this._state.update(st => ({ ...st, hasActiveSession: false, isWaiting: false, activeRoomCode: '', matchCount: 0, activeMembers: [], isSolo: true }));
  }

  setUsername(name: string): void { localStorage.setItem('tb_username', name); this._state.update(s => ({ ...s, username: name })); }
  setSearchRadius(radius: number): void { this._state.update(s => ({ ...s, searchRadius: radius })); }
  addMatch(): void { this._state.update(s => ({ ...s, matchCount: s.matchCount + 1 })); }
  friendJoined(member: GroupMember): void { this._state.update(s => ({ ...s, isSolo: false, activeMembers: [...s.activeMembers, member] })); }

  private _dbMembersToGroupMembers(dbMembers: { [uid: string]: DbMember }): GroupMember[] {
    return Object.values(dbMembers ?? {}).sort((a, b) => a.joinedAt - b.joinedAt).map(m => ({ initial: m.initial, colorIndex: m.colorIndex, username: m.username }));
  }
}
import { Injectable, signal, computed, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { GroupMember, ForkupGroup, AppState, Restaurant, SessionMatch } from '../models/restaurant.model';
import { generateRoomCode, RESTAURANTS } from '../data/mock-data';
import { FirebaseSessionService, DbMember } from './firebase-session.service';
import { toYelpCategories } from '../components/preferences/preferences.component';

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

// ── Stats Persistence ──────────────────────────────────────────
const SWIPES_KEY = 'tb_total_swipes';
function getStoredSwipes(): number { return parseInt(localStorage.getItem(SWIPES_KEY) ?? '0'); }

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
  readonly lastLocation = signal<{ lat: number, lng: number } | null>(null);
  readonly lastRestaurants = signal<any[]>([]);
  readonly lastFetchRadius = signal<number>(0);
  readonly lastFetchCuisines = signal<string>('');

  readonly deck = signal<Restaurant[]>([...RESTAURANTS]);
  readonly latestMatch = signal<Restaurant | null>(null);

  readonly isDataStale = computed(() => {
    const currentRadius = this.searchRadius();

    // 💥 FIX: Check the translated string!
    const currentCuisines = this.yelpCategoryString();
    const currentOpenNow = this.openNow();
    const currentPrice = this.priceFilter().join(',');

    const oldRadius = this.lastFetchRadius();

    // 💥 FIX: This is now a simple string, no need to .join()
    const oldCuisines = this.lastFetchCuisines();
    const oldOpenNow = this.lastFetchOpenNow();
    const oldPrice = this.lastFetchPrice();

    if (oldRadius === 0) return false;

    return currentRadius !== oldRadius || currentCuisines !== oldCuisines || currentOpenNow !== oldOpenNow || currentPrice !== oldPrice;
  });

  readonly yelpCategoryString = computed(() => toYelpCategories(this.selectedCuisines()));

  // NEW: Live signals for the results screen
  readonly liveMatches = signal<SessionMatch[]>([]);
  readonly partialMatches = signal<SessionMatch[]>([]);

  // 💥 NEW: Automatically extract a unique list of friends from your past sessions
  readonly knownFriends = computed(() => {
    const friendsMap = new Map<string, GroupMember>();

    // Loop through all your past groups
    for (const group of this.groups()) {
      for (const m of group.members) {
        // Don't add yourself, and ensure they have a UID recorded
        if (m.uid && m.uid !== this.myUid) {
          friendsMap.set(m.uid, m);
        }
      }
    }

    // Return them sorted alphabetically by username
    return Array.from(friendsMap.values()).sort((a, b) => a.username.localeCompare(b.username));
  });

  private _seenMatchIds = new Set<string>();
  private _roomSub: Subscription | null = null;

  // 💥 NEW: Global Stats Tracking
  readonly totalSwipes = signal<number>(getStoredSwipes());

  // Derived stats from group history
  readonly totalMatches = computed(() => {
    return this.groups().reduce((acc, g) => acc + g.sessions.reduce((sAcc, s) => sAcc + s.matches.length, 0), 0);
  });

  readonly totalSessions = computed(() => {
    return this.groups().reduce((acc, g) => acc + g.sessions.length, 0);
  });

  // 💥 NEW: Cuisine Filter State
  readonly selectedCuisines = signal<string[]>(JSON.parse(localStorage.getItem('tb_cuisines') ?? '[]'));
  readonly openNow = signal<boolean>(localStorage.getItem('tb_openNow') === 'true');
  readonly priceFilter = signal<string[]>(JSON.parse(localStorage.getItem('tb_price') ?? '["1","2","3","4"]'));

  readonly lastFetchOpenNow = signal<boolean>(false);
  readonly lastFetchPrice = signal<string>('');

  setOpenNow(val: boolean): void {
    this.openNow.set(val);
    localStorage.setItem('tb_openNow', String(val));
  }

  setPriceFilter(list: string[]): void {
    this.priceFilter.set(list);
    localStorage.setItem('tb_price', JSON.stringify(list));
  }


  // Call this from recordSwipe() to increment your global total
  incrementSwipes(): void {
    const newVal = this.totalSwipes() + 1;
    this.totalSwipes.set(newVal);
    localStorage.setItem(SWIPES_KEY, newVal.toString());
  }

  setCuisines(list: string[]): void {
    this.selectedCuisines.set(list);
    localStorage.setItem('tb_cuisines', JSON.stringify(list));
  }

  listenToRoom(code: string): void {
    this._roomSub?.unsubscribe();
    this._roomSub = this.fb.listenRoom$(code).subscribe(room => {
      if (!room) return;

      const wasActive = this._state().hasActiveSession;
      const isEnded = room.status === 'ended';

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
        hasActiveSession: !isEnded // 💥 Switch to !isEnded
      }));

      // 💥 NEW: If someone else ended the room, save it locally!
      if (wasActive && isEnded) {
        this._saveCurrentGroupToHistory(code, members, fullMatches);
        this.stopListening();
        this._state.update(st => ({ ...st, activeRoomCode: '', matchCount: 0, activeMembers: [], isSolo: true }));
      }
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

  async startSession(lat: number = 33.4152, lng: number = -111.8315, existingCode?: string): Promise<string> {
    // 💥 Use the passed code if it exists, otherwise generate a new one
    const code = existingCode || generateRoomCode();

    await this.fb.createRoom(
      code,
      this.myUid,
      this._state().username,
      lat,
      lng,
      this._state().searchRadius,
      this.yelpCategoryString(), // 💥 FIX: Send the actual aliases to Firebase
      this.openNow(),
      this.priceFilter()
    );

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

  deleteGroup(groupId: string): void {
    const currentGroups = this._state().groups;
    const updatedGroups = currentGroups.filter(g => g.id !== groupId);

    saveGroups(updatedGroups); // Updates localStorage
    this._state.update(s => ({ ...s, groups: updatedGroups })); // Updates UI
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

    this._saveCurrentGroupToHistory(code ?? '', s.activeMembers, this.liveMatches());

    this.stopListening();
    this._state.update(st => ({ ...st, hasActiveSession: false, isWaiting: false, activeRoomCode: '', matchCount: 0, activeMembers: [], isSolo: true }));
  }

  setUsername(name: string): void { localStorage.setItem('tb_username', name); this._state.update(s => ({ ...s, username: name })); }
  setSearchRadius(radius: number): void { this._state.update(s => ({ ...s, searchRadius: radius })); }
  addMatch(): void { this._state.update(s => ({ ...s, matchCount: s.matchCount + 1 })); }
  friendJoined(member: GroupMember): void { this._state.update(s => ({ ...s, isSolo: false, activeMembers: [...s.activeMembers, member] })); }

  private _saveCurrentGroupToHistory(code: string, activeMembers: GroupMember[], liveMatches: SessionMatch[]) {
    if (!code || activeMembers.length === 0) return;
    const pastSession = { date: new Date(), roomCode: code, matches: liveMatches, timeAgo: 'just now' };
    const usernameKey = activeMembers.map(m => m.username).sort().join(',');
    const currentGroups = this._state().groups;
    const existingIdx = currentGroups.findIndex(g => g.members.map(m => m.username).sort().join(',') === usernameKey);

    let updatedGroups: ForkupGroup[];
    if (existingIdx >= 0) {
      updatedGroups = currentGroups.map((g, i) => i === existingIdx ? { ...g, isLive: false, sessions: [pastSession, ...g.sessions] } : g);
    } else {
      updatedGroups = [{ id: code, members: activeMembers, isLive: false, sessions: [pastSession] }, ...currentGroups];
    }
    saveGroups(updatedGroups);
    this._state.update(st => ({ ...st, groups: updatedGroups }));
  }

  private _dbMembersToGroupMembers(dbMembers: { [uid: string]: DbMember }): GroupMember[] {
    // 💥 FIX: Use Object.entries to grab the hidden UID key from the database object
    return Object.entries(dbMembers ?? {})
      .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
      .map(([uid, m]) => ({
        uid: uid, // Capture the push notification ID!
        initial: m.initial,
        colorIndex: m.colorIndex,
        username: m.username,
        avatar: m.avatar // 💥 CRITICAL: Bring the avatar across from Firebase!
      }));
  }
}
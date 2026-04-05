// src/app/services/firebase-session.service.ts
// All Firestore reads/writes for TasteBuddy sessions.

import { inject, Injectable } from '@angular/core';
import {
  collection, doc, setDoc, updateDoc, getDoc, getDocs,
  onSnapshot, Unsubscribe, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from '../core/firebase';
import { GroupMember, Restaurant } from '../models/restaurant.model';
import { RESTAURANTS } from '../data/mock-data';
import { YelpService } from './yelp.service';

// ── Firestore document shapes ────────────────────────────────────
export interface DbMember {
  username: string;
  initial: string;
  colorIndex: 0 | 1 | 2 | 3;
  joinedAt: number;
}

export interface DbMatch {
  restaurantId: string;
  agreedCount: number;
  totalCount: number;
  isFull: boolean;
}

export interface DbRoom {
  hostId: string;
  status: 'waiting' | 'swiping' | 'ended';
  createdAt: number;
  members: { [uid: string]: DbMember };
  matches: { [restaurantId: string]: DbMatch };
  restaurants: { [id: string]: Restaurant };
  swipes?: { [uid: string]: { [rId: string]: string } }; // 💥 NEW
}

// ── Color slot cycling ───────────────────────────────────────────
const COLOR_CYCLE: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];

@Injectable({ providedIn: 'root' })
export class FirebaseSessionService {
  private yelp = inject(YelpService);

  // ── Create a new room ────────────────────────────────────────
  async createRoom(code: string, uid: string, username: string, lat: number, lng: number, radius: number): Promise<void> {
    const member: DbMember = {
      username,
      initial: username[0]?.toUpperCase() ?? 'U',
      colorIndex: 0,
      joinedAt: Date.now(),
    };

    const liveRestaurants = await this.yelp.getRestaurants(lat, lng, radius);

    const restaurantMap: { [id: string]: Restaurant } = {};
    liveRestaurants.forEach(r => { restaurantMap[r.id] = r; });

    const roomRef = doc(db, 'rooms', code);
    await setDoc(roomRef, {
      hostId: uid,
      status: 'waiting',
      createdAt: Date.now(),
      members: { [uid]: member },
      matches: {},
      restaurants: restaurantMap,
    });
  }

  // ── Join an existing room ────────────────────────────────────
  async joinRoom(code: string, uid: string, username: string): Promise<DbRoom | null> {
    const roomRef = doc(db, 'rooms', code);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return null;

    const room = snap.data() as DbRoom;
    if (room.status === 'ended') return null;

    // Pick the next available color slot
    const takenSlots = Object.values(room.members ?? {}).map(m => m.colorIndex);
    const colorIndex = (COLOR_CYCLE.find(c => !takenSlots.includes(c)) ?? 0) as 0 | 1 | 2 | 3;

    const member: DbMember = {
      username,
      initial: username[0]?.toUpperCase() ?? 'U',
      colorIndex,
      joinedAt: Date.now(),
    };

    // Merge the new member into the members map
    await updateDoc(roomRef, {
      [`members.${uid}`]: member,
    });

    return { ...room, members: { ...room.members, [uid]: member } };
  }

  // ── Set room status ──────────────────────────────────────────
  async setStatus(code: string, status: DbRoom['status']): Promise<void> {
    await updateDoc(doc(db, 'rooms', code), { status });
  }

  // ── Record a swipe ───────────────────────────────────────────
  async recordSwipe(
    code: string,
    uid: string,
    restaurantId: string,
    dir: 'yes' | 'no',
  ): Promise<void> {

    // 💥 FIXED: Using setDoc with merge deeply creates missing maps automatically!
    await setDoc(doc(db, 'rooms', code), {
      swipes: {
        [uid]: {
          [restaurantId]: dir
        }
      }
    }, { merge: true });

    if (dir === 'yes') {
      await this._checkAndWriteMatch(code, restaurantId);
    }
  }

  // ── Match detection ──────────────────────────────────────────
  private async _checkAndWriteMatch(code: string, restaurantId: string): Promise<void> {
    const snap = await getDoc(doc(db, 'rooms', code));
    if (!snap.exists()) return;

    const room = snap.data() as DbRoom;
    const members = room.members ?? {};
    const swipes = room.swipes ?? {};

    const totalCount = Object.keys(members).length;
    const agreedCount = Object.values(swipes)
      .filter((s: any) => s[restaurantId] === 'yes').length;

    const isFull = agreedCount === totalCount && totalCount > 0;

    // 💥 FIXED: Safe merging for matches too!
    await setDoc(doc(db, 'rooms', code), {
      matches: {
        [restaurantId]: {
          restaurantId,
          agreedCount,
          totalCount,
          isFull,
        }
      }
    }, { merge: true });
  }

  // ── Live room listener (Firestore onSnapshot) ────────────────
  listenRoom$(code: string): Observable<DbRoom | null> {
    return new Observable(observer => {
      const unsub: Unsubscribe = onSnapshot(
        doc(db, 'rooms', code),
        snap => observer.next(snap.exists() ? (snap.data() as DbRoom) : null),
        err => observer.error(err),
      );
      return () => unsub();
    });
  }

  // ── Get room once ────────────────────────────────────────────
  async getRoom(code: string): Promise<DbRoom | null> {
    const snap = await getDoc(doc(db, 'rooms', code));
    return snap.exists() ? (snap.data() as DbRoom) : null;
  }

  // ── End room ─────────────────────────────────────────────────
  async endRoom(code: string): Promise<void> {
    await updateDoc(doc(db, 'rooms', code), { status: 'ended' });
  }
}

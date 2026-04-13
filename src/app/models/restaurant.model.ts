// src/app/models/restaurant.model.ts

export interface RestaurantFriend {
  initial: string;
  color: string;   // e.g. '#4ADE80'
  bgColor: string; // e.g. '#1A3020'
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  dist: string;
  price: string;    // '$' | '$$' | '$$$'
  rating: string;   // '4.7' — kept as string to match prototype
  emoji: string;
  bg: string;       // image area background colour
  friends: RestaurantFriend[];
  label: string;    // social proof text
  score: string;    // '2/3'
  // detail sheet extras
  hours?: string;
  address?: string;
  reviewCount?: number;
  imageUrl?: string;
  lat?: number;
  lng?: number;
  color?: string;
  yelpUrl?: string;
  isOpenNow?: boolean;
  takesReservations?: boolean;
}

export interface GroupMember {
  uid?: string;
  initial: string;
  colorIndex: 0 | 1 | 2 | 3; // maps to --av0..3
  username: string;
  avatar?: string;
}

export interface SavedFriend {
  friendCode: string;
  username: string;
  avatar: string;
}

export interface SessionMatch {
  restaurant: Restaurant;
  agreedCount: number;
  totalCount: number;
  isFull: boolean;
}

export interface PastSession {
  date: Date;
  roomCode: string;
  matches: SessionMatch[];
  timeAgo?: string;
}

export interface ForkupGroup {
  id: string;
  members: GroupMember[];
  sessions: PastSession[];
  isLive: boolean;
  liveRoomCode?: string;
}

export type NavTab = 'home' | 'swipe' | 'groups' | 'profile';

export interface AppState {
  username: string;
  hasActiveSession: boolean;
  isWaiting: boolean;
  activeRoomCode: string;
  activeMembers: GroupMember[];
  matchCount: number;
  isSolo: boolean;
  searchRadius: number;
  groups: ForkupGroup[];

}

// src/app/data/mock-data.ts

import {
  Restaurant,
  GroupMember,
  ForkupGroup,
  SessionMatch,
  PastSession,
  AppState
} from '../models/restaurant.model';

// ─────────────────────────────────────────────────────────────
// RESTAURANTS  (exact data from prototype JS)
// ─────────────────────────────────────────────────────────────
export const RESTAURANTS: Restaurant[] = [
  {
    id: '1',
    name: 'Noodle House 28',
    cuisine: 'Asian Fusion',
    dist: '1.2 mi',
    price: '$$',
    rating: '4.7',
    emoji: '🍜',
    bg: '#0D1A28',
    friends: [
      { initial: 'A', color: '#4ADE80', bgColor: '#1A3020' },
      { initial: 'J', color: '#60A5FA', bgColor: '#162040' },
    ],
    label: 'Alex & Jamie liked',
    score: '2/3',
    hours: 'Mon–Sun 11am–10pm · Open now',
    address: '28 Noodle Ln',
    reviewCount: 312,
  },
  {
    id: '2',
    name: 'The Burger Lab',
    cuisine: 'American',
    dist: '0.8 mi',
    price: '$',
    rating: '4.5',
    emoji: '🍔',
    bg: '#1A1208',
    friends: [
      { initial: 'M', color: '#A78BFA', bgColor: '#1E1030' },
    ],
    label: 'Marcus liked',
    score: '1/3',
    hours: 'Mon–Sun 10am–11pm · Open now',
    address: '15 Burger St',
    reviewCount: 204,
  },
  {
    id: '3',
    name: 'Sakura Garden',
    cuisine: 'Japanese',
    dist: '2.1 mi',
    price: '$$$',
    rating: '4.9',
    emoji: '🍣',
    bg: '#0A1020',
    friends: [
      { initial: 'A', color: '#4ADE80', bgColor: '#1A3020' },
      { initial: 'J', color: '#60A5FA', bgColor: '#162040' },
      { initial: 'M', color: '#A78BFA', bgColor: '#1E1030' },
    ],
    label: 'Everyone agreed!',
    score: '3/3',
    hours: 'Tue–Sun 5pm–10pm · Open now',
    address: '88 Sakura Ave',
    reviewCount: 512,
  },
  {
    id: '4',
    name: 'Pizza Volta',
    cuisine: 'Italian',
    dist: '0.5 mi',
    price: '$$',
    rating: '4.3',
    emoji: '🍕',
    bg: '#1A0C0A',
    friends: [
      { initial: 'J', color: '#60A5FA', bgColor: '#162040' },
    ],
    label: 'Jamie liked',
    score: '1/3',
    hours: 'Mon–Sun 11am–11pm · Open now',
    address: '7 Volta Rd',
    reviewCount: 189,
  },
  {
    id: '5',
    name: 'El Rancho Taco',
    cuisine: 'Mexican',
    dist: '1.8 mi',
    price: '$',
    rating: '4.6',
    emoji: '🌮',
    bg: '#0A160A',
    friends: [
      { initial: 'A', color: '#4ADE80', bgColor: '#1A3020' },
      { initial: 'M', color: '#A78BFA', bgColor: '#1E1030' },
    ],
    label: 'Alex & Marcus liked',
    score: '2/3',
    hours: 'Mon–Sun 9am–midnight · Open now',
    address: '42 Rancho Blvd',
    reviewCount: 298,
  },
];

// ─────────────────────────────────────────────────────────────
// MEMBERS
// ─────────────────────────────────────────────────────────────
export const MEMBERS: GroupMember[] = [
  { initial: 'A', colorIndex: 0, username: 'Alex' },
  { initial: 'J', colorIndex: 1, username: 'Jamie' },
  { initial: 'M', colorIndex: 2, username: 'Marcus' },
  { initial: 'S', colorIndex: 3, username: 'Sam' },
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const t = Date.now();
  return Array.from({ length: 4 }, (_, i) => chars[(t >> (i * 4)) % chars.length]).join('');
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 14) return 'last week';
  if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
  return 'last month';
}

// ─────────────────────────────────────────────────────────────
// SAMPLE SESSIONS + GROUPS
// ─────────────────────────────────────────────────────────────
const sakuraMatch: SessionMatch = {
  restaurant: RESTAURANTS[2],
  agreedCount: 3, totalCount: 3, isFull: true,
};
const burgerMatch: SessionMatch = {
  restaurant: RESTAURANTS[1],
  agreedCount: 2, totalCount: 3, isFull: false,
};

export const GROUPS: ForkupGroup[] = [
  {
    id: '1',
    members: MEMBERS.slice(0, 3),
    isLive: true,
    liveRoomCode: '7X4K',
    sessions: [
      {
        date: daysAgo(7), roomCode: '9P3X',
        matches: [sakuraMatch],
        timeAgo: '1 week ago',
      },
      {
        date: daysAgo(21), roomCode: '4K7Z',
        matches: [],
        timeAgo: '3 weeks ago',
      },
    ],
  },
  {
    id: '2',
    members: MEMBERS.slice(0, 2),
    isLive: false,
    sessions: [
      {
        date: daysAgo(3), roomCode: '2M8P',
        matches: [{ ...burgerMatch, agreedCount: 2, totalCount: 2, isFull: true }],
        timeAgo: '3 days ago',
      },
    ],
  },
  {
    id: '3',
    members: MEMBERS,
    isLive: false,
    sessions: [
      {
        date: daysAgo(7), roomCode: '5R2Q',
        matches: [{ ...sakuraMatch, totalCount: 4, agreedCount: 4 }],
        timeAgo: 'last week',
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// INITIAL APP STATE
// ─────────────────────────────────────────────────────────────
export const INITIAL_STATE: AppState = {
  username: 'HungryOtter',
  hasActiveSession: true,
  isWaiting: false,
  activeRoomCode: '7X4K',
  activeMembers: MEMBERS.slice(0, 3),
  matchCount: 1,
  isSolo: false,
  searchRadius: 2,
  groups: GROUPS,
};

export const USERNAME_SUGGESTIONS = [
  'HungryOtter',
  'TacoLover42',
  'PizzaPanda',
  'NoodleNinja',
  'SushiSorcerer',
  'BurgerBoss',
  'RamenRobot',
  'WokWizard',
];

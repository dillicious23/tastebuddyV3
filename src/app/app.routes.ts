// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => {
      return localStorage.getItem('tb_has_launched') === 'true' ? '/tabs/home' : '/launch';
    }
  },
  {
    path: 'launch',
    loadComponent: () =>
      import('./components/launch/launch.component').then(m => m.LaunchComponent),
  },
  {
    // Tab shell — hosts bottom nav and all tab children
    path: 'tabs',
    loadComponent: () =>
      import('./components/tabs/tabs.component').then(m => m.TabsComponent),
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./components/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'swipe',
        loadComponent: () =>
          import('./components/swipe/swipe.component').then(m => m.SwipeComponent),
      },
      {
        path: 'groups',
        loadComponent: () =>
          import('./components/groups/groups.component').then(m => m.GroupsComponent),
      },
      {
        path: 'groups/:id',
        loadComponent: () =>
          import('./components/group-detail/group-detail.component').then(m => m.GroupDetailComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./components/profile/profile.component').then(m => m.ProfileComponent),
      },
      {
        path: 'preferences/:type',
        loadComponent: () =>
          import('./components/preferences/preferences.component').then(m => m.PreferencesComponent),
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
  {
    // For when a user manually taps "Join" from the home screen
    path: 'join',
    loadComponent: () =>
      import('./components/join/join.component').then(m => m.JoinComponent),
  },
  {
    // 💥 NEW: For when a user clicks a Universal Link with a room code (e.g., /join/RSHE)
    path: 'join/:code',
    loadComponent: () =>
      import('./components/join/join.component').then(m => m.JoinComponent),
  },
  {
    path: 'match',
    loadComponent: () =>
      import('./components/match/match.component').then(m => m.MatchComponent),
  },
  {
    path: 'session-results',
    loadComponent: () =>
      import('./components/session-results/session-results.component').then(m => m.SessionResultsComponent),
  },
  {
    path: '**',
    redirectTo: 'launch',
  },
];

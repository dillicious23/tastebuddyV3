// src/app/core/firebase.ts
// Initialises Firebase once for the whole app.
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

// Guard against double-init during HMR
const app = getApps().length ? getApps()[0] : initializeApp(environment.firebase);

export const db = getFirestore(app);

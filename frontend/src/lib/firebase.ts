// Firebase client setup — used for Phone Auth (§4.1). Config values come from
// your Firebase project's web app settings (Project Settings > General >
// "Your apps" > Web app > Config), set as NEXT_PUBLIC_* env vars so they're
// safely embeddable in the client bundle (these are not secret — Firebase's
// security model relies on server-side rules/verification, not hiding this
// config).

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Guard against re-initializing on every hot-reload/navigation.
export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

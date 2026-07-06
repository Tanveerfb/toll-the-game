import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Auth is optional: without NEXT_PUBLIC_FIREBASE_* env vars the game still
// runs (guest mode), and initializeApp would otherwise crash prerendering.
export const firebaseEnabled = Boolean(firebaseConfig.apiKey);

let app: FirebaseApp | null = null;
if (firebaseEnabled) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? getFirestore(app) : null;

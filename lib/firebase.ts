import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Auth is optional: without NEXT_PUBLIC_FIREBASE_* env vars the game still
 * runs (guest mode), and initializeApp would otherwise crash prerendering.
 *
 * Deliberately a plain env read with NO SDK import, so every caller that only
 * needs "is auth available?" (e.g. /login's guest-mode banner) can ask without
 * pulling the SDK.
 */
export const firebaseEnabled = Boolean(firebaseConfig.apiKey);

/**
 * The initialised services plus the two SDK namespaces, handed over together.
 *
 * Callers get the API functions from here rather than importing
 * `firebase/auth` / `firebase/firestore` at module scope — a static import
 * anywhere in the tree defeats the whole point, since it pulls the SDK back
 * into the shared chunk.
 */
export interface FirebaseBundle {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  authApi: typeof import("firebase/auth");
  dbApi: typeof import("firebase/firestore");
}

let bundlePromise: Promise<FirebaseBundle | null> | null = null;

async function initFirebase(): Promise<FirebaseBundle | null> {
  if (!firebaseEnabled) return null;
  const [appApi, authApi, dbApi] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
    import("firebase/firestore"),
  ]);
  const app = appApi.getApps().length
    ? appApi.getApp()
    : appApi.initializeApp(firebaseConfig);
  return {
    app,
    auth: authApi.getAuth(app),
    db: dbApi.getFirestore(app),
    authApi,
    dbApi,
  };
}

/**
 * Loads and initialises Firebase on first use, then hands back the same
 * instance forever.
 *
 * The SDK was previously initialised at module scope and `auth`/`db` exported
 * as values, so importing this file anywhere pulled ~555 KB of `@firebase`
 * into the shared client chunk — and since AuthProvider sits in the root
 * layout, EVERY route paid for it, including a practice battle that never
 * touches auth. Now it arrives only when something actually signs in or reads
 * a cloud save.
 *
 * Returns null when Firebase isn't configured (guest mode) — callers must
 * handle that, same as the old nullable `auth`/`db` exports.
 */
export function loadFirebase(): Promise<FirebaseBundle | null> {
  if (!bundlePromise) {
    // Cached as a PROMISE, not an awaited value, so concurrent callers during
    // startup share one import + one initializeApp rather than racing.
    bundlePromise = initFirebase().catch((error) => {
      console.error("Firebase failed to initialise:", error);
      bundlePromise = null; // let a later caller retry
      return null;
    });
  }
  return bundlePromise;
}

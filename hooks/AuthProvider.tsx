"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { firebaseEnabled, loadFirebase } from "@/lib/firebase";
// TYPE-ONLY: erased at compile time. A value import of firebase/auth here
// would pull the SDK back into the shared chunk and undo the lazy loading.
import type { User } from "firebase/auth";
import { usePlayerStore, PlayerState, migratePlayerState, CURRENT_PLAYER_STATE_VERSION } from "@/store/playerStore";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  signupWithEmail: (e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  saveToCloud: (state: Partial<PlayerState>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Without Firebase config there is nothing to wait for — start resolved.
  const [loading, setLoading] = useState(firebaseEnabled);
  const { setPlayerState, resetPlayerState } = usePlayerStore();
  // Tracks whether THIS app session ever saw an authenticated user, so the
  // reset below only fires on an explicit sign-out transition — not on every
  // anonymous/guest page load, which previously wiped the persisted
  // toll-player-storage roster/inventory/pity on each visit while logged out.
  const hadUserRef = React.useRef(false);
  // Set to true immediately before any store write that ORIGINATES from
  // cloud state (hydrate-on-login, seed-on-first-login, reset-on-logout).
  // The auto-sync subscriber below checks this synchronously and skips that
  // one change, so we don't immediately write cloud-sourced data straight
  // back to Firestore (redundant) or overwrite a real save with reset
  // defaults during the logout race (subscription can still be bound to the
  // old user when resetPlayerState fires, since React hasn't re-rendered
  // with user=null yet).
  const skipSyncRef = React.useRef(false);

  useEffect(() => {
    if (!firebaseEnabled) return;
    // The SDK now arrives asynchronously, so the subscription is set up inside
    // a promise. `cancelled` covers the window where the effect is torn down
    // before the import resolves; `unsubscribe` is captured for the normal path.
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void loadFirebase().then((fb) => {
      if (!fb || cancelled) {
        setLoading(false);
        return;
      }
      const { auth, db: firestore, authApi, dbApi } = fb;
      const { onAuthStateChanged } = authApi;
      const { doc, getDoc, setDoc } = dbApi;

      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        hadUserRef.current = true;
        try {
          const docRef = doc(firestore, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Default to 2, not 1: every real doc in this project predates the
            // `version` field, but was always written in v2 shape (top-level
            // currencies/characters/stamina already split out — that happened
            // via an earlier local migration, and saveToCloud has only ever
            // written that shape). Treating an unversioned doc as v1 would
            // force the destructive v1->v2 branch in migratePlayerState to
            // run on already-v2 data: it looks for `gems` nested inside
            // `inventory` (not there on a v2+ doc), so it resets currencies to
            // {gems: 1000, coin: 0}, wipes characters to {}, and resets
            // stamina to defaults — silent permanent data loss. v1 never
            // existed in production Firestore data, so 2 is the correct and
            // safe floor.
            const migrated = migratePlayerState(data, data.version ?? 2);
            skipSyncRef.current = true;
            setPlayerState({
              uid: currentUser.uid,
              roster: migrated.roster,
              currencies: migrated.currencies,
              inventory: migrated.inventory,
              characters: migrated.characters,
              stamina: migrated.stamina,
              pity: migrated.pity,
            });
          } else {
            const state = usePlayerStore.getState();
            await setDoc(docRef, {
              roster: state.roster,
              currencies: state.currencies,
              inventory: state.inventory,
              characters: state.characters,
              stamina: state.stamina,
              pity: state.pity,
              version: CURRENT_PLAYER_STATE_VERSION,
            });
            skipSyncRef.current = true;
            setPlayerState({ uid: currentUser.uid });
          }
        } catch (e) {
          if ((e as { code?: string })?.code === "permission-denied") {
            // Firestore rules not deployed yet (see firestore.rules) —
            // play on with local state instead of spamming the console.
            console.warn(
              "Cloud save unavailable (Firestore rules deny users/" +
                currentUser.uid +
                ") — continuing with local progress.",
            );
          } else {
            console.error("Error syncing with Firestore", e);
          }
        }
      } else {
        // Only reset on a real sign-out (we previously had an authenticated
        // user this session) — a guest who was never logged in keeps their
        // locally-persisted progress instead of getting wiped on every load.
        if (hadUserRef.current) {
          skipSyncRef.current = true;
          resetPlayerState();
        }
        hadUserRef.current = false;
      }

        setLoading(false);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [setPlayerState, resetPlayerState]);

  const saveToCloud = React.useCallback(async (state: Partial<PlayerState>) => {
    if (!user) return;
    const fb = await loadFirebase();
    if (!fb) return;
    const { db, dbApi } = fb;
    const { doc, setDoc } = dbApi;
    try {
      const docRef = doc(db, "users", user.uid);
      const { roster, currencies, inventory, characters, stamina, pity } = {
        ...usePlayerStore.getState(),
        ...state,
      };
      await setDoc(
        docRef,
        { roster, currencies, inventory, characters, stamina, pity, version: CURRENT_PLAYER_STATE_VERSION },
        { merge: true },
      );
    } catch (e) {
      console.error("Error saving to Firestore", e);
    }
  }, [user]);

  // Auto-sync: any gameplay action that changes roster/currencies/inventory
  // /characters/stamina/pity (spending stamina, feeding a manual, ascending,
  // world-boss rewards, etc.) writes to Firestore a beat after it settles.
  // Without this, those changes only ever reached the cloud on next login —
  // a session that ended without logging out first lost all mid-session
  // progress. Debounced so a burst of changes (e.g. grant + immediate feed)
  // collapses into one write instead of one per action.
  useEffect(() => {
    // No `db` check needed — saveToCloud loads Firebase itself and no-ops
    // when it isn't configured.
    if (!user) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = usePlayerStore.subscribe(() => {
      if (skipSyncRef.current) {
        skipSyncRef.current = false;
        return;
      }
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        saveToCloud({});
      }, 1500);
    });
    return () => {
      unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
  }, [user, saveToCloud]);

  /** Loads the SDK on demand — the first sign-in attempt is what pulls it. */
  const requireFirebase = async () => {
    const fb = await loadFirebase();
    if (!fb) {
      throw new Error(
        "Firebase auth is not configured (missing NEXT_PUBLIC_FIREBASE_* env vars).",
      );
    }
    return fb;
  };

  const loginWithGoogle = async () => {
    const { auth, authApi } = await requireFirebase();
    await authApi.signInWithPopup(auth, new authApi.GoogleAuthProvider());
  };

  const loginWithEmail = async (e: string, p: string) => {
    const { auth, authApi } = await requireFirebase();
    await authApi.signInWithEmailAndPassword(auth, e, p);
  };

  const signupWithEmail = async (e: string, p: string) => {
    const { auth, authApi } = await requireFirebase();
    await authApi.createUserWithEmailAndPassword(auth, e, p);
  };

  const logout = async () => {
    const fb = await loadFirebase();
    if (!fb) return;
    await fb.authApi.signOut(fb.auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, loginWithEmail, signupWithEmail, logout, saveToCloud }}>
      {children}
    </AuthContext.Provider>
  );
}

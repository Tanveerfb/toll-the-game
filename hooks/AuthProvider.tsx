"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { firebaseEnabled, loadFirebase } from "@/lib/firebase";
// TYPE-ONLY: erased at compile time. A value import of firebase/auth here
// would pull the SDK back into the shared chunk and undo the lazy loading.
import type { User } from "firebase/auth";
import { usePlayerStore, PlayerState, migratePlayerState } from "@/store/playerStore";
import { useGameStore } from "@/store/gameStore";
import { cloudDocument, cloudPatch } from "@/lib/game/cloudSave";
import { createCloudSyncScheduler, type CloudSyncScheduler } from "@/lib/game/cloudSync";

/**
 * Where the cloud save stands, for the screens that show it.
 *
 * - `off`: no Firebase config, or nobody signed in. Local progress only.
 * - `connecting`: signed in, the first read not yet settled. Nothing is
 *   written until it does.
 * - `ready`: the document was read or seeded; changes sync.
 * - `unavailable`: a read or a write failed (rules, offline, a rejected
 *   document). Local progress continues; the cloud copy is behind. Before
 *   2026-10-13 this state was a `console.error` and nothing else (audit
 *   finding 1: every write after the first Epic clear threw, unseen).
 */
export type CloudStatus = "off" | "connecting" | "ready" | "unavailable";

/** A beat after the last change, so a burst of changes is one write. */
const SYNC_DELAY_MS = 1500;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  cloudStatus: CloudStatus;
  loginWithGoogle: () => Promise<void>;
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
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("off");
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
  // The signed-in uid as the writer sees it. A ref rather than the `user`
  // state so the scheduler's `save` never closes over a stale render.
  const uidRef = React.useRef<string | null>(null);

  /**
   * One write of the whole document. Throws on failure so the scheduler
   * keeps the change pending, and flips the status so a screen can say so.
   */
  const writeNow = React.useCallback(async (state: Partial<PlayerState>) => {
    const uid = uidRef.current;
    if (!uid) return;
    const fb = await loadFirebase();
    if (!fb) return;
    const { db, dbApi } = fb;
    const { doc, setDoc } = dbApi;
    try {
      await setDoc(
        doc(db, "users", uid),
        cloudDocument({ ...usePlayerStore.getState(), ...state }),
        { merge: true },
      );
      setCloudStatus("ready");
    } catch (e) {
      setCloudStatus("unavailable");
      console.error("Error saving to Firestore", e);
      throw e;
    }
  }, []);

  // The scheduler decides WHEN a write happens (`lib/game/cloudSync.ts`):
  // never before the first read succeeds, one write per burst, and a flush
  // on sign-out or a hidden tab instead of a dropped timer. Created once,
  // lazily from an effect or a handler: the React Compiler's lint reads a
  // render-time initialiser that mentions `writeNow` (which touches a ref)
  // as a ref access during render.
  const syncRef = React.useRef<CloudSyncScheduler | null>(null);
  const getSync = React.useCallback((): CloudSyncScheduler => {
    if (!syncRef.current) {
      syncRef.current = createCloudSyncScheduler({
        save: () => writeNow({}),
        delayMs: SYNC_DELAY_MS,
      });
    }
    return syncRef.current;
  }, [writeNow]);

  useEffect(() => {
    if (!firebaseEnabled) return;
    // The SDK now arrives asynchronously, so the subscription is set up inside
    // a promise. `cancelled` covers the window where the effect is torn down
    // before the import resolves; `unsubscribe` is captured for the normal path.
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const sync = getSync();

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
          uidRef.current = currentUser.uid;
          // Gate closed until the read settles: a write before that would
          // put this device's state over a cloud copy it has not seen
          // (finding 3: a failed first read seeded starter defaults).
          sync.setReady(false);
          setCloudStatus("connecting");
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
                ...cloudPatch(data, migrated),
              });
            } else {
              await setDoc(docRef, cloudDocument(usePlayerStore.getState()));
              skipSyncRef.current = true;
              setPlayerState({ uid: currentUser.uid });
            }
            sync.setReady(true);
            setCloudStatus("ready");
          } catch (e) {
            setCloudStatus("unavailable");
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
          sync.setReady(false);
          uidRef.current = null;
          setCloudStatus("off");
          // Only reset on a real sign-out (we previously had an authenticated
          // user this session) — a guest who was never logged in keeps their
          // locally-persisted progress instead of getting wiped on every load.
          if (hadUserRef.current) {
            skipSyncRef.current = true;
            resetPlayerState();
            // The persisted battle belongs to the account that started it. Left
            // in place, a won fight paid the next account to sign in on this
            // device, routed there by `BattleLock` (audit 2026-10-13).
            useGameStore.getState().resetBattle();
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
  }, [setPlayerState, resetPlayerState, getSync]);

  // Auto-sync: any gameplay action that changes a synced field (see
  // CLOUD_FIELDS — spending stamina, feeding a manual, ascending, world-boss
  // rewards, ranking up, claiming an order) writes to Firestore a beat after
  // it settles. Without this, those changes only ever reached the cloud on
  // next login. The scheduler ignores the notification until the cloud is
  // ready, so this subscription can live for the provider's whole life.
  useEffect(() => {
    if (!firebaseEnabled) return;
    const sync = getSync();
    const unsubscribe = usePlayerStore.subscribe(() => {
      if (skipSyncRef.current) {
        skipSyncRef.current = false;
        return;
      }
      sync.notify();
    });
    // A hidden tab or a closing PWA used to take the last 1.5 s of progress
    // with it (finding 5): the pending timer never fired. Best effort — a
    // `pagehide` write may still be cut off by the browser, which is why the
    // debounce is short rather than long.
    const flushIfHidden = () => {
      if (document.visibilityState === "hidden") void sync.flush();
    };
    const flush = () => {
      void sync.flush();
    };
    document.addEventListener("visibilitychange", flushIfHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", flushIfHidden);
      window.removeEventListener("pagehide", flush);
      sync.dispose();
    };
  }, [getSync]);

  /** An explicit write of `state` over the current store, now. */
  const saveToCloud = React.useCallback(
    async (state: Partial<PlayerState>) => {
      if (!getSync().isReady()) return;
      try {
        await writeNow(state);
      } catch {
        // Reported by writeNow; the caller has nothing further to do.
      }
    },
    [writeNow, getSync],
  );

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

  // Google is the only sign-in method (Tanveer, 2026-08-13). Email/password
  // was removed rather than hidden: leaving `signInWithEmailAndPassword`
  // wired up would keep a second account system alive with no UI, no password
  // reset and no route to it, which is a liability rather than a feature.
  const loginWithGoogle = async () => {
    const { auth, authApi } = await requireFirebase();
    await authApi.signInWithPopup(auth, new authApi.GoogleAuthProvider());
  };

  const logout = async () => {
    const fb = await loadFirebase();
    if (!fb) return;
    // Write what is pending before the account goes away; the sign-out
    // branch above then closes the gate and resets local state.
    await getSync().flush();
    await fb.authApi.signOut(fb.auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, cloudStatus, loginWithGoogle, logout, saveToCloud }}
    >
      {children}
    </AuthContext.Provider>
  );
}

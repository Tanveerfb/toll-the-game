"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db, firebaseEnabled } from "@/lib/firebase";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  User
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { usePlayerStore, PlayerState } from "@/store/playerStore";

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

  useEffect(() => {
    if (!auth || !db) return;
    const firestore = db;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        hadUserRef.current = true;
        try {
          const docRef = doc(firestore, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setPlayerState({
              uid: currentUser.uid,
              roster: data.roster || [],
              currencies: data.currencies || { gems: 1000, coin: 0 },
              inventory: data.inventory || {},
              characters: data.characters || {},
              stamina: data.stamina || { current: 120, updatedAt: Date.now() },
              pity: data.pity || { standard: 0, limited: 0 }
            });
          } else {
            const state = usePlayerStore.getState();
            await setDoc(docRef, {
              roster: state.roster,
              currencies: state.currencies,
              inventory: state.inventory,
              characters: state.characters,
              stamina: state.stamina,
              pity: state.pity
            });
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
          resetPlayerState();
        }
        hadUserRef.current = false;
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [setPlayerState, resetPlayerState]);

  const saveToCloud = async (state: Partial<PlayerState>) => {
    if (!user || !db) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const { roster, currencies, inventory, characters, stamina, pity } = {
        ...usePlayerStore.getState(),
        ...state,
      };
      await setDoc(docRef, { roster, currencies, inventory, characters, stamina, pity }, { merge: true });
    } catch (e) {
      console.error("Error saving to Firestore", e);
    }
  };

  const requireAuth = () => {
    if (!auth) throw new Error("Firebase auth is not configured (missing NEXT_PUBLIC_FIREBASE_* env vars).");
    return auth;
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(requireAuth(), provider);
  };

  const loginWithEmail = async (e: string, p: string) => {
    await signInWithEmailAndPassword(requireAuth(), e, p);
  };

  const signupWithEmail = async (e: string, p: string) => {
    await createUserWithEmailAndPassword(requireAuth(), e, p);
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, loginWithEmail, signupWithEmail, logout, saveToCloud }}>
      {children}
    </AuthContext.Provider>
  );
}

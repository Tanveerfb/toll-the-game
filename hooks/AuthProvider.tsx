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

  useEffect(() => {
    if (!auth || !db) return;
    const firestore = db;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const docRef = doc(firestore, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setPlayerState({
              uid: currentUser.uid,
              roster: data.roster || [],
              inventory: data.inventory || {},
              pity: data.pity || { standard: 0, limited: 0 }
            });
          } else {
            const state = usePlayerStore.getState();
            await setDoc(docRef, {
              roster: state.roster,
              inventory: state.inventory,
              pity: state.pity
            });
            setPlayerState({ uid: currentUser.uid });
          }
        } catch (e) {
          console.error("Error syncing with Firestore", e);
        }
      } else {
        resetPlayerState();
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setPlayerState, resetPlayerState]);

  const saveToCloud = async (state: Partial<PlayerState>) => {
    if (!user || !db) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const { roster, inventory, pity } = { ...usePlayerStore.getState(), ...state };
      await setDoc(docRef, { roster, inventory, pity }, { merge: true });
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

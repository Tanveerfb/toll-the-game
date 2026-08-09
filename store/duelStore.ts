import { create } from "zustand";

/**
 * Transient state for duel mode (Claude playing the enemy side).
 *
 * Deliberately NOT persisted and separate from gameStore: it exists only while
 * a turn is waiting on an external move, and a half-finished duel should never
 * survive a reload into a battle that has moved on.
 */
interface DuelState {
  /** True while the battle is parked waiting for Claude's move. */
  waiting: boolean;
  /** Shown on the waiting overlay — how long we've waited, what went wrong. */
  status: string;
  /**
   * Set while waiting. Calling it abandons the wait and hands the turn to the
   * scripted AI. This is the escape hatch — without it a battle can hang
   * forever if the session ends mid-fight, so it is always populated while
   * `waiting` is true.
   */
  abort: (() => void) | null;

  beginWait: (abort: () => void) => void;
  setStatus: (status: string) => void;
  endWait: () => void;
}

export const useDuelStore = create<DuelState>()((set) => ({
  waiting: false,
  status: "",
  abort: null,

  beginWait: (abort) => set({ waiting: true, abort, status: "Waiting for Claude…" }),
  setStatus: (status) => set({ status }),
  endWait: () => set({ waiting: false, abort: null, status: "" }),
}));

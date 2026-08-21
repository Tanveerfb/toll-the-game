"use client";

import React, { createContext, useContext, useState } from "react";
import { BattlePhase } from "@/types/mechanic";
import { BattleCharacter } from "@/types/character";
import {
  createMechanicQueue,
  type MechanicQueue,
  type QueueAction,
  type QueueItem,
} from "@/lib/game/mechanicQueue";

/**
 * React access to the passive queue.
 *
 * The queue itself is `lib/game/mechanicQueue.ts` — a plain object, so the
 * headless balance simulator can run the same passives the battle screen does
 * without rendering anything. This file is the wrapper that gives the battle
 * screen a context to reach it through, plus the animation pause the screen
 * wants and a simulator must not have.
 *
 * `QueueItem` and `QueueAction` are re-exported because `lib/game/passive.ts`
 * and a handful of components import them from here. Their real home is the lib
 * module now; this keeps the existing import sites working.
 */
export type { QueueAction, QueueItem };

/** How long the battle screen dwells between passives, so each one's animation
 *  has a moment to land. The simulator passes nothing and gets zero. */
const ANIMATION_STEP_MS = 800;

interface MechanicState {
  registerToQueue: (item: QueueItem) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  processQueue: (
    phase: BattlePhase,
    teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
    log: (entry: string) => void,
  ) => Promise<{ playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] }>;
}

const MechanicContext = createContext<MechanicState | undefined>(undefined);

export function useMechanicContext() {
  const context = useContext(MechanicContext);
  if (!context) {
    throw new Error("useMechanicContext must be used within a MechanicProvider");
  }
  return context;
}

export default function MechanicProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Lazy `useState` rather than a ref assigned during render: the queue must be
  // created exactly once and survive every re-render, and writing a ref while
  // rendering is the thing `react-hooks/refs` exists to stop.
  const [queue] = useState<MechanicQueue>(() =>
    createMechanicQueue({ stepDelayMs: ANIMATION_STEP_MS }),
  );

  return (
    <MechanicContext.Provider
      value={{
        registerToQueue: queue.register,
        removeFromQueue: queue.remove,
        clearQueue: queue.clear,
        processQueue: queue.process,
      }}
    >
      {children}
    </MechanicContext.Provider>
  );
}

"use client";

import React, { createContext, useContext, useRef } from "react";
import { BattlePhase } from "@/types/mechanic";
import { BattleCharacter } from "@/types/character";

export type QueueAction = (
  sourceCharacter: BattleCharacter,
  teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
  log: (entry: string) => void
) => Promise<{ playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] }>;

export interface QueueItem {
  id: string; // unique ID for the queue item
  phase: BattlePhase;
  sourceInstanceId: string;
  mechanicId: string;
  action: QueueAction;
}

interface MechanicState {
  registerToQueue: (item: QueueItem) => void;
  removeFromQueue: (id: string) => void;
  processQueue: (
    phase: BattlePhase,
    teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
    log: (entry: string) => void
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
  const queueRef = useRef<QueueItem[]>([]);

  const registerToQueue = (item: QueueItem) => {
    // Avoid duplicate IDs
    if (!queueRef.current.find(q => q.id === item.id)) {
      queueRef.current.push(item);
    }
  };

  const removeFromQueue = (id: string) => {
    queueRef.current = queueRef.current.filter((q) => q.id !== id);
  };

  const processQueue = async (
    phase: BattlePhase,
    teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
    log: (entry: string) => void
  ) => {
    const items = queueRef.current.filter((q) => q.phase === phase);
    let currentTeams = { ...teams };

    for (const item of items) {
      const sourceCharacter = 
        currentTeams.playerTeam.find(c => c.instanceId === item.sourceInstanceId) ||
        currentTeams.enemyTeam.find(c => c.instanceId === item.sourceInstanceId);

      // Only execute if character is still alive or present
      if (sourceCharacter && sourceCharacter.currentHP > 0) {
        log(`Evaluating mechanics for ${sourceCharacter.name} [${item.mechanicId}]`);
        
        // Compute mutated team snapshot
        currentTeams = await item.action(sourceCharacter, currentTeams, log);
        
        // Artificial delay for animations block duration testing
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    return currentTeams;
  };

  return (
    <MechanicContext.Provider
      value={{
        registerToQueue,
        removeFromQueue,
        processQueue,
      }}
    >
      {children}
    </MechanicContext.Provider>
  );
}

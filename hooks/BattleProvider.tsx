"use client";

import { Character } from "@/types/character";
import { Mechanic } from "@/types/mechanic";
import { SkillCard } from "@/types/skillCard";
import { UltimateCard } from "@/types/ultimateCard";
import React from "react";
interface BattleCharacter extends Character {
  currentHP: number;
  currentAttack: number;
  currentDefense: number;
  buffs: Mechanic[];
  debuffs: Mechanic[];
  passiveState: Record<string, unknown>;
}
interface BattleState {
  playerTeam: BattleCharacter[];
  enemyTeam: BattleCharacter[];
  currentTurn: number;
  playerTurns: number;
  enemyTurns: number;
  battleLog: string[];
  addToBattleLog: (entry: string) => void;
  resetBattle: () => void;
  battlestatus: "ongoing" | "victory" | "defeat" | "initializing";
}
interface TurnActions {
  action1: SkillCard | UltimateCard | null;
  action2: SkillCard | UltimateCard | null;
  action3: SkillCard | UltimateCard | null;
}
const BattleContext = React.createContext<BattleState | undefined>(undefined);
export function useBattleContext() {
  const context = React.useContext(BattleContext);
  if (!context) {
    throw new Error("useBattleContext must be used within a BattleProvider");
  }
  return context;
}

export default function BattleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [playerTeam, setPlayerTeam] = React.useState<BattleCharacter[]>([]);
  const [enemyTeam, setEnemyTeam] = React.useState<BattleCharacter[]>([]);
  const [currentTurn, setCurrentTurn] = React.useState(0);
  const [playerTurns, setPlayerTurns] = React.useState(0);
  const [enemyTurns, setEnemyTurns] = React.useState(0);
  const [battleLog, setBattleLog] = React.useState<string[]>([]);

  function addToBattleLog(entry: string) {
    setBattleLog((prevLog) => [...prevLog, entry]);
  }
  function resetBattle() {
    setPlayerTeam([]);
    setEnemyTeam([]);
    setCurrentTurn(0);
    setPlayerTurns(0);
    setEnemyTurns(0);
    setBattleLog([]);
  }
  function setPlayerTeamWrapper(team: BattleCharacter[]) {
    setPlayerTeam(team);
  }
  function setEnemyTeamWrapper(team: BattleCharacter[]) {
    setEnemyTeam(team);
  }
  function incrementCurrentTurnWrapper() {
    setCurrentTurn((prevTurn) => prevTurn + 1);
  }
  function resolveplayerTurnWrapper(playerActions: TurnActions) {
    Object.values(playerActions).forEach((action) => {
      if (action) {
        // Resolve the action here (e.g., apply damage, buffs, etc.)
        addToBattleLog(`Player used ${action.skillName}`);
      }
    });
    setPlayerTurns((prev) => prev + 1);
  }

  return (
    <BattleContext.Provider
      value={{
        playerTeam,
        enemyTeam,
        currentTurn,
        playerTurns,
        enemyTurns,
        battleLog,
        addToBattleLog,
        resetBattle,
        battlestatus: "initializing",
      }}
    >
      {children}
    </BattleContext.Provider>
  );
}

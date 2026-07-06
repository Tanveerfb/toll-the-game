"use client";

import { BattleCharacter } from "@/types/character";
import { BattlePhase } from "@/types/mechanic";
import React, { useEffect } from "react";
import { useMechanicContext } from "./MechanicProvider";
import { useGameStore } from "@/store/gameStore";
import { TurnActions } from "@/types/action";
import { executeSkill } from "@/lib/game/combat";
import { ENEMY_ACTIONS_PER_TURN, getAIMove } from "@/lib/game/ai";
import { registerCharacterPassives } from "@/lib/game/passive";
import { tickTeamEffects } from "@/lib/game/tick";
import { getCharacterById } from "@/lib/game/characterCatalog";

interface BattleContextType {
  advancePhase: () => void;
  startDukeTest: () => void;
  startFullTest: () => void;
  startCustomBattle: (playerIds: string[], enemyIds: string[]) => void;
  lastBattleConfig: { playerIds: string[]; enemyIds: string[] } | null;
  resolveplayerTurnWrapper: () => void;
  resolveEnemyTurnWrapper: () => void;
}

const BattleContext = React.createContext<BattleContextType | undefined>(
  undefined,
);

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
  const { processQueue, registerToQueue, clearQueue } = useMechanicContext();

  const store = useGameStore();
  const {
    playerTeam,
    enemyTeam,
    battlePhase,
    updateTeams,
    setBattlePhase,
    setCurrentTurn,
    setPlayerTurns,
    setEnemyTurns,
    resetBattle,
    addToBattleLog,
    initializeDeck,
    drawCards,
    actionQueue,
    // clearActionQueue is no longer needed; actions are resolved one by one.
    removeDeadCharacterCards,
    setActionQueue,
  } = store;

  // Removed phaseRef - accessing refs during render caused lint errors.
  // Instead we read the latest battlePhase from the Zustand store API.
  const advancePhase = () => {
    const currentPhase = useGameStore.getState().battlePhase;
    switch (currentPhase) {
      case "initializing":
        setBattlePhase("OnBattleStart");
        break;
      case "OnBattleStart":
        setBattlePhase("OnPlayerTurnStart");
        break;
      case "OnPlayerTurnStart":
        setBattlePhase("PlayerAction");
        break;
      case "PlayerAction":
        setBattlePhase("OnPlayerTurnEnd");
        break;
      case "OnPlayerTurnEnd":
        setBattlePhase("OnEnemyTurnStart");
        break;
      case "OnEnemyTurnStart":
        setBattlePhase("EnemyAction");
        break;
      case "EnemyAction":
        setBattlePhase("OnEnemyTurnEnd");
        break;
      case "OnEnemyTurnEnd":
        setCurrentTurn((prev) => prev + 1);
        setBattlePhase("OnPlayerTurnStart");
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    async function handlePhase() {
      const automatedPhases: BattlePhase[] = [
        "OnBattleStart",
        "OnPlayerTurnStart",
        "OnPlayerTurnEnd",
        "OnEnemyTurnStart",
        "OnEnemyTurnEnd",
      ];

      if (automatedPhases.includes(battlePhase)) {
        let currentTeams = { playerTeam, enemyTeam };

        if (battlePhase === "OnBattleStart") {
          initializeDeck();
        }

        // System Ticks (Buff/Debuff durations, DoT/HoT) for BOTH teams
        if (
          battlePhase === "OnPlayerTurnStart" ||
          battlePhase === "OnEnemyTurnStart"
        ) {
          currentTeams = {
            playerTeam: tickTeamEffects(currentTeams.playerTeam, addToBattleLog),
            enemyTeam: tickTeamEffects(currentTeams.enemyTeam, addToBattleLog),
          };
        }

        // Run any registered events for this phase
        const updatedTeams = await processQueue(
          battlePhase,
          currentTeams,
          addToBattleLog,
        );

        // Check for deaths during system ticks or queue evaluation and clean deck
        const allChars = [
          ...updatedTeams.playerTeam,
          ...updatedTeams.enemyTeam,
        ];
        allChars.forEach((c) => {
          if (c.currentHP <= 0 && c.team === "player") {
            removeDeadCharacterCards(c.instanceId);
          }
        });

        // Sync modified states to Zustand
        updateTeams(updatedTeams.playerTeam, updatedTeams.enemyTeam);

        // Check for victory/defeat
        const allEnemiesDead = updatedTeams.enemyTeam.every(
          (e) => e.currentHP <= 0,
        );
        const allPlayersDead = updatedTeams.playerTeam.every(
          (p) => p.currentHP <= 0,
        );

        if (allEnemiesDead && updatedTeams.enemyTeam.length > 0) {
          setBattlePhase("victory");
          addToBattleLog("VICTORY!");
          return;
        } else if (allPlayersDead && updatedTeams.playerTeam.length > 0) {
          setBattlePhase("defeat");
          addToBattleLog("DEFEAT...");
          return;
        }

        if (
          battlePhase === "OnPlayerTurnEnd" ||
          battlePhase === "OnEnemyTurnEnd"
        ) {
          drawCards();
        }

        setTimeout(() => advancePhase(), 500);
      }
    }

    handlePhase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battlePhase]);

  function resolveplayerTurnWrapper() {
    if (battlePhase !== "PlayerAction") return;

    // Process the entire action queue sequentially.
    let currentTeams = { playerTeam, enemyTeam };
    const remainingQueue = [...actionQueue];

    while (remainingQueue.length > 0) {
      const card = remainingQueue[0];
      const action: TurnActions[0] = {
        sourceInstanceId: card.sourceInstanceId,
        skill: card.skill,
        targetInstanceId: card.targetInstanceId || "",
        rank: card.rank,
      };

      // Execute the action
      currentTeams = executeSkill(action, currentTeams, addToBattleLog, 0);

      // Remove dead player characters immediately
      const deadChars = currentTeams.playerTeam.filter((c) => c.currentHP <= 0);
      deadChars.forEach((c) => removeDeadCharacterCards(c.instanceId));

      // Grant ult gauge for the source character
      currentTeams.playerTeam = currentTeams.playerTeam.map((char) =>
        char.instanceId === action.sourceInstanceId
          ? {
              ...char,
              ultGauge:
                action.skill.type === "ultimate"
                  ? 0
                  : Math.min(5, char.ultGauge + 1),
            }
          : char,
      );

      // Remove processed card from the temporary queue
      remainingQueue.shift();
    }

    // Update store with final state and clear the action queue
    updateTeams(currentTeams.playerTeam, currentTeams.enemyTeam);
    setActionQueue([]);
    setPlayerTurns((prev) => prev + 1);
    // Advance to the next phase after all actions are resolved
    advancePhase();
  }

  function resolveEnemyTurnWrapper() {
    if (battlePhase !== "EnemyAction") return;

    let currentTeams = { playerTeam, enemyTeam };

    // Enemy side takes ENEMY_ACTIONS_PER_TURN actions — any living enemy,
    // any order. Each decision is made from the post-previous-action state.
    for (let i = 0; i < ENEMY_ACTIONS_PER_TURN; i++) {
      const action = getAIMove(currentTeams.enemyTeam, currentTeams.playerTeam);
      if (!action) break;

      currentTeams = executeSkill(action, currentTeams, addToBattleLog, i);

      const deadChars = currentTeams.playerTeam.filter((c) => c.currentHP <= 0);
      deadChars.forEach((c) => removeDeadCharacterCards(c.instanceId));

      currentTeams.enemyTeam = currentTeams.enemyTeam.map((char) =>
        char.instanceId === action.sourceInstanceId
          ? {
              ...char,
              ultGauge:
                action.skill.type === "ultimate"
                  ? 0
                  : Math.min(5, char.ultGauge + 1),
            }
          : char,
      );

      const allPlayersDead = currentTeams.playerTeam.every(
        (p) => p.currentHP <= 0,
      );
      if (allPlayersDead) break;
    }

    updateTeams(currentTeams.playerTeam, currentTeams.enemyTeam);
    setEnemyTurns((prev) => prev + 1);
    advancePhase();
  }

  const loadChar = (id: string) => {
    const data = getCharacterById(id);
    if (!data) throw new Error(`Unknown character id: ${id}`);
    return data;
  };

  const [lastBattleConfig, setLastBattleConfig] = React.useState<{
    playerIds: string[];
    enemyIds: string[];
  } | null>(null);

  const startCustomBattle = (playerIds: string[], enemyIds: string[]) => {
    resetBattle();
    clearQueue();

    const buildBattleChar = (
      raw: any,
      team: "player" | "enemy",
      instanceId: string,
    ): BattleCharacter => ({
      ...raw,
      instanceId,
      currentAttack: raw.atk,
      currentDefense: raw.def,
      currentHP: raw.hp,
      ultGauge: 0,
      buffs: [],
      debuffs: [],
      passiveState: {},
      team,
    });

    const players = playerIds.map((id, i) =>
      buildBattleChar(loadChar(id), "player", `p${i + 1}_${id}`),
    );
    const enemies = enemyIds.map((id, i) =>
      buildBattleChar(loadChar(id), "enemy", `e${i + 1}_${id}`),
    );

    [...players, ...enemies].forEach((c) =>
      registerCharacterPassives(c, registerToQueue),
    );

    updateTeams(players, enemies);
    setLastBattleConfig({ playerIds, enemyIds });

    addToBattleLog(
      `--- BATTLE STARTED: ${players.length}v${enemies.length} ---`,
    );
    setTimeout(() => {
      setBattlePhase("OnBattleStart");
    }, 500);
  };

  const startFullTest = () =>
    startCustomBattle(
      ["mustafa", "batra", "sara", "yalina"],
      ["siddiq", "gabrist", "master_tao", "duke"],
    );

  const startDukeTest = () => startFullTest();

  return (
    <BattleContext.Provider
      value={{
        advancePhase,
        startDukeTest,
        startFullTest,
        startCustomBattle,
        lastBattleConfig,
        resolveplayerTurnWrapper,
        resolveEnemyTurnWrapper,
      }}
    >
      {children}
    </BattleContext.Provider>
  );
}

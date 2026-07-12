"use client";

import { BattleCharacter } from "@/types/character";
import { BattlePhase } from "@/types/mechanic";
import React, { useEffect } from "react";
import { useMechanicContext } from "./MechanicProvider";
import { useGameStore } from "@/store/gameStore";
import { TurnActions } from "@/types/action";
import { executeSkill } from "@/lib/game/combat";
import { enemyActionsForTurn, getAIMove } from "@/lib/game/ai";
import { registerCharacterPassives } from "@/lib/game/passive";
import { tickTeamBuffs, tickTeamDebuffs } from "@/lib/game/tick";
import { syncExtortLinks } from "@/lib/game/effects";
import { ensureFieldUnit, promoteSubs } from "@/lib/game/sub";
import { getCharacterById } from "@/lib/game/characterCatalog";

export interface TeamPick {
  id: string;
  /** Bench slot: passive active, no cards, enters field when a teammate dies */
  isSub?: boolean;
}

interface BattleContextType {
  advancePhase: () => void;
  startDukeTest: () => void;
  startFullTest: () => void;
  startCustomBattle: (playerPicks: TeamPick[], enemyPicks: TeamPick[]) => void;
  lastBattleConfig: { playerPicks: TeamPick[]; enemyPicks: TeamPick[] } | null;
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
    snapshotHand,
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

      // Snapshot the hand + ult gauges as the player's turn opens so
      // Reset Hand can rewind queuing and selection-time merges
      if (battlePhase === "PlayerAction") {
        snapshotHand();
      }

      if (automatedPhases.includes(battlePhase)) {
        let currentTeams = { playerTeam, enemyTeam };

        if (battlePhase === "OnBattleStart") {
          initializeDeck();
        }

        // System ticks (ruling #21): buffs/HoT expire at the owner's turn
        // START; debuffs/DoT proc and expire at the victim's turn END.
        if (battlePhase === "OnPlayerTurnStart") {
          currentTeams = {
            ...currentTeams,
            playerTeam: tickTeamBuffs(currentTeams.playerTeam, addToBattleLog),
          };
        } else if (battlePhase === "OnPlayerTurnEnd") {
          currentTeams = {
            ...currentTeams,
            playerTeam: tickTeamDebuffs(
              currentTeams.playerTeam,
              addToBattleLog,
            ),
          };
        } else if (battlePhase === "OnEnemyTurnStart") {
          currentTeams = {
            ...currentTeams,
            enemyTeam: tickTeamBuffs(currentTeams.enemyTeam, addToBattleLog),
          };
        } else if (battlePhase === "OnEnemyTurnEnd") {
          currentTeams = {
            ...currentTeams,
            enemyTeam: tickTeamDebuffs(currentTeams.enemyTeam, addToBattleLog),
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

        // Ruling #32: Extort self-buffs drop once no linked debuff survives
        // on a living enemy (expiry or DoT death during the ticks above)
        syncExtortLinks(
          updatedTeams.playerTeam,
          updatedTeams.enemyTeam,
          addToBattleLog,
        );

        // Bench units take the field only at the start of a new turn —
        // mid-turn deaths leave the slot open until the next turn begins
        if (
          battlePhase === "OnPlayerTurnStart" ||
          battlePhase === "OnEnemyTurnStart"
        ) {
          updatedTeams.playerTeam = promoteSubs(
            updatedTeams.playerTeam,
            addToBattleLog,
          );
          updatedTeams.enemyTeam = promoteSubs(
            updatedTeams.enemyTeam,
            addToBattleLog,
          );
        }

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
          battlePhase === "OnEnemyTurnEnd" ||
          // Top-up at player turn start so a freshly promoted sub's cards
          // are playable the same turn (no-op when the hand is full)
          battlePhase === "OnPlayerTurnStart"
        ) {
          drawCards();
        }

        // getState keeps the delay current with the speed toggle without
        // widening this effect's dependency list
        setTimeout(
          () => advancePhase(),
          500 / useGameStore.getState().battleSpeed,
        );
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
      currentTeams = executeSkill(
        action,
        currentTeams,
        addToBattleLog,
        0,
        undefined,
        useGameStore.getState().addBattleEvent,
      );

      // Remove dead player characters immediately (subs promote at turn start)
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

      // Ruling #43: once the last enemy dies, remaining queued cards
      // FIZZLE — no momentum, no gauge, straight to the win screen
      const allEnemiesDead = currentTeams.enemyTeam.every(
        (e) => e.currentHP <= 0,
      );
      if (allEnemiesDead && remainingQueue.length > 0) {
        addToBattleLog(
          `[System] Victory — ${remainingQueue.length} queued card(s) fizzle.`,
        );
        break;
      }
    }

    // Update store with final state and clear the action queue (+ any passes)
    updateTeams(currentTeams.playerTeam, currentTeams.enemyTeam);
    setActionQueue([]);
    useGameStore.setState({ queuedNullCount: 0 });
    setPlayerTurns((prev) => prev + 1);
    // Advance to the next phase after all actions are resolved
    advancePhase();
  }

  function resolveEnemyTurnWrapper() {
    if (battlePhase !== "EnemyAction") return;

    let currentTeams = { playerTeam, enemyTeam };

    // Ruling #39: 1 action per living field member, max 3 — any living
    // enemy, any order. Each decision sees the post-previous-action state.
    const actionCount = enemyActionsForTurn(currentTeams.enemyTeam);
    for (let i = 0; i < actionCount; i++) {
      const action = getAIMove(currentTeams.enemyTeam, currentTeams.playerTeam);
      if (!action) break;

      currentTeams = executeSkill(
        action,
        currentTeams,
        addToBattleLog,
        i,
        undefined,
        useGameStore.getState().addBattleEvent,
      );

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
    playerPicks: TeamPick[];
    enemyPicks: TeamPick[];
  } | null>(null);

  const startCustomBattle = (
    rawPlayerPicks: TeamPick[],
    rawEnemyPicks: TeamPick[],
  ) => {
    // A lone sub (or all-sub team) auto-converts to a field unit
    const playerPicks = ensureFieldUnit(rawPlayerPicks);
    const enemyPicks = ensureFieldUnit(rawEnemyPicks);

    resetBattle();
    clearQueue();

    // Single boundary cast: kit JSON is loose CharacterData, validated by
    // the Zod schema at load (incl. mechanic types + passive triggers) —
    // beyond this point everything is strictly typed.
    const buildBattleChar = (
      raw: ReturnType<typeof getCharacterById>,
      team: "player" | "enemy",
      instanceId: string,
      isSub: boolean,
    ): BattleCharacter => ({
      ...(raw as unknown as Omit<
        BattleCharacter,
        | "instanceId"
        | "currentAttack"
        | "currentDefense"
        | "currentHP"
        | "ultGauge"
        | "buffs"
        | "debuffs"
        | "passiveState"
        | "team"
        | "isSub"
      >),
      instanceId,
      currentAttack: raw!.atk,
      currentDefense: raw!.def,
      currentHP: raw!.hp,
      ultGauge: 0,
      buffs: [],
      debuffs: [],
      passiveState: {},
      team,
      isSub,
    });

    const players = playerPicks.map((pick, i) =>
      buildBattleChar(
        loadChar(pick.id),
        "player",
        `p${i + 1}_${pick.id}`,
        pick.isSub === true,
      ),
    );
    const enemies = enemyPicks.map((pick, i) =>
      buildBattleChar(
        loadChar(pick.id),
        "enemy",
        `e${i + 1}_${pick.id}`,
        pick.isSub === true,
      ),
    );

    // Passives register for subs too — they work from the bench
    [...players, ...enemies].forEach((c) =>
      registerCharacterPassives(c, registerToQueue),
    );

    updateTeams(players, enemies);
    setLastBattleConfig({ playerPicks, enemyPicks });

    addToBattleLog(
      `--- BATTLE STARTED: ${players.length}v${enemies.length} ---`,
    );
    setTimeout(() => {
      setBattlePhase("OnBattleStart");
    }, 500);
  };

  const startFullTest = () =>
    startCustomBattle(
      [
        { id: "mustafa" },
        { id: "batra" },
        { id: "sara" },
        { id: "yalina" },
      ],
      [
        { id: "siddiq" },
        { id: "gabrist" },
        { id: "master_tao" },
        { id: "duke" },
      ],
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

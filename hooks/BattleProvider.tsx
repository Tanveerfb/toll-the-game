"use client";

import { BattleCharacter } from "@/types/character";
import { BattlePhase } from "@/types/mechanic";
import React, { useEffect } from "react";
import { useMechanicContext } from "./MechanicProvider";
import { useGameStore } from "@/store/gameStore";
import { TurnActions } from "@/types/action";
import { executeSkill } from "@/lib/game/combat";
import { getAIMoves } from "@/lib/game/ai";
import { registerCharacterPassives } from "@/lib/game/passive";

interface BattleContextType {
  advancePhase: () => void;
  startDukeTest: () => void;
  startFullTest: () => void;
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
  const { processQueue, registerToQueue } = useMechanicContext();

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
          // Process player team first, then enemy team – identical logic applied to each.
          const teamKeys: ("playerTeam" | "enemyTeam")[] = [
            "playerTeam",
            "enemyTeam",
          ];
          teamKeys.forEach((teamKey) => {
            const teamToTick = [...currentTeams[teamKey]];
            for (let i = 0; i < teamToTick.length; i++) {
              const char = { ...teamToTick[i] };
              if (char.currentHP <= 0) continue;

              // Reset action‑specific passive flags each turn start
              char.passiveState.firstActionTriggeredThisTurn = false;

              // Apply Damage‑over‑Time (DoT) and Decay effects
              const dotEffects = char.debuffs.filter(
                (d) => d.type === "damageOverTime" || d.type === "decay",
              );
              let totalDot = 0;
              dotEffects.forEach((dot) => {
                if (dot.type === "decay" && dot.capturedDamage) {
                  totalDot += dot.capturedDamage;
                } else if (dot.value) {
                  totalDot += dot.value;
                }
              });
              if (totalDot > 0) {
                char.currentHP = Math.max(0, char.currentHP - totalDot);
                addToBattleLog(
                  `[System] ${char.name} takes ${totalDot} damage from DoT.`,
                );
              }

              // Apply Heal‑over‑Time (HoT) effects
              const hotEffects = char.buffs.filter(
                (b) => b.type === "healOverTime",
              );
              let totalHot = 0;
              hotEffects.forEach((hot) => {
                if (hot.value) totalHot += hot.value;
              });
              if (totalHot > 0) {
                char.currentHP = Math.min(char.hp, char.currentHP + totalHot);
                addToBattleLog(
                  `[System] ${char.name} heals ${totalHot} HP from HoT.`,
                );
              }

              // Tick down buff and debuff durations
              char.buffs = char.buffs
                .map((b) => ({
                  ...b,
                  buffDuration: b.buffDuration ? b.buffDuration - 1 : undefined,
                }))
                .filter(
                  (b) => b.buffDuration === undefined || b.buffDuration > 0,
                );
              char.debuffs = char.debuffs
                .map((d) => ({
                  ...d,
                  debuffDuration: d.debuffDuration
                    ? d.debuffDuration - 1
                    : undefined,
                }))
                .filter(
                  (d) => d.debuffDuration === undefined || d.debuffDuration > 0,
                );

              teamToTick[i] = char;
            }
            // Write back the updated team slice
            currentTeams = { ...currentTeams, [teamKey]: teamToTick };
          });
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
        skill:
          card.skill.type === "ultimate"
            ? card.skill
            : {
                ...card.skill,
                damageRanked: [
                  card.skill.damageRanked[card.rank - 1],
                  card.skill.damageRanked[card.rank - 1],
                  card.skill.damageRanked[card.rank - 1],
                ] as [number, number, number],
              },
        targetInstanceId: card.targetInstanceId || "",
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

    const enemyActions = getAIMoves(enemyTeam, playerTeam);
    const firstAction = enemyActions[0];
    if (!firstAction) return;

    let currentTeams = { playerTeam, enemyTeam };

    // Execute only the first AI action for step‑by‑step resolution
    currentTeams = executeSkill(firstAction, currentTeams, addToBattleLog, 0);
    const deadChars = currentTeams.playerTeam.filter((c) => c.currentHP <= 0);
    deadChars.forEach((c) => removeDeadCharacterCards(c.instanceId));

    currentTeams.enemyTeam = currentTeams.enemyTeam.map((char) =>
      char.instanceId === firstAction.sourceInstanceId
        ? {
            ...char,
            ultGauge:
              firstAction.skill.type === "ultimate"
                ? 0
                : Math.min(5, char.ultGauge + 1),
          }
        : char,
    );

    updateTeams(currentTeams.playerTeam, currentTeams.enemyTeam);
    setEnemyTurns((prev) => prev + 1);
    // Advance phase after the single action
    advancePhase();
  }

  const loadChar = (id: string) => require(`@/data/characters/${id}.json`);

  const startFullTest = () => {
    resetBattle();

    const mustafaRaw = loadChar("mustafa");
    const batraRaw = loadChar("batra");
    const saraRaw = loadChar("sara");
    const yalinaRaw = loadChar("yalina");

    const siddiqRaw = loadChar("siddiq");
    const gabristRaw = loadChar("gabrist");
    const taoRaw = loadChar("master_tao");
    const dukeRaw = loadChar("duke");

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

    const p1 = buildBattleChar(mustafaRaw, "player", "p1_mustafa");
    const p2 = buildBattleChar(batraRaw, "player", "p2_batra");
    const p3 = buildBattleChar(saraRaw, "player", "p3_sara");
    const p4 = buildBattleChar(yalinaRaw, "player", "p4_yalina");

    const e1 = buildBattleChar(siddiqRaw, "enemy", "e1_siddiq");
    const e2 = buildBattleChar(gabristRaw, "enemy", "e2_gabrist");
    const e3 = buildBattleChar(taoRaw, "enemy", "e3_tao");
    const e4 = buildBattleChar(dukeRaw, "enemy", "e4_duke");

    [p1, p2, p3, p4, e1, e2, e3, e4].forEach((c) =>
      registerCharacterPassives(c, registerToQueue),
    );

    updateTeams([p1, p2, p3, p4], [e1, e2, e3, e4]);

    addToBattleLog("--- 4v4 NEW CHARACTERS TEST STARTED ---");
    setTimeout(() => {
      setBattlePhase("OnBattleStart");
    }, 500);
  };

  const startDukeTest = () => startFullTest();

  return (
    <BattleContext.Provider
      value={{
        advancePhase,
        startDukeTest,
        startFullTest,
        resolveplayerTurnWrapper,
        resolveEnemyTurnWrapper,
      }}
    >
      {children}
    </BattleContext.Provider>
  );
}

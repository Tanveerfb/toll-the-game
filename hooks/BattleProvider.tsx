"use client";

import { BattleCharacter } from "@/types/character";
import { BattlePhase } from "@/types/mechanic";
import React, { useEffect } from "react";
import { useMechanicContext } from "./MechanicProvider";
import { useGameStore } from "@/store/gameStore";
import { TurnActions } from "@/types/action";
import { executeSkill } from "@/lib/game/combat";
import {
  enemyActionsForTurn,
  freshAITurnContext,
  getAIMove,
  noteAIAction,
} from "@/lib/game/ai";
import { registerCharacterPassives } from "@/lib/game/passive";
import { applyAdjacentMerges } from "@/lib/game/deck";
import { ultGaugeMax } from "@/lib/game/ultGauge";
import { transitionBossPhases } from "@/lib/game/phases";
import { applyBossTurnStart, bossForcedSpAction } from "@/lib/game/bossPassives";
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
    initializeEnemyDeck,
    drawEnemyCards,
    setEnemyDeck,
    setPhaseBreak,
    actionQueue,
    // clearActionQueue is no longer needed; actions are resolved one by one.
    removeDeadCharacterCards,
    setActionQueue,
    snapshotHand,
  } = store;

  // When a boss breaks a phase DURING the player's turn, the new phase starts
  // like a fresh battle: the boss does NOT get the enemy turn that would
  // normally follow — the player acts first against the new phase (Tanveer
  // 2026-07-19). This flag skips exactly that one enemy turn.
  const skipEnemyTurnRef = React.useRef(false);

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
        if (skipEnemyTurnRef.current) {
          // A phase broke this player turn — skip the boss's enemy turn and
          // hand straight back to the player (fresh-battle feel for the phase).
          skipEnemyTurnRef.current = false;
          addToBattleLog(
            "[System] The boss reels from the phase break — the party acts first.",
          );
          setCurrentTurn((prev) => prev + 1);
          setBattlePhase("OnPlayerTurnStart");
        } else {
          setBattlePhase("OnEnemyTurnStart");
        }
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
          initializeEnemyDeck();
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

        // Multi-phase boss turn-start passives (Molvarr): per-phase turn
        // counter, debuff-count ATK, per-turn Corrosion, turn-N drain, the
        // one-time stat spike. Runs before the boss acts; Corrosion it applies
        // ticks at the players' turn end (their cleanse window).
        if (battlePhase === "OnEnemyTurnStart") {
          const stepped = applyBossTurnStart(
            currentTeams.enemyTeam,
            currentTeams.playerTeam,
            addToBattleLog,
          );
          currentTeams = {
            playerTeam: stepped.playerTeam,
            enemyTeam: stepped.enemyTeam,
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

        // Multi-phase boss: transition a boss whose bar emptied (e.g. from a
        // DoT tick) before deciding victory; redraw its hand next enemy turn.
        const phaseStep = transitionBossPhases(updatedTeams.enemyTeam);
        if (phaseStep.transitions.length > 0) {
          updatedTeams.enemyTeam = phaseStep.team;
          phaseStep.transitions.forEach((t) =>
            addToBattleLog(`[System] ${t}`),
          );
          if (phaseStep.breaks.length > 0) {
            setPhaseBreak(
              phaseStep.breaks[0].name,
              phaseStep.breaks[0].phase,
            );
          }
          setEnemyDeck([]);
          // If a player-side tick (e.g. Corrosion) broke the phase on the
          // player's turn, skip the boss's upcoming enemy turn too. A break on
          // the boss's own turn end already flows into the player's turn next.
          if (
            battlePhase === "OnPlayerTurnStart" ||
            battlePhase === "OnPlayerTurnEnd"
          ) {
            skipEnemyTurnRef.current = true;
          }
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

      // Grant ult gauge for the source character. An ultimate consumes the
      // gauge (→0), then refills by its own gainUltGauge mechanic if any
      // (Molvarr P2 ult refills 3); normal cards grant +1.
      const playerUltRefill =
        action.skill.type === "ultimate"
          ? action.skill.mechanics?.find((m) => m.type === "gainUltGauge")
              ?.value ?? 0
          : 0;
      currentTeams.playerTeam = currentTeams.playerTeam.map((char) =>
        char.instanceId === action.sourceInstanceId
          ? {
              ...char,
              ultGauge:
                action.skill.type === "ultimate"
                  ? Math.min(ultGaugeMax(char), playerUltRefill)
                  : Math.min(ultGaugeMax(char), char.ultGauge + 1),
            }
          : char,
      );

      // Remove processed card from the temporary queue
      remainingQueue.shift();

      // Multi-phase boss: a boss whose bar just emptied transitions to its
      // next phase (fresh HP) instead of dying. Clear the enemy hand so the
      // enemy turn redraws from the new phase's skills.
      const phaseStep = transitionBossPhases(currentTeams.enemyTeam);
      if (phaseStep.transitions.length > 0) {
        currentTeams.enemyTeam = phaseStep.team;
        phaseStep.transitions.forEach((t) => addToBattleLog(`[System] ${t}`));
        if (phaseStep.breaks.length > 0) {
          setPhaseBreak(phaseStep.breaks[0].name, phaseStep.breaks[0].phase);
        }
        setEnemyDeck([]);
        // Broke a phase on the player's own turn — the boss skips its next turn.
        skipEnemyTurnRef.current = true;
        // A phase break ends the player turn like a fresh battle: any actions
        // still queued after the killing blow FIZZLE — they don't get to hit
        // the new phase (Tanveer 2026-07-20).
        if (remainingQueue.length > 0) {
          addToBattleLog(
            `[System] Phase break — ${remainingQueue.length} queued action(s) fizzle.`,
          );
        }
        break;
      }

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

    // Refill the enemy hand to capacity first (RNG + auto-merge, same rules as
    // the player deck; merges grant enemy ult gauge). The AI then plays only
    // from this hand — headless 7DS GC.
    drawEnemyCards();
    let hand = useGameStore.getState().enemyDeck;
    let currentTeams = {
      playerTeam: useGameStore.getState().playerTeam,
      enemyTeam: useGameStore.getState().enemyTeam,
    };

    // Ruling #39: 1 action per living field member, max 3 (elite = 3). Each
    // decision sees the post-previous-action state and the shrinking hand.
    const actionCount = enemyActionsForTurn(currentTeams.enemyTeam);
    const aiContext = freshAITurnContext();
    for (let i = 0; i < actionCount; i++) {
      // A boss due its SP this turn forces the phase's SP Skill as the final
      // action (bossAutoSp) — it's not in the deck, so no card is consumed.
      const forcedSp =
        i === actionCount - 1
          ? bossForcedSpAction(currentTeams.enemyTeam, currentTeams.playerTeam)
          : null;
      const action =
        forcedSp ??
        getAIMove(
          currentTeams.enemyTeam,
          currentTeams.playerTeam,
          aiContext,
          hand,
        );
      if (!action) break;
      noteAIAction(aiContext, action.skill.type);

      currentTeams = executeSkill(
        action,
        currentTeams,
        addToBattleLog,
        i,
        undefined,
        useGameStore.getState().addBattleEvent,
      );

      // Consume the played card from the hand; auto-merge what it exposed
      // (grants that enemy ult gauge, mirroring the player deck).
      if (action.cardId) {
        const merged = applyAdjacentMerges(
          hand.filter((c) => c.id !== action.cardId),
        );
        hand = merged.deck;
        if (merged.mergeCount > 0) {
          currentTeams.enemyTeam = currentTeams.enemyTeam.map((char) => {
            const gains = merged.mergeSourceIds.filter(
              (id) => id === char.instanceId,
            ).length;
            return gains > 0
              ? { ...char, ultGauge: Math.min(ultGaugeMax(char), char.ultGauge + gains) }
              : char;
          });
        }
      }

      const deadChars = currentTeams.playerTeam.filter((c) => c.currentHP <= 0);
      deadChars.forEach((c) => removeDeadCharacterCards(c.instanceId));

      // A dead enemy's cards leave the hand.
      const deadEnemyIds = new Set(
        currentTeams.enemyTeam
          .filter((c) => c.currentHP <= 0)
          .map((c) => c.instanceId),
      );
      if (deadEnemyIds.size > 0) {
        hand = hand.filter((c) => !deadEnemyIds.has(c.sourceInstanceId));
      }

      // +1 ult gauge for playing a card; an ult consumes then refills by its
      // own gainUltGauge mechanic (Molvarr P2 = 3) — same rule the player gets.
      const enemyUltRefill =
        action.skill.type === "ultimate"
          ? action.skill.mechanics?.find((m) => m.type === "gainUltGauge")
              ?.value ?? 0
          : 0;
      currentTeams.enemyTeam = currentTeams.enemyTeam.map((char) =>
        char.instanceId === action.sourceInstanceId
          ? {
              ...char,
              ultGauge:
                action.skill.type === "ultimate"
                  ? Math.min(ultGaugeMax(char), enemyUltRefill)
                  : Math.min(ultGaugeMax(char), char.ultGauge + 1),
            }
          : char,
      );

      const allPlayersDead = currentTeams.playerTeam.every(
        (p) => p.currentHP <= 0,
      );
      if (allPlayersDead) break;
    }

    setEnemyDeck(hand);
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
    skipEnemyTurnRef.current = false;

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

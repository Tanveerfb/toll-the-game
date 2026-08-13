"use client";

import { BattleCharacter } from "@/types/character";
import { BattlePhase } from "@/types/mechanic";
import React, { useEffect } from "react";
import { useMechanicContext } from "./MechanicProvider";
import { requestDuelMove } from "@/lib/duel/client";
import { useSettingsStore } from "@/store/settingsStore";
import { useGameStore } from "@/store/gameStore";
import { TurnActions, type Action } from "@/types/action";
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
import { applyFieldCap, FIELD_CAP } from "@/lib/game/format";
import { getCharacterById } from "@/lib/game/characterCatalog";
import {
  BASE_PROGRESSION,
  progressedStats,
} from "@/lib/game/progression";
import { getCharacterProgress, usePlayerStore } from "@/store/playerStore";
import {
  bonusActionsFor,
  stageAdjustedStats,
} from "@/lib/game/stageEffects";
import type { StageEffect } from "@/types/stageEffects";
import type { AnyBattleEvent } from "@/types/battleEvent";
import { resetPlayback, waitForPlayback } from "@/lib/game/playback";
import {
  evaluateBattleOutcome,
  toVictoryTeam,
} from "@/lib/game/victoryCondition";
import {
  partitionOnEnemyless,
  returnsToDeckOnFizzle,
} from "@/lib/game/targetRequirement";

/**
 * Diffs a team before/after a system tick (DoT, HoT, boss drain, stat-spike
 * self-heal, …) and emits a `tick` battle event for whoever changed. These
 * effects mutate currentHP directly with no card/skill behind them — without
 * this, the store would jump straight to the post-tick HP the instant it
 * commits, with no sequencer animation ahead of it (the original "snapshot"
 * bug, still present for anything that isn't a player/enemy card action).
 */
function emitHpTicks(
  before: BattleCharacter[],
  after: BattleCharacter[],
  label: string,
  emit: (event: AnyBattleEvent) => void,
): void {
  const beforeHp = new Map(before.map((c) => [c.instanceId, c.currentHP]));
  const targets = after
    .map((c) => {
      const hpBefore = beforeHp.get(c.instanceId);
      if (hpBefore === undefined || hpBefore === c.currentHP) return null;
      return { instanceId: c.instanceId, name: c.name, hpBefore, hpAfter: c.currentHP };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);
  if (targets.length > 0) emit({ kind: "tick", label, targets });
}

export interface TeamPick {
  id: string;
  /** Bench slot: passive active, no cards, enters field when a teammate dies */
  isSub?: boolean;
  /**
   * Progression this unit fights at. Omitted means level 1 / ascension 0 —
   * exactly the catalog statline, which is what every enemy and every
   * unspecified unit gets.
   *
   * Set explicitly for a story trial character (a fixed level, regardless of
   * whether the player owns them) or an authored enemy level. For the player's
   * own units it is filled in from `playerStore` at battle start.
   */
  level?: number;
  ascension?: number;
  ultLevel?: number;
}

interface BattleContextType {
  advancePhase: () => void;
  startDukeTest: () => void;
  startFullTest: () => void;
  startCustomBattle: (
    playerPicks: TeamPick[],
    enemyPicks: TeamPick[],
    options?: {
      preview?: boolean;
      stageEffects?: StageEffect[];
      /** Overrides the default 3-on-field rule — practice bench only. */
      fieldCap?: number;
      /** End the fight as a win once the enemy side falls to this percentage
       *  of its pooled HP — for authored battles the story says you don't win.
       *  See lib/game/victoryCondition.ts. */
      victoryAtEnemyHpPercent?: number;
    },
  ) => void;
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

  // Per-field selectors instead of the old whole-store `useGameStore()` — that
  // subscribed this component to every field in the store, re-rendering the
  // whole battle tree on any change. Action/setter functions are stable
  // references from the store and don't need selector treatment; only data
  // fields that change value do (Tanveer's audit finding, 2026-07-30).
  const battlePhase = useGameStore((s) => s.battlePhase);
  const actionQueue = useGameStore((s) => s.actionQueue);
  const updateTeams = useGameStore((s) => s.updateTeams);
  const setBattlePhase = useGameStore((s) => s.setBattlePhase);
  const setCurrentTurn = useGameStore((s) => s.setCurrentTurn);
  const setPlayerTurns = useGameStore((s) => s.setPlayerTurns);
  const setEnemyTurns = useGameStore((s) => s.setEnemyTurns);
  const resetBattle = useGameStore((s) => s.resetBattle);
  const addToBattleLog = useGameStore((s) => s.addToBattleLog);
  const initializeDeck = useGameStore((s) => s.initializeDeck);
  const drawCards = useGameStore((s) => s.drawCards);
  const setPreviewMode = useGameStore((s) => s.setPreviewMode);
  const setStageEffects = useGameStore((s) => s.setStageEffects);
  const setVictoryAtEnemyHpPercent = useGameStore(
    (s) => s.setVictoryAtEnemyHpPercent,
  );
  const initializeEnemyDeck = useGameStore((s) => s.initializeEnemyDeck);
  const drawEnemyCards = useGameStore((s) => s.drawEnemyCards);
  const setEnemyDeck = useGameStore((s) => s.setEnemyDeck);
  const dropUnchargedUltCards = useGameStore((s) => s.dropUnchargedUltCards);
  const setPhaseBreak = useGameStore((s) => s.setPhaseBreak);
  // clearActionQueue is no longer needed; actions are resolved one by one.
  const removeDeadCharacterCards = useGameStore((s) => s.removeDeadCharacterCards);
  const setActionQueue = useGameStore((s) => s.setActionQueue);
  const snapshotHand = useGameStore((s) => s.snapshotHand);
  const rankUpCharacterCards = useGameStore((s) => s.rankUpCharacterCards);

  // When a boss breaks a phase DURING the player's turn, the new phase starts
  // like a fresh battle: the boss does NOT get the enemy turn that would
  // normally follow — the player acts first against the new phase (Tanveer
  // 2026-07-19). This flag skips exactly that one enemy turn.
  const skipEnemyTurnRef = React.useRef(false);

  // Both turn resolvers now await the animation between actions, so they are
  // alive across many frames. Deck's auto-execute effect and the End Turn
  // button can both fire again during that window — the old `battlePhase`
  // check no longer guards them, because the phase only advances once the
  // whole turn is done. This does.
  const resolvingRef = React.useRef(false);

  // Resume a battle restored from sessionStorage (page reload / dev HMR). The
  // teams/decks/phase come back via zustand-persist, but passive handlers live
  // in MechanicProvider's queue as non-serializable closures — so they must be
  // re-registered here for the restored units, or the resumed battle would run
  // with no passives. The phase itself was already snapped to a safe point by
  // the store's onRehydrateStorage (Option A). Runs once on mount.
  const resumedRef = React.useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;
    const s = useGameStore.getState();
    const inProgress =
      s.playerTeam.length > 0 &&
      s.enemyTeam.length > 0 &&
      s.battlePhase !== "initializing" &&
      s.battlePhase !== "victory" &&
      s.battlePhase !== "defeat";
    if (!inProgress) return;
    clearQueue();
    [...s.playerTeam, ...s.enemyTeam].forEach((c) =>
      registerCharacterPassives(c, registerToQueue),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        let currentTeams = {
          playerTeam: useGameStore.getState().playerTeam,
          enemyTeam: useGameStore.getState().enemyTeam,
        };

        if (battlePhase === "OnBattleStart") {
          initializeDeck();
          initializeEnemyDeck();
          // Snapshot both statlines before a single point of damage lands.
          // Saved reports are analysed, not read, and without this the numbers
          // in a report have no baseline to be measured against.
          useGameStore.getState().captureOpeningTeams();
        }

        // System ticks (ruling #21): buffs/HoT expire at the owner's turn
        // START; debuffs/DoT proc and expire at the victim's turn END. Each
        // tick's HP deltas are emitted as a battle event (see emitHpTicks)
        // so the sequencer animates them instead of the bar silently
        // snapping to the post-tick value.
        const addBattleEvent = useGameStore.getState().addBattleEvent;
        if (battlePhase === "OnPlayerTurnStart") {
          const before = currentTeams.playerTeam;
          const ticked = tickTeamBuffs(before, addToBattleLog);
          emitHpTicks(before, ticked, "Regeneration", addBattleEvent);
          currentTeams = { ...currentTeams, playerTeam: ticked };
        } else if (battlePhase === "OnPlayerTurnEnd") {
          const before = currentTeams.playerTeam;
          const ticked = tickTeamDebuffs(before, addToBattleLog);
          emitHpTicks(before, ticked, "DoT", addBattleEvent);
          currentTeams = { ...currentTeams, playerTeam: ticked };
        } else if (battlePhase === "OnEnemyTurnStart") {
          const before = currentTeams.enemyTeam;
          const ticked = tickTeamBuffs(before, addToBattleLog);
          emitHpTicks(before, ticked, "Regeneration", addBattleEvent);
          currentTeams = { ...currentTeams, enemyTeam: ticked };
        } else if (battlePhase === "OnEnemyTurnEnd") {
          const before = currentTeams.enemyTeam;
          const ticked = tickTeamDebuffs(before, addToBattleLog);
          emitHpTicks(before, ticked, "DoT", addBattleEvent);
          currentTeams = { ...currentTeams, enemyTeam: ticked };
        }

        // Multi-phase boss turn-start passives (Molvarr): per-phase turn
        // counter, debuff-count ATK, per-turn Corrosion, turn-N drain, the
        // one-time stat spike. Runs before the boss acts; Corrosion it applies
        // ticks at the players' turn end (their cleanse window).
        if (battlePhase === "OnEnemyTurnStart") {
          const beforeEnemy = currentTeams.enemyTeam;
          const beforePlayer = currentTeams.playerTeam;
          const stepped = applyBossTurnStart(
            currentTeams.enemyTeam,
            currentTeams.playerTeam,
            addToBattleLog,
          );
          // Stat spike also jumps the boss's own max/current HP (a self-heal
          // in effect); the max-HP drain lowers the players'.
          emitHpTicks(beforeEnemy, stepped.enemyTeam, "Awakening", addBattleEvent);
          emitHpTicks(beforePlayer, stepped.playerTeam, "Decay", addBattleEvent);
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

        // Data-driven one-off: a `rankUpOwnDeck` passive mechanic ranks up
        // its owner's own non-ultimate, sub-max-rank hand cards once their
        // team reaches the mechanic's `atTurn` (default 3). This can't live
        // in the mechanic queue (MechanicProvider's action callback only
        // sees `teams`, not the hand/deck store), so it's special-cased here
        // alongside the other turn-start bookkeeping. Fires once per battle
        // per owner (passiveState.rankUpOwnDeckTriggered guard).
        if (
          battlePhase === "OnPlayerTurnStart" ||
          battlePhase === "OnEnemyTurnStart"
        ) {
          const isPlayerSide = battlePhase === "OnPlayerTurnStart";
          const teamSide: "player" | "enemy" = isPlayerSide ? "player" : "enemy";
          const displayedTurn = useGameStore.getState().currentTurn + 1;
          const applyRankUp = (c: (typeof updatedTeams.playerTeam)[number]) => {
            const mech = c.passive?.mechanics?.find(
              (m) => m.type === "rankUpOwnDeck",
            );
            if (
              mech &&
              mech.type === "rankUpOwnDeck" &&
              c.currentHP > 0 &&
              !c.isSub &&
              displayedTurn === (mech.atTurn ?? 3) &&
              !c.passiveState.rankUpOwnDeckTriggered
            ) {
              rankUpCharacterCards(c.instanceId, teamSide);
              addToBattleLog(
                `[System] ${c.name}'s ${c.passive!.name} ranks up her own skills!`,
              );
              return {
                ...c,
                passiveState: { ...c.passiveState, rankUpOwnDeckTriggered: true },
              };
            }
            return c;
          };
          if (isPlayerSide) {
            updatedTeams.playerTeam = updatedTeams.playerTeam.map(applyRankUp);
          } else {
            updatedTeams.enemyTeam = updatedTeams.enemyTeam.map(applyRankUp);
          }
        }

        // Commit the tick sweep and let it animate before anything reads the
        // result. Victory/defeat and the boss phase-break banner are all
        // decided below, and they used to fire while the DoT numbers were
        // still flying (Tanveer, 2026-08-11).
        updateTeams(updatedTeams.playerTeam, updatedTeams.enemyTeam);
        await waitForPlayback();
        if (useGameStore.getState().battlePhase !== battlePhase) return;

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

        // Check for victory/defeat. A chapter can end the fight early once the
        // enemy is broken rather than dead — see lib/game/victoryCondition.ts.
        const retreatPercent = useGameStore.getState().victoryAtEnemyHpPercent;
        const outcome = evaluateBattleOutcome({
          playerTeam: toVictoryTeam(updatedTeams.playerTeam),
          enemyTeam: toVictoryTeam(updatedTeams.enemyTeam),
          retreatPercent,
        });

        if (outcome === "victory") {
          setBattlePhase("victory");
          addToBattleLog(
            retreatPercent !== undefined &&
              updatedTeams.enemyTeam.some((e) => e.currentHP > 0)
              ? "[System] The fight breaks off — you weren't meant to finish it."
              : "VICTORY!",
          );
          return;
        }
        if (outcome === "defeat") {
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

  async function resolveplayerTurnWrapper() {
    if (useGameStore.getState().battlePhase !== "PlayerAction") return;
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    // A skip applies to the turn it was pressed in, not forever.
    resetPlayback();
    try {
      await runPlayerActions();
    } finally {
      resolvingRef.current = false;
    }
  }

  /**
   * Execute this turn's queued cards one at a time, committing each and
   * waiting for it to finish animating before starting the next.
   *
   * The whole queue used to resolve in one synchronous pass with a single
   * commit at the end, which left the store holding end-of-turn truth while
   * the sequencer replayed the turn from the beginning — the player saw the
   * outcome before the actions played (Tanveer, 2026-08-11).
   */
  async function runPlayerActions() {
    // Process the entire action queue sequentially.
    let currentTeams = {
      playerTeam: useGameStore.getState().playerTeam,
      enemyTeam: useGameStore.getState().enemyTeam,
    };
    const remainingQueue = [...actionQueue];

    while (remainingQueue.length > 0) {
      const card = remainingQueue[0];
      const action: TurnActions[0] = {
        sourceInstanceId: card.sourceInstanceId,
        skill: card.skill,
        targetInstanceId: card.targetInstanceId || "",
        rank: card.rank,
      };

      // Execute the action — a malformed mechanic/card should end the battle
      // gracefully instead of throwing past this handler uncaught (event
      // handlers aren't covered by app/error.tsx's render-phase boundary).
      try {
        currentTeams = executeSkill(
          action,
          currentTeams,
          addToBattleLog,
          0,
          undefined,
          useGameStore.getState().addBattleEvent,
        );
      } catch (err) {
        console.error("[BattleProvider] executeSkill crashed (player turn):", err);
        addToBattleLog("BATTLE ERROR — the fight could not continue.");
        updateTeams(currentTeams.playerTeam, currentTeams.enemyTeam);
        setBattlePhase("defeat");
        return;
      }

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

      // Commit THIS action, then let it play before resolving the next one.
      updateTeams(currentTeams.playerTeam, currentTeams.enemyTeam);
      await waitForPlayback();
      // Exiting the battle (or a defeat) during the animation ends the turn.
      if (useGameStore.getState().battlePhase !== "PlayerAction") return;

      // A dead player's cards leave the hand (subs promote at turn start).
      // After the await, not before: pulling them the instant the engine
      // committed emptied the hand ahead of the death that caused it.
      currentTeams.playerTeam
        .filter((c) => c.currentHP <= 0)
        .forEach((c) => removeDeadCharacterCards(c.instanceId));

      // Multi-phase boss: a boss whose bar just emptied transitions to its
      // next phase (fresh HP) instead of dying. Clear the enemy hand so the
      // enemy turn redraws from the new phase's skills. Deliberately AFTER the
      // await: the killing blow has to land on screen before the boss's HP
      // jumps to its next phase and the PHASE banner fires.
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

      // Ruling #43, refined 2026-08-11: once the fight is decided, only the
      // cards that NEED a living enemy fizzle. Heals, cleanses and buffs still
      // land — they have somewhere to point and the player already paid for
      // them. An attacking ultimate goes back to the hand rather than burning;
      // its gauge was never spent, so losing the card too would leave a full
      // gauge with nothing to spend it on.
      const decided =
        evaluateBattleOutcome({
          playerTeam: toVictoryTeam(currentTeams.playerTeam),
          enemyTeam: toVictoryTeam(currentTeams.enemyTeam),
          retreatPercent: useGameStore.getState().victoryAtEnemyHpPercent,
        }) === "victory";
      if (decided && remainingQueue.length > 0) {
        const { playable, cancelled } = partitionOnEnemyless(remainingQueue);
        if (cancelled.length > 0) {
          const returned = cancelled.filter(returnsToDeckOnFizzle);
          useGameStore.getState().queueCardsForNextDraw(returned);
          addToBattleLog(
            `[System] Victory — ${cancelled.length} queued card(s) fizzle` +
              (returned.length > 0
                ? `; ${returned.length} ultimate(s) return next turn.`
                : "."),
          );
        }
        // Keep resolving whatever still works, in its queued order.
        remainingQueue.length = 0;
        remainingQueue.push(...playable);
        if (remainingQueue.length === 0) break;
      }
    }

    // Catches the phase-break branch's re-assigned enemy team; every other
    // path already committed inside the loop.
    updateTeams(currentTeams.playerTeam, currentTeams.enemyTeam);
    // A drained gauge takes its ultimate card back — from either hand, since
    // either side can carry `lowerUltGauge` (Tanveer, 2026-08-13).
    dropUnchargedUltCards("player");
    dropUnchargedUltCards("enemy");
    setActionQueue([]);
    useGameStore.setState({ queuedNullCount: 0 });
    setPlayerTurns((prev) => prev + 1);
    // Advance to the next phase after all actions are resolved
    advancePhase();
  }

  async function resolveEnemyTurnWrapper() {
    if (useGameStore.getState().battlePhase !== "EnemyAction") return;
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    resetPlayback();
    try {
      await runEnemyActions();
    } finally {
      resolvingRef.current = false;
    }
  }

  async function runEnemyActions() {
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
    const actionCount = enemyActionsForTurn(
      currentTeams.enemyTeam,
      bonusActionsFor(useGameStore.getState().stageEffects, "enemy"),
    );
    const aiContext = freshAITurnContext();

    // Duel mode (dev only): Claude picks this turn's actions instead of the
    // scripted AI. It submits the whole turn at once, so this awaits once
    // rather than per action. `null` back — aborted, timed out, or an invalid
    // move — means the AI plays the turn exactly as it always has, which is
    // what keeps a battle from ever getting stuck.
    // Spec: docs/superpowers/specs/2026-08-09-claude-duel-mode-design.md
    let duelActions: Array<Action | null> | null = null;
    if (useSettingsStore.getState().duelMode) {
      duelActions = await requestDuelMove({
        enemyTeam: currentTeams.enemyTeam,
        playerTeam: currentTeams.playerTeam,
        hand,
        turn: useGameStore.getState().currentTurn,
        actionBudget: actionCount,
        recentEvents: useGameStore.getState().battleLog.slice(-12),
      });
      // The battle may have ended (or been exited) while waiting.
      if (useGameStore.getState().battlePhase !== "EnemyAction") return;
      currentTeams = {
        playerTeam: useGameStore.getState().playerTeam,
        enemyTeam: useGameStore.getState().enemyTeam,
      };
    }

    for (let i = 0; i < actionCount; i++) {
      // A boss due its SP this turn forces the phase's SP Skill as the final
      // action (bossAutoSp) — it's not in the deck, so no card is consumed.
      const forcedSp =
        i === actionCount - 1
          ? bossForcedSpAction(currentTeams.enemyTeam, currentTeams.playerTeam)
          : null;
      // Forced SP still wins in duel mode: it's a boss MECHANIC, not a
      // decision, so Claude doesn't get to suppress it (Tanveer, 2026-08-09).
      const action =
        forcedSp ??
        (duelActions
          ? (duelActions[i] ?? null)
          : getAIMove(
              currentTeams.enemyTeam,
              currentTeams.playerTeam,
              aiContext,
              hand,
            ));
      if (!action) {
        // A duelled turn can deliberately pass a slot; the AI returning null
        // means it has nothing playable at all, which ends the turn.
        if (duelActions) continue;
        break;
      }
      noteAIAction(aiContext, action.skill.type);

      try {
        currentTeams = executeSkill(
          action,
          currentTeams,
          addToBattleLog,
          i,
          undefined,
          useGameStore.getState().addBattleEvent,
        );
      } catch (err) {
        console.error("[BattleProvider] executeSkill crashed (enemy turn):", err);
        addToBattleLog("BATTLE ERROR — the fight could not continue.");
        updateTeams(currentTeams.playerTeam, currentTeams.enemyTeam);
        setBattlePhase("defeat");
        return;
      }

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

      // Commit THIS action and let it play before the AI decides the next
      // one — the enemy turn used to resolve all three at once, so the whole
      // exchange landed on screen before any of it animated.
      updateTeams(currentTeams.playerTeam, currentTeams.enemyTeam);
      await waitForPlayback();
      if (useGameStore.getState().battlePhase !== "EnemyAction") return;

      // Deck cleanup after the blow has landed on screen — the player's hand
      // used to lose a downed unit's cards while that unit was still standing.
      currentTeams.playerTeam
        .filter((c) => c.currentHP <= 0)
        .forEach((c) => removeDeadCharacterCards(c.instanceId));

      // A dead enemy's cards leave its hand before the AI's next decision.
      const deadEnemyIds = new Set(
        currentTeams.enemyTeam
          .filter((c) => c.currentHP <= 0)
          .map((c) => c.instanceId),
      );
      if (deadEnemyIds.size > 0) {
        hand = hand.filter((c) => !deadEnemyIds.has(c.sourceInstanceId));
      }

      const allPlayersDead = currentTeams.playerTeam.every(
        (p) => p.currentHP <= 0,
      );
      if (allPlayersDead) break;
    }

    setEnemyDeck(hand);
    updateTeams(currentTeams.playerTeam, currentTeams.enemyTeam);
    // The enemy turn is where the player's gauge usually gets drained, so this
    // is the call that actually fixes the reported bug: Mustafa depletes
    // Lyra's gauge, and her ultimate leaves the hand it was sitting in.
    dropUnchargedUltCards("player");
    dropUnchargedUltCards("enemy");
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
    options?: {
      preview?: boolean;
      stageEffects?: StageEffect[];
      fieldCap?: number;
      /** End the fight as a win once the enemy side falls to this percentage of
       *  its pooled HP — for authored battles the story says you do not win.
       *  See lib/game/victoryCondition.ts. */
      victoryAtEnemyHpPercent?: number;
    },
  ) => {
    const preview = options?.preview === true;
    const stageEffects = options?.stageEffects ?? [];
    // Both sides field at most `FIELD_CAP`; the rest bench. Applied here
    // rather than in a picker so no screen can ship a battle that forgot the
    // rule — which is exactly how story and world-boss fights ran four units
    // on the field (Tanveer, 2026-08-11). `options.fieldCap` is the documented
    // escape hatch for the practice bench and any authored encounter that
    // wants a different board.
    const fieldCap = options?.fieldCap ?? FIELD_CAP;
    // A lone sub (or all-sub team) auto-converts to a field unit
    const playerPicks = ensureFieldUnit(applyFieldCap(rawPlayerPicks, fieldCap));
    const enemyPicks = ensureFieldUnit(applyFieldCap(rawEnemyPicks, fieldCap));

    resetBattle();
    clearQueue();
    setStageEffects(stageEffects);
    setVictoryAtEnemyHpPercent(options?.victoryAtEnemyHpPercent);
    setPreviewMode(preview);
    skipEnemyTurnRef.current = false;

    // Single boundary cast: kit JSON is loose CharacterData, validated by
    // the Zod schema at load (incl. mechanic types + passive triggers) —
    // beyond this point everything is strictly typed.
    // Stage effects are baked into BASE stats here, not applied as buffs:
    // a stage is not something `cancelBuffs` may strip, nor something Rupture
    // should count as a buff to punish (Tanveer, 2026-08-10).
    const stageStats = (
      team: "player" | "enemy",
      raw: { atk: number; def: number; hp: number },
    ) => stageAdjustedStats(raw, stageEffects, team);

    // Catalog base → progression → stage effects, in that order. Progression
    // is intrinsic to the unit; a stage effect is the encounter modifying
    // whatever the unit turned up as.
    const buildBattleChar = (
      raw: ReturnType<typeof getCharacterById>,
      team: "player" | "enemy",
      instanceId: string,
      isSub: boolean,
      pick: TeamPick,
    ): BattleCharacter => {
      // A player unit fights at whatever the save says, unless the pick names
      // a level explicitly — which is how a story trial character gets a fixed
      // level regardless of whether the player owns them. Read once, here: the
      // team's progression must not shift mid-battle if the store changes.
      const saved =
        team === "player" && pick.level === undefined
          ? getCharacterProgress(usePlayerStore.getState(), pick.id)
          : null;
      const progressed = progressedStats(
        { hp: raw!.hp, atk: raw!.atk, def: raw!.def },
        {
          level: pick.level ?? saved?.level ?? BASE_PROGRESSION.level,
          ascension:
            pick.ascension ?? saved?.ascension ?? BASE_PROGRESSION.ascension,
        },
      );
      const staged = stageStats(team, progressed);
      return {
        ...(raw as unknown as Omit<
          BattleCharacter,
          | "instanceId"
          | "currentAttack"
          | "currentDefense"
          | "currentHP"
          | "ultGauge"
          | "ultLevel"
          | "buffs"
          | "debuffs"
          | "passiveState"
          | "team"
          | "isSub"
        >),
        instanceId,
        ...staged,
        currentAttack: staged.atk,
        currentDefense: staged.def,
        currentHP: staged.hp,
        ultGauge: 0,
        // Carried onto the unit so combat can scale the ultimate and the info
        // panel can show it, rather than re-reading the store mid-battle.
        ultLevel: pick.ultLevel ?? saved?.ultLevel ?? 1,
        buffs: [],
        debuffs: [],
        passiveState: {},
        team,
        isSub,
      };
    };

    const players = playerPicks.map((pick, i) =>
      buildBattleChar(
        loadChar(pick.id),
        "player",
        `p${i + 1}_${pick.id}`,
        pick.isSub === true,
        pick,
      ),
    );
    const enemies = enemyPicks.map((pick, i) =>
      buildBattleChar(
        loadChar(pick.id),
        "enemy",
        `e${i + 1}_${pick.id}`,
        pick.isSub === true,
        pick,
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

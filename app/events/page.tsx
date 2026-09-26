"use client";

import React from "react";

import { Screen } from "@/components/ui/Screen";
import BattleArena from "@/components/game/BattleArena";
import Deck from "@/components/game/Deck";
import { toTeamPicks } from "@/components/game/TeamPicker";
import AutoClearResults, {
  type AutoClearRun,
} from "@/components/game/events/AutoClearResults";
import {
  BossClearSummary,
  TrialClearSummary,
  TrialMissing,
} from "@/components/game/events/ClearSummary";
import EventBrief from "@/components/game/events/EventBrief";
import EventsBoard from "@/components/game/events/EventsBoard";
import TrialRail from "@/components/game/events/TrialRail";
import { useBattleContext } from "@/hooks/BattleProvider";
import { useScreenMusic } from "@/hooks/useScreenMusic";
import { useGameStore } from "@/store/gameStore";
import { usePlayerStore } from "@/store/playerStore";
import { getCurrentStamina } from "@/lib/game/stamina";
import {
  addRewards,
  emptyRewards,
  rollWorldBossRewards,
  tierKey,
  type WorldBossRewards,
} from "@/lib/game/worldBossRewards";
import type { CharacterData } from "@/lib/game/characterCatalog";
import {
  eventLockReason,
  GAME_EVENTS,
  isEventVisible,
  type GameEvent,
} from "@/lib/game/events";
import {
  availableDifficulties,
  enemyLevelForDifficulty,
  worldLevelCapForRank,
} from "@/lib/game/worldLevel";
import { AUTO_CLEAR_IS_NEVER_FIRST_CLEAR } from "@/lib/game/autoClear";
import {
  beginRun,
  fightSummaries,
  runHealthBars,
  fightTeam,
  type FightRunState,
} from "@/lib/game/fightRun";
import { foldFightFromBattle } from "@/lib/game/fightDriver";
import { getTrialEncounter } from "@/lib/game/trialEncounters";
import { resumedEventBattle } from "@/lib/game/battleLock";

/**
 * The events screen.
 *
 * **This file is the state machine, not the layout** (decomposed 2026-09-17,
 * audit finding M1 — it was 1,289 lines holding eleven view branches, every
 * store subscription and every piece of markup at once). Each branch below now
 * renders one component out of `components/game/events/`; what stays here is
 * the `View` union, the store reads, and the transitions between them, which
 * is the part that genuinely has to be in one place.
 */
type View =
  | { kind: "board" }
  | { kind: "brief"; event: GameEvent }
  | { kind: "battle"; event: GameEvent }
  | { kind: "results"; event: GameEvent; rewards: WorldBossRewards }
  /**
   * A cleared ascension trial.
   *
   * Separate from `results` because a trial pays nothing from the world-boss
   * table — the reward IS the wall coming down, and the ranks banked while
   * stuck landing at once (`clearRankWall`). Routing a trial through
   * `results` would hand out sea monster eyes for beating a rank gate.
   */
  | {
      kind: "trialResults";
      event: GameEvent;
      wall: number;
      rankBefore: number;
      rankAfter: number;
      /**
       * The finished run, for the recap (option E, 2026-09-20). Carried rather
       * than re-read because `resetBattle()` has already emptied the battle
       * store by the time this renders.
       *
       * Optional because the older single-fight trial route above never builds
       * a run at all — that path shows the unlock block without a recap rather
       * than inventing one.
       */
      run?: FightRunState;
    }
  /**
   * A trial in progress. Unlike the boss, a trial is a RUN — several fights on
   * one HP bar — so the screen has to hold the run between them; the battle
   * store only ever knows about the fight it is in.
   */
  | { kind: "trialBattle"; event: GameEvent; run: FightRunState }
  /** The battle road between two fights (Tanveer, 2026-09-16). */
  | { kind: "trialBreak"; event: GameEvent; run: FightRunState }
  /** Auto Clear's per-run breakdown plus the combined haul. Separate from
   *  `results` because it reports many runs and never came from a battle. */
  | {
      kind: "autoResults";
      event: GameEvent;
      rewards: WorldBossRewards;
      runs: AutoClearRun[];
    };

export default function EventsPage(): React.JSX.Element {
  const { startCustomBattle } = useBattleContext();
  const resetBattle = useGameStore((s) => s.resetBattle);
  const battlePhase = useGameStore((s) => s.battlePhase);
  const battleOwner = useGameStore((s) => s.battleOwner);
  const roster = usePlayerStore((s) => s.roster);
  const stamina = usePlayerStore((s) => s.stamina);
  const account = usePlayerStore((s) => s.account);
  const worldLevel = usePlayerStore((s) => s.worldLevel);
  const spendStaminaAction = usePlayerStore((s) => s.spendStaminaAction);
  const rememberLastTeam = usePlayerStore((s) => s.rememberLastTeam);
  const grantWorldBossRewards = usePlayerStore((s) => s.grantWorldBossRewards);
  const autoClearTickets = usePlayerStore((s) => s.autoClearTickets);
  const clearedEvents = usePlayerStore((s) => s.clearedEvents);
  const recordManualClear = usePlayerStore((s) => s.recordManualClear);
  const clearRankWall = usePlayerStore((s) => s.clearRankWall);
  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const spendAutoClearRun = usePlayerStore((s) => s.spendAutoClearRun);

  /**
   * The board lists what the player may *see*; `eventLockReason` then decides
   * what they may enter. Two questions, and events answer them differently —
   * the first trial is visible at rank 1 and locked until 20, while the second
   * is withheld until the first is behind you (ruling #127).
   */
  const visibleEvents = React.useMemo(
    () =>
      GAME_EVENTS.filter((event) =>
        isEventVisible(event, {
          accountRank: account.rank,
          clearedWalls: account.clearedWalls,
        }),
      ),
    [account.rank, account.clearedWalls],
  );

  const [view, setView] = React.useState<View>({ kind: "board" });
  const [team, setTeam] = React.useState<CharacterData[]>([]);
  const [difficulty, setDifficulty] = React.useState<number>(worldLevel);
  const [notice, setNotice] = React.useState<string | null>(null);

  useScreenMusic(
    view.kind === "battle" || view.kind === "trialBattle"
      ? "battle"
      : view.kind === "results" ||
          view.kind === "autoResults" ||
          view.kind === "trialResults"
        ? "victory"
        : "menu",
  );

  const currentStamina = getCurrentStamina(stamina);
  const rankCap = worldLevelCapForRank(account.rank);
  const difficulties = availableDifficulties({ cap: rankCap });
  const backToBoard = React.useCallback(() => setView({ kind: "board" }), []);

  /** Starts the fight the run is currently on, carrying HP forward. */
  const launchFight = React.useCallback(
    (event: GameEvent, run: FightRunState) => {
      const encounter = getTrialEncounter(event.id);
      const fight = encounter?.fights[run.fightIndex];
      if (!fight) return;
      startCustomBattle(fightTeam(run), fight.enemies, {
        stageEffects: fight.stageEffects,
        victoryAtEnemyHpPercent: fight.victoryAtEnemyHpPercent,
        // Fight 1 passes an empty map and everyone starts full; every later
        // fight carries the survivors' HP. No heal between fights — ruling
        // #103, and the whole point of the format.
        carryHp: run.carryHp,
        // The run rides with the battle, so a reload mid-fight resumes this
        // fight of this run rather than dropping the run on the floor.
        owner: {
          route: "/events",
          view: { kind: "trial", eventId: event.id, run },
        },
      });
    },
    [startCustomBattle],
  );

  /**
   * Enter a trial: one stamina charge buys the whole run, not each fight.
   *
   * Charging per fight would make a three-fight trial cost three times a boss
   * run for a single one-off clear, and the `staminaCost` authored on the
   * event is one number describing one attempt.
   */
  const enterTrial = React.useCallback(
    (event: GameEvent) => {
      const encounter = getTrialEncounter(event.id);
      if (!encounter || encounter.fights.length === 0) return;
      if (!spendStaminaAction(event.staminaCost)) {
        setNotice("Not enough stamina — wait for it to regenerate.");
        return;
      }
      setNotice(null);
      if (team.length > 0) rememberLastTeam(team.map((c) => c.id));
      const run = beginRun(encounter, toTeamPicks(team));
      launchFight(event, run);
      setView({ kind: "trialBattle", event, run });
    },
    [spendStaminaAction, team, rememberLastTeam, launchFight],
  );

  const enter = React.useCallback(
    (event: GameEvent) => {
      // A trial is a multi-fight run and takes the other path entirely.
      if (getTrialEncounter(event.id)) {
        enterTrial(event);
        return;
      }
      if (!event.enemyId) return;
      if (!spendStaminaAction(event.staminaCost)) {
        setNotice("Not enough stamina — wait for it to regenerate.");
        return;
      }
      setNotice(null);
      // Remembered on launch, not on selection — see the story brief.
      if (team.length > 0) rememberLastTeam(team.map((c) => c.id));
      startCustomBattle(toTeamPicks(team), [
        // Difficulty finally reaches the engine: `enemyLevelForDifficulty` and
        // `worldLevel` have existed since 2026-08-11 and drove nothing.
        { id: event.enemyId, level: enemyLevelForDifficulty(difficulty) },
      ], {
        // Difficulty rides with the battle: the victory card pays out at the
        // difficulty in state, and a reload would otherwise reset it.
        owner: {
          route: "/events",
          view: { kind: "boss", eventId: event.id, difficulty },
        },
      });
      setView({ kind: "battle", event });
    },
    [
      spendStaminaAction,
      startCustomBattle,
      team,
      rememberLastTeam,
      difficulty,
      enterTrial,
    ],
  );

  /**
   * Resolve `count` skipped runs.
   *
   * Sequential, and re-reading the store each iteration, for a reason that is
   * easy to miss: a rank-up mid-batch refills stamina to the cap AND pays
   * Auto Clear Tickets, so a batch can legitimately afford more than its
   * opening state suggested. Pre-computing affordability once would either
   * stop early or, worse, keep spending against stale numbers.
   *
   * Each run pays its own ticket and stamina atomically before its reward is
   * rolled, so an interrupted batch never hands out an unpaid clear.
   */
  const runAutoClear = React.useCallback(
    (event: GameEvent, count: number) => {
      // From the module's own constructor, not a literal: a hand-written
      // zeroed object goes stale the moment a reward field is added.
      let totals = emptyRewards();
      const runs: AutoClearRun[] = [];

      for (let i = 0; i < count; i++) {
        const staminaBefore = getCurrentStamina(
          usePlayerStore.getState().stamina,
        );
        if (!spendAutoClearRun(event.staminaCost)) break;
        // A fresh roll per run — the 10% bonus branches have to be rolled
        // independently or the variance flattens and the average shifts.
        // Never a first clear: the unlock gate guarantees one already
        // happened, and gems are first-clear only.
        const rewards = rollWorldBossRewards(undefined, {
          firstClear: AUTO_CLEAR_IS_NEVER_FIRST_CLEAR,
          difficulty,
        });
        grantWorldBossRewards(rewards);
        totals = addRewards(totals, rewards);
        runs.push({
          // Sequential within the batch, and readable in a table — a raw
          // uuid would identify the run without telling anyone anything.
          id: `${tierKey(event.id, difficulty)}-${String(runs.length + 1).padStart(2, "0")}`,
          staminaUsed:
            staminaBefore -
            getCurrentStamina(usePlayerStore.getState().stamina),
          // Read AFTER the spend, so a rank-up that refilled the bar mid-batch
          // shows up here as the jump it actually was.
          staminaAfter: getCurrentStamina(usePlayerStore.getState().stamina),
          rewards,
        });
      }

      if (runs.length === 0) {
        setNotice("Not enough tickets or stamina for a run.");
        return;
      }
      setNotice(null);
      setView({ kind: "autoResults", event, rewards: totals, runs });
    },
    [spendAutoClearRun, grantWorldBossRewards, difficulty],
  );

  /**
   * Nothing renders until the save is in.
   *
   * `playerStore` states the rule on `hasHydrated` itself — *"gate any
   * first-paint read of roster/inventory on this to avoid a flash of the
   * default starter state"* — and eleven components already do. This page did
   * not, while reading player state in twenty places, which is the worst
   * possible combination: the board decides **event visibility**
   * (`isEventVisible` takes `account.rank`), **lock reasons**
   * (`eventLockReason`), the **difficulty ladder** (`worldLevelCapForRank`) and
   * the **stamina cost check** off that state. Before rehydration every one of
   * those answers is computed against rank 1 and a default stamina bar, so a
   * cleared trial could flash as locked and the ladder could offer rungs the
   * player has long passed (audit 2026-09-17, finding Q3).
   *
   * Returns the page's own shell rather than `null` or a new spinner: it is
   * already what every branch below renders into, so there is no new visual
   * vocabulary here and nothing to design.
   */
  if (!hasHydrated) return <Screen width="none" />;

  // A live battle this page owns (a reload, or `BattleLock` sending the
  // player back): rebuild its view during render so the board never paints
  // over it. `view.kind` keeps this from looping. See `resumedEventBattle`.
  const resumed =
    view.kind === "board" ? resumedEventBattle(battlePhase, battleOwner) : null;
  if (resumed) {
    if (resumed.kind === "boss") setDifficulty(resumed.difficulty);
    setView(
      resumed.kind === "boss"
        ? { kind: "battle", event: resumed.event }
        : { kind: "trialBattle", event: resumed.event, run: resumed.run },
    );
    return <Screen width="none" />;
  }

  if (view.kind === "battle") {
    return (
      <Screen variant="fixed" width="none">
        <BattleArena
          contextLabel={view.event.name}
          worldBoss={{
            continueLabel: "CLAIM REWARDS",
            quitLabel: "BACK TO EVENTS",
            onContinue: () => {
              // A trial and a boss resolve differently, and the split is the
              // whole point: `clearsWall` was authored on both trials the day
              // the board was built and NOTHING has ever called
              // `clearRankWall` outside a test, so beating a trial left the
              // rank cap exactly where it was. Fixed 2026-09-16.
              if (view.event.kind === "trial") {
                const wall = view.event.clearsWall;
                if (wall === undefined) {
                  resetBattle();
                  backToBoard();
                  return;
                }
                const rankBefore = usePlayerStore.getState().account.rank;
                clearRankWall(wall);
                // Read after: `clearRankWall` re-applies the XP banked while
                // the player sat against the wall, so this can jump several
                // ranks at once.
                const rankAfter = usePlayerStore.getState().account.rank;
                // Deliberately NOT `recordManualClear`. That call exists to
                // unlock Auto Clear, and a trial is `repeatable: false` —
                // there is nothing to skip, and `autoClearEligible` is
                // documented as never belonging on a one-off.
                resetBattle();
                setView({
                  kind: "trialResults",
                  event: view.event,
                  wall,
                  rankBefore,
                  rankAfter,
                });
                return;
              }
              // Read BEFORE the clear is recorded — `clearedEvents` is what
              // makes this the first clear, and recording first would pay
              // every clear as a repeat. Keyed per DIFFICULTY: each tier is a
              // separate fight with its own one-off bundle.
              const key = tierKey(view.event.id, difficulty);
              const isFirstClear = !clearedEvents.includes(key);
              const rewards = rollWorldBossRewards(undefined, {
                firstClear: isFirstClear,
                difficulty,
              });
              grantWorldBossRewards(rewards);
              // A MANUAL clear, which is what unlocks Auto Clear for this
              // tier. Auto Clear deliberately never reaches this call — it
              // would otherwise be able to unlock itself.
              recordManualClear(key);
              resetBattle();
              setView({ kind: "results", event: view.event, rewards });
            },
            onRetry: () => enter(view.event),
            onQuit: () => {
              resetBattle();
              backToBoard();
            },
          }}
        />
        <Deck />
      </Screen>
    );
  }

  // ---- A trial fight ----
  if (view.kind === "trialBattle") {
    const { event, run } = view;
    const encounter = getTrialEncounter(event.id);
    // Defensive: this view is only ever constructed after `enterTrial` has
    // already resolved an encounter. Rendering a way out beats setting state
    // during render, which React would warn about and which would loop.
    if (!encounter) return <TrialMissing onBack={backToBoard} />;
    return (
      <Screen variant="fixed" width="none">
        <BattleArena
          contextLabel={`${event.name} · Fight ${run.fightIndex + 1}/${run.fightCount}`}
          worldBoss={{
            // No victory card: the battle road announces the win on top of the
            // route it already draws (option C, chosen 2026-09-20). Defeat
            // still stops on the card — losing is a decision point.
            autoContinueOnVictory: true,
            quitLabel: "BACK TO EVENTS",
            onContinue: () => {
              const folded = foldFightFromBattle(run, useGameStore.getState());
              resetBattle();
              if (!folded.complete) {
                setView({ kind: "trialBreak", event, run: folded });
                return;
              }
              // Last fight won — the wall comes down. Nothing is rolled: a
              // trial pays no loot table, the lifted cap IS the reward.
              const wall = event.clearsWall;
              if (wall === undefined) {
                backToBoard();
                return;
              }
              const rankBefore = usePlayerStore.getState().account.rank;
              clearRankWall(wall);
              const rankAfter = usePlayerStore.getState().account.rank;
              setView({
                kind: "trialResults",
                event,
                wall,
                rankBefore,
                rankAfter,
                run: folded,
              });
            },
            // A defeat costs the whole run and charges again. Retrying the
            // failed FIGHT would make three fights on one HP bar meaningless —
            // the attrition is the test (ruling #103).
            onRetry: () => {
              resetBattle();
              enterTrial(event);
            },
            onQuit: () => {
              resetBattle();
              backToBoard();
            },
          }}
        />
        <Deck />
      </Screen>
    );
  }

  // ---- The battle road, between two fights ----
  if (view.kind === "trialBreak") {
    const { event, run } = view;
    const encounter = getTrialEncounter(event.id);
    if (!encounter) return <TrialMissing onBack={backToBoard} />;
    // Max HP rides on the run now. It used to be looked up from the battle
    // store here, which `resetBattle()` empties one line before this view is
    // set — so every living bar drew 100%. See `FightOutcome.maxHp`.
    const summaries = fightSummaries(run);
    return (
      <Screen width="none">
        <TrialRail
          fights={encounter.fights}
          cleared={run.fightIndex}
          bars={runHealthBars(run)}
          lastFight={summaries[summaries.length - 1]}
          onContinue={() => {
            launchFight(event, run);
            setView({ kind: "trialBattle", event, run });
          }}
          onQuit={backToBoard}
        />
      </Screen>
    );
  }

  if (view.kind === "autoResults") {
    return (
      <AutoClearResults
        eventName={view.event.name}
        runs={view.runs}
        totals={view.rewards}
        onBack={backToBoard}
      />
    );
  }

  if (view.kind === "results") {
    return (
      <BossClearSummary
        eventName={view.event.name}
        rewards={view.rewards}
        onBack={backToBoard}
      />
    );
  }

  if (view.kind === "trialResults") {
    return (
      <TrialClearSummary
        eventName={view.event.name}
        wall={view.wall}
        rankBefore={view.rankBefore}
        rankAfter={view.rankAfter}
        run={view.run}
        fights={
          view.run ? getTrialEncounter(view.event.id)?.fights : undefined
        }
        onBack={backToBoard}
      />
    );
  }

  if (view.kind === "brief") {
    const event = view.event;
    return (
      <EventBrief
        event={event}
        state={{
          roster,
          team,
          difficulty,
          difficulties,
          currentStamina,
          accountRank: account.rank,
          rankCap,
          clearedWalls: account.clearedWalls,
          clearedEvents,
          autoClearTickets,
          notice,
        }}
        onBack={backToBoard}
        onPickDifficulty={setDifficulty}
        onPickTeam={setTeam}
        onEnter={() => enter(event)}
        onAutoClear={(runs) => runAutoClear(event, runs)}
      />
    );
  }

  return (
    <EventsBoard
      events={visibleEvents}
      lockReasonFor={(event) =>
        eventLockReason(event, account.rank, account.clearedWalls)
      }
      stamina={currentStamina}
      accountRank={account.rank}
      worldLevel={worldLevel}
      onSelect={(event) => {
        setDifficulty(Math.min(worldLevel, rankCap));
        setNotice(null);
        setView({ kind: "brief", event });
      }}
    />
  );
}

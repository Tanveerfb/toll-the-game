"use client";

import React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AutoClearConfirm from "@/components/game/AutoClearConfirm";
import BattleArena from "@/components/game/BattleArena";
import Deck from "@/components/game/Deck";
import TeamPicker, { toTeamPicks } from "@/components/game/TeamPicker";
import { useBattleContext } from "@/hooks/BattleProvider";
import { useScreenMusic } from "@/hooks/useScreenMusic";
import { useGameStore } from "@/store/gameStore";
import { usePlayerStore } from "@/store/playerStore";
import { getCurrentStamina, STAMINA_CAP } from "@/lib/game/stamina";
import {
  addRewards,
  emptyRewards,
  getBossTier,
  rollWorldBossRewards,
  tierKey,
  type WorldBossRewards,
} from "@/lib/game/worldBossRewards";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  getCharacterById,
  type CharacterData,
} from "@/lib/game/characterCatalog";
import {
  eventLockReason,
  eventPhaseCount,
  GAME_EVENTS,
  isEventVisible,
  type GameEvent,
} from "@/lib/game/events";
import { clearedChapterMap } from "@/lib/game/storyCatalog";
import { useStoryStore } from "@/store/storyStore";
import {
  availableDifficulties,
  enemyLevelForDifficulty,
  worldLevelCapForRank,
} from "@/lib/game/worldLevel";
import ItemIcon from "@/components/game/ItemIcon";
import { materialLabel } from "@/lib/game/materials";
import {
  AUTO_CLEAR_IS_NEVER_FIRST_CLEAR,
  autoClearAvailability,
  maxBatchSize,
} from "@/lib/game/autoClear";
import DetailOverlay from "@/components/game/DetailOverlay";
import TrialRail from "@/components/game/events/TrialRail";
import {
  beginRun,
  runHealthBars,
  waveTeam,
  type StageRunState,
} from "@/lib/game/stageRun";
import { foldWaveFromBattle } from "@/lib/game/waveDriver";
import { getTrialEncounter } from "@/lib/game/trialEncounters";

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
    }
  /**
   * A trial in progress. Unlike the boss, a trial is a RUN — several fights on
   * one HP bar — so the screen has to hold the run between them; the battle
   * store only ever knows about the fight it is in.
   */
  | { kind: "trialBattle"; event: GameEvent; run: StageRunState }
  /** The battle road between two fights (Tanveer, 2026-09-16). */
  | { kind: "trialBreak"; event: GameEvent; run: StageRunState }
  /** Auto Clear's per-run breakdown plus the combined haul. Separate from
   *  `results` because it reports many runs and never came from a battle. */
  | {
      kind: "autoResults";
      event: GameEvent;
      rewards: WorldBossRewards;
      runs: AutoClearRun[];
    };

/** Shown only if a trial view outlives its encounter — a configuration error,
 *  not a player-facing state. It exists so the guard has somewhere to go. */
function TrialMissing({ onBack }: { onBack: () => void }) {
  return (
    <main className="terminal-grid flex min-screen-below-nav items-center justify-center bg-void px-4">
      <div className="w-full max-w-md border border-edge-strong bg-panel p-5">
        <p className="font-body text-sm text-readout-dim">
          This trial has no encounter authored.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 min-h-11 w-full border border-signal bg-signal/12 py-3 text-center font-body text-[11px] font-bold uppercase tracking-[0.18em] text-signal"
        >
          Back to events
        </button>
      </div>
    </main>
  );
}

/** One skipped fight, as the results table reports it. */
interface AutoClearRun {
  id: string;
  staminaUsed: number;
  staminaAfter: number;
  rewards: WorldBossRewards;
}

/** `[iconId, label, amount]`. The id is what `ItemIcon` resolves art from and
 *  is empty for a payout with nothing to draw. */
type RewardRow = [string, string, number];
/** The same, with the amount already formatted — ranges can't be numbers. */
type PreviewRow = [string, string, string];

/** * A clear's payout, itemised, zeroes dropped.
 *
 * A boss clear pays SEVEN things. The results screen used to list four of them
 * — no gems, no permanent ticket, no account XP — and `WORLD_BOSS_AND_ASCENSION_PLAN.md`
 * had lost track of the same three, which is how a design doc and a results
 * screen can quietly agree with each other and both be wrong (2026-08-13).
 * Read from the reward object so a new field can't be forgotten twice.
 */
function rewardRows(rewards: WorldBossRewards): RewardRow[] {
  const rows: RewardRow[] = [
    ["sea_monster_eye", materialLabel("sea_monster_eye"), rewards.sea_monster_eye],
    ["corroded_seaweed", materialLabel("corroded_seaweed"), rewards.corroded_seaweed],
    ["training_manual", materialLabel("training_manual"), rewards.training_manual],
    [
      "training_manual_advanced",
      materialLabel("training_manual_advanced"),
      rewards.training_manual_advanced,
    ],
    [
      "training_manual_premium",
      materialLabel("training_manual_premium"),
      rewards.training_manual_premium,
    ],
    ["coin", "Coin", rewards.coin],
    ["gems", "Gems", rewards.gems],
    ["permanent_ticket", "Permanent Ticket", rewards.permanentTicket],
    // Account XP is a number, not a thing you hold — no icon exists and none
    // should, so its id is empty and `ItemIcon` renders nothing for it.
    ["", "Account XP", rewards.accountXp],
  ];
  return rows.filter(([, , value]) => value > 0);
}

/** What the brief promises. Ranges, not guarantees — the roll happens on
 *  victory (`rollWorldBossRewards`), and the brief exists to answer "what am I
 *  playing for", which nothing did before. */
/** One tier's farmable table, as ranges. Built from the tier so it cannot
 *  drift from what the fight actually pays. */
function farmablePreview(difficulty: number): PreviewRow[] {
  const { farmable } = getBossTier(difficulty);
  const bonus = ([base, chance]: [number, number]) =>
    chance > 0 ? `${base}–${base + 1}` : `${base}`;
  const range = ([min, max]: [number, number]) =>
    max > min ? `${min.toLocaleString()}–${max.toLocaleString()}` : `${min}`;
  const rows: PreviewRow[] = [
    [
      "sea_monster_eye",
      materialLabel("sea_monster_eye"),
      bonus(farmable.sea_monster_eye),
    ],
    [
      "corroded_seaweed",
      materialLabel("corroded_seaweed"),
      bonus(farmable.corroded_seaweed),
    ],
    [
      "training_manual",
      materialLabel("training_manual"),
      range(farmable.training_manual),
    ],
    [
      "training_manual_advanced",
      materialLabel("training_manual_advanced"),
      range(farmable.training_manual_advanced),
    ],
    [
      "training_manual_premium",
      materialLabel("training_manual_premium"),
      range(farmable.training_manual_premium),
    ],
    ["coin", "Coin", range(farmable.coin)],
    ["", "Account XP", `${farmable.accountXp}`],
  ];
  // A tier that doesn't drop a manual tier shouldn't advertise "0".
  return rows.filter(([, , value]) => value !== "0");
}

/** The one-off bundle for a tier. Fixed amounts, never rolled and never
 *  scaled — each tier's bundle is authored at the value it should pay
 *  (Tanveer, 2026-08-13: "first clear doesn't need to scale with world level"). */
function firstClearPreview(difficulty: number): PreviewRow[] {
  return rewardRows(getBossTier(difficulty).firstClear).map(
    ([id, label, value]): PreviewRow => [id, label, value.toLocaleString()],
  );
}

/**
 * Auto Clear's results, as Tanveer specified them: a row per skipped run
 * carrying that run's id, the stamina it cost and what was left afterwards,
 * with its rewards behind a button; then a totals row with the same button for
 * the combined haul.
 *
 * A row per run rather than one merged number because the runs are not
 * identical — each rolls its own drops, and a rank-up mid-batch refills the
 * bar, which the stamina-after column shows as the jump it was.
 */
function AutoClearResults({
  event,
  runs,
  totals,
  onBack,
}: {
  event: GameEvent;
  runs: AutoClearRun[];
  totals: WorldBossRewards;
  onBack: () => void;
}): React.JSX.Element {
  // `null` = closed. A run id or "total" names which breakdown is open, so one
  // modal serves every row instead of one per run.
  const [open, setOpen] = React.useState<string | null>(null);
  const openRun = runs.find((run) => run.id === open);
  const openRewards = open === "total" ? totals : openRun?.rewards;
  const totalStamina = runs.reduce((sum, run) => sum + run.staminaUsed, 0);

  return (
    <main className="terminal-grid flex min-screen-below-nav items-center justify-center bg-void px-4 py-6">
      <div className="w-full max-w-lg border border-edge-strong bg-panel">
        <div className="border-b border-hairline bg-inset px-5 py-4">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-signal">
            {event.name} · auto cleared
          </p>
          <p className="font-heading text-2xl tracking-[0.08em] text-readout-strong">
            {runs.length} run{runs.length === 1 ? "" : "s"}
          </p>
        </div>

        <Table className="min-w-[26rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Instance</TableHead>
              <TableHead className="px-2 text-right">Stamina</TableHead>
              <TableHead className="px-2 text-right">Remaining</TableHead>
              <TableHead className="text-right">Rewards</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-mono">{run.id}</TableCell>
                <TableCell className="px-2 text-right tabular-nums text-readout-dim">
                  −{run.staminaUsed}
                </TableCell>
                <TableCell className="px-2 text-right tabular-nums text-readout-dim">
                  {run.staminaAfter}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setOpen(run.id)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="uppercase tracking-[0.14em] text-readout-strong">
                Total
              </TableCell>
              <TableCell className="px-2 text-right tabular-nums text-readout-strong">
                −{totalStamina}
              </TableCell>
              <TableCell className="px-2 text-right tabular-nums text-readout-muted">
                {runs[runs.length - 1]?.staminaAfter ?? 0}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setOpen("total")}
                >
                  View all
                </Button>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        <div className="px-5 py-4">
          <button
            type="button"
            onClick={onBack}
            className="w-full border border-edge-strong py-3 text-center font-body text-[11px] font-bold uppercase tracking-[0.18em] text-readout transition-colors hover:border-signal hover:text-signal"
          >
            Back to events
          </button>
        </div>
      </div>

      {openRewards ? (
        <DetailOverlay
          title={open === "total" ? "All rewards" : "Run rewards"}
          subtitle={open === "total" ? `${runs.length} runs combined` : open!}
          onClose={() => setOpen(null)}
        >
          <div className="flex flex-col gap-1.5">
            {rewardRows(openRewards).map(([id, label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 border-b border-hairline pb-1.5 last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-2 font-body text-sm text-readout-dim">
                  <ItemIcon id={id} size={26} alt="" />
                  {label}
                </span>
                <span className="font-heading text-lg tabular-nums text-readout-strong">
                  +{value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </DetailOverlay>
      ) : null}
    </main>
  );
}

function EventCard({
  event,
  lockReason,
  onSelect,
}: {
  event: GameEvent;
  lockReason: string | null;
  onSelect: () => void;
}): React.JSX.Element {
  const art = event.enemyId ? getCharacterArt(event.enemyId) : null;
  const phases = eventPhaseCount(event);
  const locked = lockReason !== null;
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onSelect}
      className={`flex items-stretch gap-3 border bg-panel p-2.5 text-left transition-colors ${
        locked
          ? "border-hairline opacity-55"
          : "border-hairline hover:border-edge-strong"
      }`}
    >
      <span className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden border border-edge bg-inset">
        {art ? (
          <Image
            src={art}
            alt=""
            fill
            sizes="72px"
            className="object-cover object-top"
          />
        ) : (
          // Only reached by an event with no authored encounter — the two
          // ascension trials. Every fightable enemy resolves art, bosses
          // included (`getCharacterArt` maps NPC ids to `public/npc/`).
          //
          // Always the skull, never a lock. The right-hand slot below carries
          // that, and it is the slot that answers "where does this row take
          // me"; this one is a portrait placeholder, and a lock here says
          // nothing about the enemy. The two always coincided — the fallback
          // fires only for the trials, which are the only locked events — so a
          // locked trial drew two locks and a reason chip for one fact
          // (browser audit, 2026-09-01).
          <span className="font-heading text-2xl text-readout-muted">☠</span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-signal">
          {event.kicker}
        </span>
        <span className="font-heading text-xl leading-tight tracking-[0.04em] text-readout-strong">
          {event.name}
        </span>
        <span className="font-body text-xs text-readout-dim">
          {event.summary}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {locked ? (
            <span className="border border-hairline px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-muted">
              {lockReason}
            </span>
          ) : (
            <>
              <span className="border border-hairline px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-muted">
                {event.staminaCost} stamina
              </span>
              <span className="border border-hairline px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-muted">
                {event.repeatable ? "Repeatable" : "One clear"}
              </span>
              {phases > 1 ? (
                <span className="border border-hairline px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-muted">
                  {phases} phases
                </span>
              ) : null}
            </>
          )}
        </span>
      </span>

      <span className="flex shrink-0 items-center text-readout-muted">
        {locked ? (
          <Lock className="h-4 w-4" strokeWidth={2} />
        ) : (
          <ChevronRight className="h-5 w-5" strokeWidth={2} />
        )}
      </span>
    </button>
  );
}

export default function EventsPage(): React.JSX.Element {
  const { startCustomBattle } = useBattleContext();
  const resetBattle = useGameStore((s) => s.resetBattle);
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
  const clearedStages = useStoryStore((s) => s.cleared);

  /**
   * The board lists what the player may *see*; `eventLockReason` then decides
   * what they may enter. Two questions, and events answer them differently —
   * the first trial is visible at rank 1 and locked until 20, while the second
   * is withheld until the first is behind you (ruling in `docs/HANDOFF.md`,
   * 2026-09-01).
   */
  const visibleEvents = React.useMemo(() => {
    const clearedChapters = clearedChapterMap(clearedStages);
    return GAME_EVENTS.filter((event) =>
      isEventVisible(event, {
        accountRank: account.rank,
        clearedWalls: account.clearedWalls,
        clearedChapters,
      }),
    );
  }, [clearedStages, account.rank, account.clearedWalls]);
  const spendAutoClearRun = usePlayerStore((s) => s.spendAutoClearRun);

  const [view, setView] = React.useState<View>({ kind: "board" });
  const [team, setTeam] = React.useState<CharacterData[]>([]);
  const [difficulty, setDifficulty] = React.useState<number>(worldLevel);
  const [notice, setNotice] = React.useState<string | null>(null);
  /**
   * A pending Auto Clear, awaiting a run count. Auto Clear used to spend the
   * whole affordable batch on one tap — a full bar of stamina and every ticket
   * that fit — with no way to ask for fewer (Tanveer, 2026-08-13). `maxRuns` is
   * frozen at the moment the button was pressed so the slider's ceiling can't
   * move under the player's finger while the modal is open.
   */
  const [autoConfirm, setAutoConfirm] = React.useState<{
    event: GameEvent;
    maxRuns: number;
  } | null>(null);

  useScreenMusic(
    view.kind === "battle"
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

  /** Starts the wave the run is currently on, carrying HP forward. */
  const launchWave = React.useCallback(
    (event: GameEvent, run: StageRunState) => {
      const encounter = getTrialEncounter(event.id);
      const wave = encounter?.waves[run.waveIndex];
      if (!wave) return;
      startCustomBattle(waveTeam(run), wave.enemies, {
        stageEffects: wave.stageEffects,
        victoryAtEnemyHpPercent: wave.victoryAtEnemyHpPercent,
        // Wave 1 passes an empty map and everyone starts full; every later wave
        // carries the survivors' HP. No heal between fights — ruling #103, and
        // the whole point of the format.
        carryHp: run.carryHp,
      });
    },
    [startCustomBattle],
  );

  /**
   * Enter a trial: one stamina charge buys the whole run, not each fight.
   *
   * Charging per wave would make a three-fight trial cost three times a boss
   * run for a single one-off clear, and the `staminaCost` authored on the
   * event is one number describing one attempt.
   */
  const enterTrial = React.useCallback(
    (event: GameEvent) => {
      const encounter = getTrialEncounter(event.id);
      if (!encounter || encounter.waves.length === 0) return;
      if (!spendStaminaAction(event.staminaCost)) {
        setNotice("Not enough stamina — wait for it to regenerate.");
        return;
      }
      setNotice(null);
      if (team.length > 0) rememberLastTeam(team.map((c) => c.id));
      const run = beginRun(event.id, encounter, toTeamPicks(team));
      launchWave(event, run);
      setView({ kind: "trialBattle", event, run });
    },
    [spendStaminaAction, team, rememberLastTeam, launchWave],
  );

  const enter = React.useCallback(
    (event: GameEvent) => {
      // A trial is a multi-wave run and takes the other path entirely.
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
      ]);
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
        // Never a first clear: the unlock gate guarantees one already happened,
        // and gems are first-clear only.
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
          staminaUsed: staminaBefore - getCurrentStamina(
            usePlayerStore.getState().stamina,
          ),
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

  if (view.kind === "battle") {
    return (
      <main className="terminal-grid screen-below-nav relative flex flex-col overflow-hidden bg-void text-readout">
        <BattleArena
          contextLabel={view.event.name}
          worldBoss={{
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
                  setView({ kind: "board" });
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
              setView({ kind: "board" });
            },
          }}
        />
        <Deck />
      </main>
    );
  }

  if (view.kind === "autoResults") {
    return (
      <AutoClearResults
        event={view.event}
        runs={view.runs}
        totals={view.rewards}
        onBack={() => setView({ kind: "board" })}
      />
    );
  }

  if (view.kind === "results") {
    const rows = rewardRows(view.rewards);
    return (
      <main className="terminal-grid flex min-screen-below-nav items-center justify-center bg-void px-4">
        <div className="w-full max-w-md border border-edge-strong bg-panel">
          <div className="border-b border-hairline bg-inset px-5 py-4">
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-signal">
              {view.event.name} cleared
            </p>
            <p className="font-heading text-2xl tracking-[0.08em] text-readout-strong">
              Rewards
            </p>
          </div>
          <div className="flex flex-col gap-1.5 px-5 py-4">
            {rows.map(([id, label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 border-b border-hairline pb-1.5 last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-2 font-body text-sm text-readout-dim">
                  <ItemIcon id={id} size={26} alt="" />
                  {label}
                </span>
                <span className="font-heading text-lg tabular-nums text-readout-strong">
                  +{value.toLocaleString()}
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setView({ kind: "board" })}
              className="mt-3 border border-signal bg-signal/12 py-3 text-center font-body text-[11px] font-bold uppercase tracking-[0.18em] text-signal transition-colors hover:bg-signal/20"
            >
              Back to events
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---- A trial fight ----
  if (view.kind === "trialBattle") {
    const { event, run } = view;
    const encounter = getTrialEncounter(event.id);
    // Defensive: this view is only ever constructed after `enterTrial` has
    // already resolved an encounter. Rendering a way out beats setting state
    // during render, which React would warn about and which would loop.
    if (!encounter) return <TrialMissing onBack={() => setView({ kind: "board" })} />;
    return (
      <main className="terminal-grid screen-below-nav relative flex flex-col overflow-hidden bg-void text-readout">
        <BattleArena
          contextLabel={`${event.name} · Fight ${run.waveIndex + 1}/${run.waveCount}`}
          worldBoss={{
            onContinue: () => {
              const folded = foldWaveFromBattle(run, useGameStore.getState());
              resetBattle();
              if (!folded.complete) {
                setView({ kind: "trialBreak", event, run: folded });
                return;
              }
              // Last fight won — the wall comes down. Nothing is rolled: a
              // trial pays no loot table, the lifted cap IS the reward.
              const wall = event.clearsWall;
              if (wall === undefined) {
                setView({ kind: "board" });
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
              setView({ kind: "board" });
            },
          }}
        />
        <Deck />
      </main>
    );
  }

  // ---- The battle road, between two fights ----
  if (view.kind === "trialBreak") {
    const { event, run } = view;
    const encounter = getTrialEncounter(event.id);
    // Defensive: this view is only ever constructed after `enterTrial` has
    // already resolved an encounter. Rendering a way out beats setting state
    // during render, which React would warn about and which would loop.
    if (!encounter) return <TrialMissing onBack={() => setView({ kind: "board" })} />;
    // Max HP comes from the units as they were actually built for the last
    // fight — levels and stage effects included — rather than the catalog.
    const maxHpOf = (id: string) =>
      useGameStore.getState().playerTeam.find((unit) => unit.id === id)?.hp ??
      run.carryHp[id] ??
      1;
    return (
      <main className="terminal-grid min-screen-below-nav bg-void text-readout">
        <TrialRail
          waves={encounter.waves}
          cleared={run.waveIndex}
          bars={runHealthBars(run, maxHpOf)}
          onContinue={() => {
            launchWave(event, run);
            setView({ kind: "trialBattle", event, run });
          }}
          onQuit={() => setView({ kind: "board" })}
        />
      </main>
    );
  }

  if (view.kind === "trialResults") {
    const gained = view.rankAfter - view.rankBefore;
    return (
      <main className="terminal-grid flex min-screen-below-nav items-center justify-center bg-void px-4">
        <div className="w-full max-w-md border border-edge-strong bg-panel">
          <div className="border-b border-hairline bg-inset px-5 py-4">
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-signal">
              {view.event.name} cleared
            </p>
            <p className="font-heading text-2xl tracking-[0.08em] text-readout-strong">
              Rank {view.wall} cap lifted
            </p>
          </div>
          <div className="flex flex-col gap-3 px-5 py-4">
            <p className="font-body text-sm text-readout-dim">
              {gained > 0
                ? // The banked-XP payout is the reason a wall doesn't punish
                  // you for playing through it — say so, because the ranks
                  // arrive all at once and otherwise read as a glitch.
                  `Account rank ${view.rankBefore} → ${view.rankAfter}. Everything you earned against the wall paid out at once, and stamina is full.`
                : `Account rank ${view.rankAfter}. Ranks climb again from here.`}
            </p>
            <div className="flex items-center justify-between gap-3 border-b border-hairline pb-1.5">
              <span className="font-body text-sm text-readout-dim">
                Account rank
              </span>
              <span className="font-heading text-lg tabular-nums text-readout-strong">
                {view.rankAfter}
                {gained > 0 ? ` (+${gained})` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setView({ kind: "board" })}
              className="mt-3 border border-signal bg-signal/12 py-3 text-center font-body text-[11px] font-bold uppercase tracking-[0.18em] text-signal transition-colors hover:bg-signal/20"
            >
              Back to events
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (view.kind === "brief") {
    const event = view.event;
    const enemy = event.enemyId ? getCharacterById(event.enemyId) : null;
    const art = event.enemyId ? getCharacterArt(event.enemyId) : null;
    const phases = eventPhaseCount(event);
    const enemyLevel = enemyLevelForDifficulty(difficulty);
    const canEnter =
      team.length > 0 && currentStamina >= event.staminaCost && !!event.enemyId;

    const auto = autoClearAvailability({
      eligible: event.autoClearEligible === true,
      clearedEvents,
      eventId: event.id,
      // Per tier: beating world level 1 doesn't unlock farming world level 4.
      difficulty,
      tickets: autoClearTickets,
      stamina: currentStamina,
      staminaCost: event.staminaCost,
    });
    const autoRuns = Math.min(auto.affordable, maxBatchSize(event.staminaCost));

    return (
      <main className="terminal-grid min-screen-below-nav bg-void">
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-6 md:px-8">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => setView({ kind: "board" })}
              className="flex items-center gap-1 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-signal"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.6} />
              Events
            </button>
            <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-readout-muted">
              {event.kicker}
            </span>
            <h1 className="w-full font-heading text-3xl tracking-[0.06em] text-readout-strong">
              {event.name}
            </h1>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_20rem]">
            <div className="flex flex-col gap-3">
              <div className="flex gap-3 border border-edge-strong bg-panel p-3">
                <span className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border border-edge bg-inset">
                  {art ? (
                    <Image
                      src={art}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover object-top"
                    />
                  ) : (
                    <span className="font-heading text-4xl text-readout-muted">
                      ☠
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-heading text-xl tracking-[0.05em] text-readout-strong">
                    {enemy?.name ?? event.name}
                  </p>
                  <p className="font-body text-[10px] font-bold uppercase tracking-[0.14em] text-readout-muted">
                    {enemy?.tier === "elite" ? "Elite" : "Standard"}
                    {phases > 1 ? ` · ${phases} phases` : ""}
                  </p>
                  {enemy ? (
                    <div className="mt-2 flex gap-4">
                      {(
                        [
                          ["HP", enemy.hp],
                          ["ATK", enemy.atk],
                          ["DEF", enemy.def],
                        ] as const
                      ).map(([label, value]) => (
                        <span key={label}>
                          <span className="block font-body text-[9px] font-bold uppercase tracking-[0.16em] text-readout-muted">
                            {label}
                          </span>
                          <span className="block font-heading text-base tabular-nums text-readout-strong">
                            {value.toLocaleString()}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 font-body text-[10px] font-bold uppercase tracking-[0.12em] text-signal">
                    Level {enemyLevel} at difficulty {difficulty}
                  </p>
                </div>
              </div>

              <div className="border border-hairline bg-panel p-3">
                <p className="mb-2 border-b border-hairline pb-1.5 font-body text-[9px] font-bold uppercase tracking-[0.22em] text-readout-muted">
                  Difficulty
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((level) => {
                    const allowed = difficulties.includes(level);
                    const active = difficulty === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        disabled={!allowed}
                        onClick={() => setDifficulty(level)}
                        className={`border px-2 py-2 text-center transition-colors ${
                          active
                            ? "border-signal bg-signal/10"
                            : "border-edge bg-inset hover:border-edge-strong"
                        } disabled:opacity-40`}
                      >
                        <span
                          className={`block font-heading text-lg ${active ? "text-signal" : "text-readout-strong"}`}
                        >
                          {level}
                        </span>
                        <span className="block font-body text-[9px] font-bold uppercase tracking-[0.08em] text-readout-muted">
                          {/* No multiplier here any more: difficulty pays
                              through its own reward table, not a coefficient
                              (ruling #80). The old "×2.05" was advertising a
                              bonus the code never applied. */}
                          {!allowed
                            ? "Locked"
                            : clearedEvents.includes(tierKey(event.id, level))
                              ? "Cleared"
                              : "New"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 font-body text-[11px] leading-snug text-readout-muted">
                  World level {rankCap} is your cap at account rank{" "}
                  {account.rank}. Each difficulty is its own fight with its own
                  one-off bundle and its own drop table — and each has to be
                  beaten before it can be auto cleared.
                </p>
              </div>

              {event.kind === "boss" ? (
                <div className="border border-hairline bg-panel p-3">
                  {/* Two lists, because a fight pays two different things: a
                      one-off bundle and the farm. Showing them merged is what
                      made the old preview read as "you get this every time". */}
                  {!clearedEvents.includes(tierKey(event.id, difficulty)) ? (
                    <>
                      <p className="mb-2 border-b border-hairline pb-1.5 font-body text-[9px] font-bold uppercase tracking-[0.22em] text-el-light">
                        First clear · once only
                      </p>
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {firstClearPreview(difficulty).map(([id, label, amount]) => (
                          <span
                            key={label}
                            className="flex min-w-[7rem] flex-1 items-center gap-2 border border-el-light/40 bg-el-light/5 px-2.5 py-1.5"
                          >
                            <ItemIcon id={id} size={28} alt="" />
                            <span className="min-w-0">
                              <span className="block font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-muted">
                                {label}
                              </span>
                              <span className="block font-heading text-base text-readout-strong">
                                {amount}
                              </span>
                            </span>
                          </span>
                        ))}
                      </div>
                    </>
                  ) : null}

                  <p className="mb-2 border-b border-hairline pb-1.5 font-body text-[9px] font-bold uppercase tracking-[0.22em] text-readout-muted">
                    Every clear
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {farmablePreview(difficulty).map(([id, label, range]) => (
                      <span
                        key={label}
                        className="flex min-w-[7rem] flex-1 items-center gap-2 border border-hairline bg-inset px-2.5 py-1.5"
                      >
                        <ItemIcon id={id} size={28} alt="" />
                        <span className="min-w-0">
                          <span className="block font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-muted">
                            {label}
                          </span>
                          <span className="block font-heading text-base text-readout-strong">
                            {range}
                          </span>
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 font-body text-[11px] leading-snug text-readout-muted">
                    {clearedEvents.includes(tierKey(event.id, difficulty))
                      ? "Ranges, not promises — the roll happens on victory. This difficulty's first-clear bundle is already paid."
                      : "The bundle above is fixed and pays once, for this difficulty. Everything below rolls, every time."}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <TeamPicker ownedIds={roster} team={team} onChange={setTeam} />

              {notice ? (
                <p className="border-l-2 border-el-red bg-el-red/5 px-3 py-2 font-body text-xs text-el-red">
                  {notice}
                </p>
              ) : null}

              <div className="flex items-center gap-3 border border-edge-strong bg-panel p-3">
                <span>
                  <span className="block font-body text-[9px] font-bold uppercase tracking-[0.18em] text-readout-muted">
                    Cost
                  </span>
                  <span className="font-heading text-2xl text-readout-strong">
                    {event.staminaCost}
                  </span>
                  <span className="ml-1.5 font-body text-[10px] text-readout-muted">
                    of {currentStamina} stamina
                  </span>
                </span>
                {/* Auto Clear sits beside Enter, never replacing it. Hidden
                    outright on an ineligible event — a permanently disabled
                    control on the trials would only raise a question the
                    answer to is "never". */}
                {auto.eligible ? (
                  <button
                    type="button"
                    disabled={autoRuns < 1}
                    onClick={() => setAutoConfirm({ event, maxRuns: autoRuns })}
                    title={
                      auto.blocker === "locked"
                        ? "Clear this fight yourself once to unlock Auto Clear."
                        : auto.blocker === "no-tickets"
                          ? "No Auto Clear Tickets."
                          : auto.blocker === "no-stamina"
                            ? "Not enough stamina — Auto Clear still pays the full cost."
                            : `Skip ${autoRuns} run${autoRuns === 1 ? "" : "s"}`
                    }
                    className="ml-auto border border-edge-strong px-4 py-3 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-readout transition-colors hover:border-signal hover:text-signal disabled:border-hairline disabled:text-readout-muted"
                  >
                    {/* No ticket count here. It read "Auto clear ×15" and was
                        taken to mean fifteen skips already used (Tanveer,
                        2026-08-13) — a bare ×N beside a verb reads as a count
                        of the verb. The balance belongs in the confirm modal,
                        where it is shown as a before → after shift next to the
                        run count actually being spent. The button's own job is
                        to be pressable or not: `autoRuns < 1` covers zero
                        tickets, so a player with none can never reach the
                        modal. */}
                    Auto clear
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!canEnter}
                  onClick={() => enter(event)}
                  className={`${auto.eligible ? "" : "ml-auto "}border border-signal bg-signal/12 px-5 py-3 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-signal transition-colors hover:bg-signal/20 disabled:border-hairline disabled:bg-transparent disabled:text-readout-muted`}
                >
                  Enter battle
                </button>
              </div>

              {auto.eligible && auto.blocker === "locked" ? (
                <p className="border-l-2 border-edge-strong bg-inset px-3 py-2 font-body text-xs text-readout-dim">
                  Beat {event.name} once yourself to unlock Auto Clear. A ticket
                  skips the fight — it never skips the stamina.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {autoConfirm ? (
          <AutoClearConfirm
            eventName={autoConfirm.event.name}
            difficulty={difficulty}
            maxRuns={autoConfirm.maxRuns}
            staminaCost={autoConfirm.event.staminaCost}
            stamina={currentStamina}
            tickets={autoClearTickets}
            dropRows={farmablePreview(difficulty)}
            onCancel={() => setAutoConfirm(null)}
            onConfirm={(runs) => {
              const target = autoConfirm.event;
              setAutoConfirm(null);
              runAutoClear(target, runs);
            }}
          />
        ) : null}
      </main>
    );
  }

  return (
    <main className="terminal-grid min-screen-below-nav bg-void">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-6 md:px-8">
        <header className="border-l-2 border-signal pl-3">
          <span className="block font-body text-[10px] font-bold uppercase tracking-[0.34em] text-signal">
            Operations board
          </span>
          <h1 className="font-heading text-3xl leading-none tracking-[0.1em] text-readout md:text-4xl">
            Events
          </h1>
          <p className="mt-1 font-body text-[11px] text-readout-muted">
            Stamina {currentStamina} / {STAMINA_CAP} · account rank{" "}
            {account.rank} · world level {worldLevel}
          </p>
        </header>

        <div className="flex flex-col gap-2">
          {visibleEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              lockReason={eventLockReason(
                event,
                account.rank,
                account.clearedWalls,
              )}
              onSelect={() => {
                setDifficulty(Math.min(worldLevel, rankCap));
                setNotice(null);
                setView({ kind: "brief", event });
              }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

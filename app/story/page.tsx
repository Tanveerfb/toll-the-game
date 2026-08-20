"use client";

import React from "react";
import BattleArena from "@/components/game/BattleArena";
import Deck from "@/components/game/Deck";
import StorySceneReader from "@/components/game/StorySceneReader";
import ChapterList from "@/components/game/story/ChapterList";
import ChapterTitleCard from "@/components/game/story/ChapterTitleCard";
import StageBrief from "@/components/game/story/StageBrief";
import StageList from "@/components/game/story/StageList";
import StageResult from "@/components/game/story/StageResult";
import StoryStage from "@/components/game/story/StoryStage";
import VersusSplash from "@/components/game/story/VersusSplash";
import WaveBreak from "@/components/game/story/WaveBreak";
import { useAuth } from "@/hooks/AuthProvider";
import { useBattleContext } from "@/hooks/BattleProvider";
import { useScreenMusic } from "@/hooks/useScreenMusic";
import type { MusicRole } from "@/lib/audio/tracks";
import { describeOrderReward, ordersForStage } from "@/lib/game/orders";
import {
  evaluateMissions,
  type MissionOutcome,
  type StageRunSummary,
} from "@/lib/game/stageMissions";
import {
  applyWaveOutcome,
  beginRun,
  runHealthBars,
  toSummary,
  waveEnemies,
  waveTeam,
  type StageRunState,
} from "@/lib/game/stageRun";
import {
  buildStoryIndex,
  getStoryChapter,
  getStoryStage,
  stageAfter,
  stageKey,
  stageLabel,
  visibleChapters,
} from "@/lib/game/storyCatalog";
import { rollStageRewards, type StageClearResult } from "@/lib/game/storyRewards";
import { resolveStoryTeam } from "@/lib/game/storyTeam";
import { useGameStore } from "@/store/gameStore";
import { usePlayerStore } from "@/store/playerStore";
import { useStoryStore } from "@/store/storyStore";
import type { StoryStage as StoryStageData, StoryTeamPick } from "@/types/story";

/**
 * Story mode v2 — **Chapter → Stage**, waves instead of a board.
 *
 * ```
 * chapters → stages → brief → title → intro → [versus → wave → break] × N → outro → result
 *                                  └──────── skipped on a farm run ────────┘
 * ```
 *
 * The loop in the middle is the mode: a stage is 1–3 fights sharing one HP pool,
 * and `lib/game/stageRun.ts` owns who survived at what. This file is the
 * orchestration — which view is up, when stamina is charged, and what a clear
 * pays — and every rule it applies lives in a pure module next to a test.
 */

/** What the player is looking at. `run` rides along on every in-stage view so a
 *  wave, a scene and a break all agree on the same attrition state. */
type View =
  | { kind: "chapters" }
  | { kind: "stages"; chapterId: string }
  | { kind: "brief"; chapterId: string; stageId: string }
  | { kind: "title"; run: StageRunState; skipScenes: boolean }
  | { kind: "scene"; which: "intro" | "outro"; run: StageRunState; skipScenes: boolean }
  | { kind: "versus"; run: StageRunState; skipScenes: boolean }
  | { kind: "battle"; run: StageRunState; skipScenes: boolean }
  | { kind: "break"; run: StageRunState; skipScenes: boolean }
  | {
      kind: "result";
      chapterId: string;
      stageId: string;
      run: StageRunSummary;
      missions: MissionOutcome[];
      result: StageClearResult;
      firstClear: boolean;
    };

/** Which track each step asks for. Requesting the role that's already playing is
 *  a no-op in the controller, so chapters → stages → brief is one continuous
 *  piece of music rather than three restarts. */
function musicRoleFor(view: View): MusicRole {
  switch (view.kind) {
    case "title":
    case "scene":
      return "storyScene";
    case "versus":
    case "battle":
    case "break":
      return "battle";
    case "result":
      return "victory";
    default:
      return "story";
  }
}

export default function StoryPage(): React.JSX.Element {
  const { user } = useAuth();
  const { startCustomBattle } = useBattleContext();
  const { resetBattle } = useGameStore();
  const cleared = useStoryStore((s) => s.cleared);
  const claimedMissions = useStoryStore((s) => s.missions);
  const completeStage = useStoryStore((s) => s.completeStage);
  const hydrateFromCloud = useStoryStore((s) => s.hydrateFromCloud);
  const roster = usePlayerStore((s) => s.roster);
  const stamina = usePlayerStore((s) => s.stamina);
  const spendStaminaAction = usePlayerStore((s) => s.spendStaminaAction);
  const grantStoryRewards = usePlayerStore((s) => s.grantStoryRewards);
  const rememberLastTeam = usePlayerStore((s) => s.rememberLastTeam);
  const claimedOrders = usePlayerStore((s) => s.claimedOrders);
  const [view, setView] = React.useState<View>({ kind: "chapters" });

  useScreenMusic(musicRoleFor(view));

  React.useEffect(() => {
    if (user) void hydrateFromCloud(user.uid);
  }, [user, hydrateFromCloud]);

  const ownedIds = roster;

  /** Launches the wave the run is currently on, carrying HP forward. */
  const launchWave = React.useCallback(
    (run: StageRunState) => {
      const stage = getStoryStage(run.chapterId, run.stageId);
      if (!stage) return;
      const wave = stage.waves[run.waveIndex];
      if (!wave) return;
      startCustomBattle(waveTeam(run), wave.enemies, {
        stageEffects: wave.stageEffects,
        victoryAtEnemyHpPercent: wave.victoryAtEnemyHpPercent,
        // Wave 1 passes an empty map and everyone starts full; every later wave
        // carries the survivors' HP (ruling #103).
        carryHp: run.carryHp,
      });
    },
    [startCustomBattle],
  );

  /**
   * Reads the wave that just ended off the battle store and folds it into the run.
   *
   * Done here rather than inside the engine because none of it is a combat rule:
   * survivors and their HP come from `playerTeam`, turns from the store's counter,
   * and ultimates from the typed event stream. `combat.ts` — the most ruling-dense
   * file in the repo — is untouched by the wave model.
   */
  const foldWave = React.useCallback((run: StageRunState): StageRunState => {
    const battle = useGameStore.getState();
    const survivors = battle.playerTeam
      .filter((unit) => unit.currentHP > 0)
      .map((unit) => ({ id: unit.id, hp: unit.currentHP }));
    const fallenIds = battle.playerTeam
      .filter((unit) => unit.currentHP <= 0)
      .map((unit) => unit.id);
    // One pass over the player's actions: ultimates and ranked cards are
    // mutually exclusive, since an ultimate carries no rank at all. `rank` is
    // optional on the event and an absent rank reads as 1, matching the
    // sequencer's own convention.
    let ultimates = 0;
    const rankUses: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    for (const event of battle.battleEvents) {
      if (event.kind !== "action" || event.sourceTeam !== "player") continue;
      if (event.isUlt) ultimates += 1;
      else rankUses[event.rank ?? 1] += 1;
    }
    return applyWaveOutcome(run, {
      survivors,
      fallenIds,
      turns: battle.playerTurns,
      ultimates,
      rankUses,
    });
  }, []);

  /**
   * Pays out a finished stage and marks it cleared.
   *
   * All inside the transition rather than an effect: an effect that granted
   * rewards would run twice under React's development double-invoke, and "was
   * this a first clear" has to be read *before* the store flips it.
   */
  const finishStage = React.useCallback(
    (run: StageRunState) => {
      const chapter = getStoryChapter(run.chapterId);
      const stage = getStoryStage(run.chapterId, run.stageId);
      if (!chapter || !stage) {
        setView({ kind: "chapters" });
        return;
      }
      const summary = toSummary(run);
      const isFirstClear = cleared[stageKey(run.chapterId, run.stageId)] !== true;
      const outcomes = evaluateMissions(stage, chapter.id, summary, claimedMissions);
      const result = rollStageRewards(stage.rewards, isFirstClear, outcomes);

      grantStoryRewards(result.total);
      completeStage(
        run.chapterId,
        run.stageId,
        outcomes.filter((outcome) => outcome.paysNow).map((outcome) => outcome.mission.id),
        user?.uid,
      );
      setView({
        kind: "result",
        chapterId: run.chapterId,
        stageId: run.stageId,
        run: summary,
        missions: outcomes,
        result,
        firstClear: isFirstClear,
      });
    },
    [cleared, claimedMissions, completeStage, grantStoryRewards, user?.uid],
  );

  /** Pays for one attempt. Charged on **every** attempt, first try included
   *  (ruling #100). A stage authored at 0 is free. */
  const chargeAttempt = React.useCallback(
    (stage: StoryStageData): boolean =>
      stage.stamina === 0 || spendStaminaAction(stage.stamina),
    [spendStaminaAction],
  );

  /**
   * Brief → stage. Returns false when the attempt can't be paid for, leaving the
   * player on the brief with its insufficient-stamina notice.
   */
  const beginStage = React.useCallback(
    (
      chapterId: string,
      stageId: string,
      picks: string[],
      skipScenes: boolean,
      useTrialFor: string[],
      isRetry = false,
    ): boolean => {
      const stage = getStoryStage(chapterId, stageId);
      if (!stage) return false;
      if (!chargeAttempt(stage)) return false;
      // Remembered on launch, not on selection — a team you assembled and then
      // abandoned isn't the one you want back next time.
      if (picks.length > 0) rememberLastTeam(picks);

      const team: StoryTeamPick[] = resolveStoryTeam(
        stage,
        picks,
        ownedIds,
        useTrialFor,
      );
      const run = beginRun(chapterId, stage, team, isRetry);

      // A scene stage has nothing to fight: the reader *is* the stage, and a
      // farm run of one would be paying stamina to skip everything, so `skip`
      // pays out immediately.
      if (stage.waves.length === 0) {
        if (skipScenes) finishStage(run);
        else setView({ kind: "scene", which: "intro", run, skipScenes });
        return true;
      }

      setView(
        skipScenes
          ? { kind: "versus", run, skipScenes }
          : { kind: "title", run, skipScenes },
      );
      return true;
    },
    [chargeAttempt, finishStage, ownedIds, rememberLastTeam],
  );

  /** A view whose chapter or stage no longer resolves is stale state — reset
   *  during render rather than from an effect, which would paint the broken view
   *  for a frame first. The `setView` makes the branch unreachable next render, so
   *  it cannot loop. */
  const bounce = (): React.JSX.Element => {
    setView({ kind: "chapters" });
    return <StoryStage variant="page" />;
  };

  // ---- Battle ----
  if (view.kind === "battle") {
    const { run } = view;
    const stage = getStoryStage(run.chapterId, run.stageId);
    const chapter = getStoryChapter(run.chapterId);
    if (!stage || !chapter) return bounce();
    const last = run.waveIndex + 1 >= run.waveCount;
    return (
      <StoryStage variant="stage" grid>
        <BattleArena
          contextLabel={`${stageLabel(chapter, stage)} · Wave ${run.waveIndex + 1}/${run.waveCount}`}
          story={{
            onContinue: () => {
              const folded = foldWave(run);
              resetBattle();
              // The break screen carries the attrition into the next wave. On the
              // final wave it is skipped: the outro (or the payout) is the beat
              // that belongs there.
              if (!last) {
                setView({ kind: "break", run: folded, skipScenes: view.skipScenes });
                return;
              }
              if (view.skipScenes) finishStage(folded);
              else
                setView({
                  kind: "scene",
                  which: "outro",
                  run: folded,
                  skipScenes: view.skipScenes,
                });
            },
            // A defeat restarts the whole stage and charges again — the same rule
            // the board had, and what stops a 3-wave stage becoming three free
            // attempts at the last fight. The retry flag is what `firstAttempt`
            // missions read.
            onRetry: () => {
              resetBattle();
              if (
                beginStage(
                  run.chapterId,
                  run.stageId,
                  run.team.map((pick) => pick.id),
                  true,
                  [],
                  true,
                )
              ) {
                return;
              }
              setView({ kind: "brief", chapterId: run.chapterId, stageId: run.stageId });
            },
            // Losing because the team was wrong used to cost a four-step detour.
            // It doesn't refund the failed attempt — starting from the brief
            // charges afresh, exactly as the long way round did.
            onChangeTeam: () => {
              resetBattle();
              setView({ kind: "brief", chapterId: run.chapterId, stageId: run.stageId });
            },
            onQuit: () => {
              resetBattle();
              setView({ kind: "stages", chapterId: run.chapterId });
            },
          }}
        />
        <Deck />
      </StoryStage>
    );
  }

  // ---- Between waves ----
  if (view.kind === "break") {
    const { run } = view;
    const stage = getStoryStage(run.chapterId, run.stageId);
    if (!stage) return bounce();
    const maxHpOf = (id: string) =>
      useGameStore.getState().playerTeam.find((unit) => unit.id === id)?.hp ??
      run.carryHp[id] ??
      1;
    return (
      <StoryStage variant="stage">
        <WaveBreak
          cleared={run.waveIndex}
          total={run.waveCount}
          bars={runHealthBars(run, maxHpOf)}
          onContinue={() => setView({ kind: "versus", run, skipScenes: view.skipScenes })}
          onQuit={() => setView({ kind: "stages", chapterId: run.chapterId })}
        />
      </StoryStage>
    );
  }

  // ---- VS splash ----
  if (view.kind === "versus") {
    const { run } = view;
    const stage = getStoryStage(run.chapterId, run.stageId);
    const chapter = getStoryChapter(run.chapterId);
    if (!stage || !chapter) return bounce();
    return (
      <StoryStage variant="stage">
        <VersusSplash
          playerTeam={waveTeam(run)}
          enemyTeam={waveEnemies(stage, run)}
          chapterTitle={`${stage.name} · Wave ${run.waveIndex + 1}`}
          onDone={() => {
            launchWave(run);
            setView({ kind: "battle", run, skipScenes: view.skipScenes });
          }}
        />
      </StoryStage>
    );
  }

  // ---- Scenes ----
  if (view.kind === "scene") {
    const { run } = view;
    const stage = getStoryStage(run.chapterId, run.stageId);
    const chapter = getStoryChapter(run.chapterId);
    if (!stage || !chapter) return bounce();
    const scenes = view.which === "intro" ? stage.intro : stage.outro;
    return (
      <StoryStage variant="stage">
        <StorySceneReader
          scenes={scenes}
          chapterTitle={`${stageLabel(chapter, stage)} · ${stage.name}`}
          fallbackBackgroundId={chapter.localeId}
          confirmSkip={cleared[stageKey(run.chapterId, run.stageId)] !== true}
          onFinish={() => {
            if (view.which === "intro") {
              // A scene stage's intro runs straight into its outro; a battle
              // stage's intro runs into wave 1.
              if (stage.waves.length === 0) {
                setView({ kind: "scene", which: "outro", run, skipScenes: view.skipScenes });
              } else {
                setView({ kind: "versus", run, skipScenes: view.skipScenes });
              }
              return;
            }
            finishStage(run);
          }}
        />
      </StoryStage>
    );
  }

  // ---- Stage title card ----
  if (view.kind === "title") {
    const { run } = view;
    const stage = getStoryStage(run.chapterId, run.stageId);
    const chapter = getStoryChapter(run.chapterId);
    if (!stage || !chapter) return bounce();
    return (
      <StoryStage variant="stage">
        <ChapterTitleCard
          chapterNumber={chapter.number}
          title={stage.name}
          partTitle={`${chapter.title} · ${stageLabel(chapter, stage)}`}
          onDone={() => {
            if (stage.intro.length > 0) {
              setView({ kind: "scene", which: "intro", run, skipScenes: view.skipScenes });
            } else {
              setView({ kind: "versus", run, skipScenes: view.skipScenes });
            }
          }}
        />
      </StoryStage>
    );
  }

  // ---- Result ----
  if (view.kind === "result") {
    const chapter = getStoryChapter(view.chapterId);
    const stage = getStoryStage(view.chapterId, view.stageId);
    if (!chapter || !stage) return bounce();
    /**
     * Where the story goes next, offered only after a **first clear** (ruling #97).
     * On a replay it would advertise a jump to wherever the player actually is,
     * which reads as a bug rather than a shortcut.
     */
    const after = view.firstClear
      ? stageAfter(cleared, view.chapterId, view.stageId)
      : null;
    // A Bureau Order this clear just satisfied and hasn't been claimed yet.
    const order = ordersForStage(view.chapterId, view.stageId)[0];
    const unlock =
      order && claimedOrders[order.id] !== true
        ? describeOrderReward(order.reward)
        : null;
    return (
      <StoryStage variant="stage">
        <StageResult
          chapterTitle={chapter.title}
          stageLabel={stageLabel(chapter, stage)}
          stageName={stage.name}
          run={view.run}
          missions={view.missions}
          result={view.result}
          next={
            after
              ? {
                  label: stageLabel(after.chapter, after.stage),
                  name: after.stage.name,
                }
              : null
          }
          unlock={unlock}
          attemptCost={stage.stamina}
          onNext={
            after
              ? () =>
                  setView({
                    kind: "brief",
                    chapterId: after.chapter.id,
                    stageId: after.stage.id,
                  })
              : undefined
          }
          // Straight back to the brief, which is where a farm loop wants to
          // restart: the team is remembered and one tap runs it again.
          onAgain={() =>
            setView({ kind: "brief", chapterId: view.chapterId, stageId: view.stageId })
          }
          onStages={() => setView({ kind: "stages", chapterId: view.chapterId })}
        />
      </StoryStage>
    );
  }

  // ---- Brief ----
  if (view.kind === "brief") {
    const chapter = getStoryChapter(view.chapterId);
    const stage = getStoryStage(view.chapterId, view.stageId);
    if (!chapter || !stage) return bounce();
    return (
      <StoryStage variant="page">
        <StageBrief
          chapter={chapter}
          stage={stage}
          label={stageLabel(chapter, stage)}
          cleared={cleared[stageKey(view.chapterId, view.stageId)] === true}
          claimedMissions={claimedMissions}
          stamina={stamina.current}
          onStart={(picks, skipScenes, useTrialFor) => {
            beginStage(view.chapterId, view.stageId, picks, skipScenes, useTrialFor);
          }}
          onBack={() => setView({ kind: "stages", chapterId: view.chapterId })}
        />
      </StoryStage>
    );
  }

  // ---- Stage list ----
  if (view.kind === "stages") {
    const chapter = getStoryChapter(view.chapterId);
    const index = buildStoryIndex(cleared, claimedMissions).find(
      (entry) => entry.id === view.chapterId,
    );
    if (!chapter || !index) return bounce();
    return (
      <StoryStage variant="page">
        <StageList
          index={index}
          chapter={chapter}
          onSelectStage={(stageId) =>
            setView({ kind: "brief", chapterId: view.chapterId, stageId })
          }
          onBack={() => setView({ kind: "chapters" })}
        />
      </StoryStage>
    );
  }

  // ---- Chapter list ----
  return (
    <StoryStage variant="page">
      <ChapterList
        chapters={visibleChapters(cleared, claimedMissions)}
        onSelect={(chapterId) => setView({ kind: "stages", chapterId })}
      />
    </StoryStage>
  );
}

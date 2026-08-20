import { getCharacterById } from "@/lib/game/characterCatalog";
import type { StoryMission, StoryMissionGoal, StoryStage } from "@/types/story";

/**
 * Stage missions — up to three optional objectives per stage, each paid once.
 *
 * Built as a general evaluator over a **summary of the run**, not as checks
 * wired into the battle. That boundary is the point: `combat.ts` is the most
 * ruling-dense file in the repo and a mission type is not a combat rule, so the
 * story shell counts what happened and this file decides what it was worth. A
 * new goal type is one union member, one `case`, and one test.
 *
 * Two rules that are design, not implementation:
 *  - **A mission is never lost.** Clearing a stage without meeting one leaves it
 *    claimable forever, so no stage becomes content a player can no longer
 *    finish. Nothing here records failure — only what a run satisfied.
 *  - **Turns are counted across the whole run**, not per wave. A `withinTurns`
 *    mission on a 3-wave stage is a budget for the stage, which is what makes it
 *    a real constraint on an attrition run rather than three easy checks.
 */

/**
 * What a completed stage run did, gathered by the story shell as the waves play.
 *
 * Deliberately flat and serialisable: it is assembled from `gameStore` counters
 * plus the typed `battleEvents` stream, and every field is something a player
 * could see happen.
 */
export interface StageRunSummary {
  /** Waves actually won. Compared against the stage's authored count. */
  wavesCleared: number;
  wavesTotal: number;
  /** Player turns taken across every wave. */
  turns: number;
  /** Character ids that started the run, bench included. */
  fielded: string[];
  /** Character ids that fell at any point. Persisting deaths across waves is
   *  what makes `noLosses` meaningful (his ruling #103). */
  fallen: string[];
  /** Player ultimates fired across every wave. */
  ultimatesUsed: number;
  /**
   * Player cards played across every wave, counted by rank.
   *
   * Keyed 1/2/3 rather than an array so a missing rank reads as absent instead
   * of as index confusion. Ultimates are excluded at the counting site — they
   * have no rank, so folding them in would make a rank goal satisfiable by
   * something that isn't a ranked card at all.
   */
  rankUses: Record<1 | 2 | 3, number>;
  /** True when this attempt followed a defeat on the same stage without leaving
   *  the stage shell — what `firstAttempt` disqualifies. */
  isRetry: boolean;
}

export function emptyRunSummary(wavesTotal: number): StageRunSummary {
  return {
    wavesCleared: 0,
    wavesTotal,
    turns: 0,
    fielded: [],
    fallen: [],
    ultimatesUsed: 0,
    rankUses: { 1: 0, 2: 0, 3: 0 },
    isRetry: false,
  };
}

/** How many units carrying `tag` the run fielded. Tags live on the kit
 *  (`[FEMALE]`, `[COLLAB]`), so this reads the catalog rather than trusting the
 *  caller to have resolved them. */
function taggedCount(fielded: string[], tag: string): number {
  const needle = tag.toLowerCase();
  return fielded.filter((id) =>
    (getCharacterById(id)?.tags ?? []).some(
      (owned) => owned.toLowerCase() === needle,
    ),
  ).length;
}

/**
 * Whether one goal is satisfied by a run.
 *
 * Every goal implicitly requires the run to have been a clear — an unfinished
 * run has `wavesCleared < wavesTotal`, and `isCleared` gates the whole
 * evaluation in `evaluateMissions`, so a goal like `noLosses` can't be met by
 * losing without casualties.
 */
export function isGoalMet(goal: StoryMissionGoal, run: StageRunSummary): boolean {
  switch (goal.type) {
    case "noLosses":
      return run.fallen.length === 0;
    case "withinTurns":
      return run.turns <= goal.turns;
    case "fieldCharacter":
      // Bench counts: a sub's passive is active from it (ruling #7), so the unit
      // genuinely took part.
      return run.fielded.includes(goal.characterId);
    case "fieldTag":
      return taggedCount(run.fielded, goal.tag) >= goal.count;
    case "useUltimates":
      return run.ultimatesUsed >= goal.count;
    case "useSkillRank":
      return (run.rankUses[goal.rank] ?? 0) >= goal.count;
    case "firstAttempt":
      return !run.isRetry;
    case "allWaves":
      return run.wavesCleared >= run.wavesTotal;
  }
}

export function isCleared(run: StageRunSummary): boolean {
  return run.wavesTotal > 0
    ? run.wavesCleared >= run.wavesTotal
    : // A scene stage has no waves; reaching the end of it *is* the clear.
      true;
}

export interface MissionOutcome {
  mission: StoryMission;
  /** Met by this run. */
  met: boolean;
  /** Already banked before this run — `met` may still be true, but it pays
   *  nothing. */
  alreadyClaimed: boolean;
  /** Met now and unclaimed: this run pays it. */
  paysNow: boolean;
}

/** Persisted key for one mission's claim state. */
export function missionKey(
  chapterId: string,
  stageId: string,
  missionId: string,
): string {
  return `${chapterId}:${stageId}:${missionId}`;
}

/**
 * Resolves every mission on a stage against a run and what's already banked.
 *
 * Returns an entry per mission — including ones this run didn't meet — because
 * the result screen shows all three with the unmet ones marked open rather than
 * hiding them.
 */
export function evaluateMissions(
  stage: StoryStage,
  chapterId: string,
  run: StageRunSummary,
  claimed: Record<string, boolean>,
): MissionOutcome[] {
  const cleared = isCleared(run);
  return stage.missions.map((mission) => {
    const alreadyClaimed =
      claimed[missionKey(chapterId, stage.id, mission.id)] === true;
    const met = cleared && isGoalMet(mission.goal, run);
    return {
      mission,
      met,
      alreadyClaimed,
      paysNow: met && !alreadyClaimed,
    };
  });
}

/** Missions banked over a whole chapter — the `4 / 13` on a chapter card. */
export function missionProgress(
  stages: StoryStage[],
  chapterId: string,
  claimed: Record<string, boolean>,
): { claimed: number; total: number } {
  let banked = 0;
  let total = 0;
  for (const stage of stages) {
    for (const mission of stage.missions) {
      total += 1;
      if (claimed[missionKey(chapterId, stage.id, mission.id)] === true) {
        banked += 1;
      }
    }
  }
  return { claimed: banked, total };
}

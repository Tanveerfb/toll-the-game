import { emptyRunSummary, type StageRunSummary } from "@/lib/game/stageMissions";
import type { StoryTeamPick } from "@/types/story";
import type { StageEffect } from "@/types/stageEffects";

/**
 * A stage run in progress — the fight loop's state, kept pure.
 *
 * A stage is 1–3 fights fought back to back. **HP carries over and the fallen stay
 * down** (his ruling #103), so the run — not the battle — owns who is still
 * standing and at what. `BattleProvider` builds each fight from `carryHp`, which
 * is exactly what this produces.
 *
 * Deliberately not in the store and not in React: the interesting rules here are
 * arithmetic (who survived, what the run is worth, whether the stage is done) and
 * they are worth testing without mounting a provider. The screen holds one of
 * these in state and hands it back on every fight result.
 *
 * **Not story-specific.** It was, until the First Ascension Trial needed the
 * same three-fights-one-HP-bar rule from the events board (2026-09-16). What it
 * actually needs is an id and a list of fights, so that is what it asks for —
 * `RunnableEncounter`, which `StoryStage` satisfies structurally without
 * changing. The alternative was authoring a trial as a fake story stage, which
 * would have dragged scenes, missions, chapter rewards and an origin tag along
 * with it, none of which a trial has.
 */

/**
 * The minimum a thing needs to be fought as a run.
 *
 * `StoryStage` matches this already. An events-board encounter provides the
 * same two fields and nothing else.
 */
export interface RunnableEncounter {
  id: string;
  fights: {
    enemies: StoryTeamPick[];
    stageEffects?: StageEffect[];
    victoryAtEnemyHpPercent?: number;
  }[];
}

export interface FightOutcome {
  /** Surviving player units and their HP as the fight ended. */
  survivors: { id: string; hp: number }[];
  /** Player units that fell during this fight. */
  fallenIds: string[];
  /** Player turns this fight took. */
  turns: number;
  /** Player ultimates fired this fight. */
  ultimates: number;
  /** Player cards played this fight, by rank. Ultimates excluded — no rank. */
  rankUses: Record<1 | 2 | 3, number>;
}

export interface StageRunState {
  /**
   * Who owns this encounter — a chapter id for story, the event id for a
   * trial. Named neutrally because the runner is shared; it was `chapterId`
   * until the trial started using it.
   */
  ownerId: string;
  stageId: string;
  /** Which fight is being fought, 0-based. */
  fightIndex: number;
  fightCount: number;
  /** The lineup the run started with, resolved once on the brief. */
  team: StoryTeamPick[];
  /** Character id → HP going into the next fight. A unit missing from here is
   *  either untouched (fight 1) or dead — `fallen` disambiguates. */
  carryHp: Record<string, number>;
  fallen: string[];
  turns: number;
  ultimatesUsed: number;
  rankUses: Record<1 | 2 | 3, number>;
  /** True once this run follows a defeat on the same stage. */
  isRetry: boolean;
  /** Set when the last fight has been won. */
  complete: boolean;
}

export function beginRun(
  ownerId: string,
  stage: RunnableEncounter,
  team: StoryTeamPick[],
  isRetry = false,
): StageRunState {
  return {
    ownerId,
    stageId: stage.id,
    fightIndex: 0,
    fightCount: stage.fights.length,
    team,
    carryHp: {},
    fallen: [],
    turns: 0,
    ultimatesUsed: 0,
    rankUses: { 1: 0, 2: 0, 3: 0 },
    isRetry,
    complete: stage.fights.length === 0,
  };
}

/**
 * Folds a won fight into the run.
 *
 * Fallen units accumulate across fights and are never revived — that permanence is
 * what makes `noLosses` mean something and what makes a 3-fight stage a resource
 * problem rather than three fights.
 */
export function applyFightOutcome(
  state: StageRunState,
  outcome: FightOutcome,
): StageRunState {
  const carryHp: Record<string, number> = {};
  for (const survivor of outcome.survivors) {
    carryHp[survivor.id] = Math.max(1, Math.round(survivor.hp));
  }
  const fallen = [...state.fallen];
  for (const id of outcome.fallenIds) {
    if (!fallen.includes(id)) fallen.push(id);
  }
  const fightIndex = state.fightIndex + 1;
  return {
    ...state,
    fightIndex,
    carryHp,
    fallen,
    turns: state.turns + outcome.turns,
    ultimatesUsed: state.ultimatesUsed + outcome.ultimates,
    rankUses: {
      1: state.rankUses[1] + outcome.rankUses[1],
      2: state.rankUses[2] + outcome.rankUses[2],
      3: state.rankUses[3] + outcome.rankUses[3],
    },
    complete: fightIndex >= state.fightCount,
  };
}

/**
 * The picks for the fight about to start: the run's lineup minus the fallen.
 *
 * Dropping the dead rather than sending them in at 0 HP keeps the rule visible in
 * the battle itself — a three-unit team really is a two-unit team in fight 2, with
 * the action economy that implies (`actionsForTurn`, ruling #59), which is most of
 * why losing a unit early hurts.
 */
export function fightTeam(state: StageRunState): StoryTeamPick[] {
  const fallen = new Set(state.fallen);
  return state.team.filter((pick) => !fallen.has(pick.id));
}

/** The current fight's authored enemies. */
export function fightEnemies(
  stage: RunnableEncounter,
  state: StageRunState,
): StoryTeamPick[] {
  return stage.fights[state.fightIndex]?.enemies ?? [];
}

/** True when every unit that started the run has fallen — the run is lost, and a
 *  retry restarts the stage and charges stamina again. */
export function isWipe(state: StageRunState): boolean {
  return fightTeam(state).length === 0;
}

/** What the missions are judged against once the last fight is won. */
export function toSummary(state: StageRunState): StageRunSummary {
  return {
    ...emptyRunSummary(state.fightCount),
    fightsCleared: state.fightIndex,
    fightsTotal: state.fightCount,
    turns: state.turns,
    fielded: state.team.map((pick) => pick.id),
    fallen: state.fallen,
    ultimatesUsed: state.ultimatesUsed,
    rankUses: state.rankUses,
    isRetry: state.isRetry,
  };
}

/** Player HP after the current fight, for the run HUD between fights: id →
 *  `{ hp, max }`, with the fallen at 0. */
export function runHealthBars(
  state: StageRunState,
  maxHpOf: (id: string) => number,
): { id: string; hp: number; max: number }[] {
  const fallen = new Set(state.fallen);
  return state.team.map((pick) => {
    const max = maxHpOf(pick.id);
    if (fallen.has(pick.id)) return { id: pick.id, hp: 0, max };
    return { id: pick.id, hp: state.carryHp[pick.id] ?? max, max };
  });
}

import { emptyRunSummary, type StageRunSummary } from "@/lib/game/stageMissions";
import type { StoryStage, StoryTeamPick } from "@/types/story";

/**
 * A stage run in progress — the wave loop's state, kept pure.
 *
 * A stage is 1–3 waves fought back to back. **HP carries over and the fallen stay
 * down** (his ruling #103), so the run — not the battle — owns who is still
 * standing and at what. `BattleProvider` builds each wave from `carryHp`, which
 * is exactly what this produces.
 *
 * Deliberately not in the store and not in React: the interesting rules here are
 * arithmetic (who survived, what the run is worth, whether the stage is done) and
 * they are worth testing without mounting a provider. The story page holds one of
 * these in state and hands it back on every wave result.
 */

export interface WaveOutcome {
  /** Surviving player units and their HP as the wave ended. */
  survivors: { id: string; hp: number }[];
  /** Player units that fell during this wave. */
  fallenIds: string[];
  /** Player turns this wave took. */
  turns: number;
  /** Player ultimates fired this wave. */
  ultimates: number;
}

export interface StageRunState {
  chapterId: string;
  stageId: string;
  /** Which wave is being fought, 0-based. */
  waveIndex: number;
  waveCount: number;
  /** The lineup the run started with, resolved once on the brief. */
  team: StoryTeamPick[];
  /** Character id → HP going into the next wave. A unit missing from here is
   *  either untouched (wave 1) or dead — `fallen` disambiguates. */
  carryHp: Record<string, number>;
  fallen: string[];
  turns: number;
  ultimatesUsed: number;
  /** True once this run follows a defeat on the same stage. */
  isRetry: boolean;
  /** Set when the last wave has been won. */
  complete: boolean;
}

export function beginRun(
  chapterId: string,
  stage: StoryStage,
  team: StoryTeamPick[],
  isRetry = false,
): StageRunState {
  return {
    chapterId,
    stageId: stage.id,
    waveIndex: 0,
    waveCount: stage.waves.length,
    team,
    carryHp: {},
    fallen: [],
    turns: 0,
    ultimatesUsed: 0,
    isRetry,
    complete: stage.waves.length === 0,
  };
}

/**
 * Folds a won wave into the run.
 *
 * Fallen units accumulate across waves and are never revived — that permanence is
 * what makes `noLosses` mean something and what makes a 3-wave stage a resource
 * problem rather than three fights.
 */
export function applyWaveOutcome(
  state: StageRunState,
  outcome: WaveOutcome,
): StageRunState {
  const carryHp: Record<string, number> = {};
  for (const survivor of outcome.survivors) {
    carryHp[survivor.id] = Math.max(1, Math.round(survivor.hp));
  }
  const fallen = [...state.fallen];
  for (const id of outcome.fallenIds) {
    if (!fallen.includes(id)) fallen.push(id);
  }
  const waveIndex = state.waveIndex + 1;
  return {
    ...state,
    waveIndex,
    carryHp,
    fallen,
    turns: state.turns + outcome.turns,
    ultimatesUsed: state.ultimatesUsed + outcome.ultimates,
    complete: waveIndex >= state.waveCount,
  };
}

/**
 * The picks for the wave about to start: the run's lineup minus the fallen.
 *
 * Dropping the dead rather than sending them in at 0 HP keeps the rule visible in
 * the battle itself — a three-unit team really is a two-unit team in wave 2, with
 * the action economy that implies (`actionsForTurn`, ruling #59), which is most of
 * why losing a unit early hurts.
 */
export function waveTeam(state: StageRunState): StoryTeamPick[] {
  const fallen = new Set(state.fallen);
  return state.team.filter((pick) => !fallen.has(pick.id));
}

/** The current wave's authored enemies. */
export function waveEnemies(
  stage: StoryStage,
  state: StageRunState,
): StoryTeamPick[] {
  return stage.waves[state.waveIndex]?.enemies ?? [];
}

/** True when every unit that started the run has fallen — the run is lost, and a
 *  retry restarts the stage and charges stamina again. */
export function isWipe(state: StageRunState): boolean {
  return waveTeam(state).length === 0;
}

/** What the missions are judged against once the last wave is won. */
export function toSummary(state: StageRunState): StageRunSummary {
  return {
    ...emptyRunSummary(state.waveCount),
    wavesCleared: state.waveIndex,
    wavesTotal: state.waveCount,
    turns: state.turns,
    fielded: state.team.map((pick) => pick.id),
    fallen: state.fallen,
    ultimatesUsed: state.ultimatesUsed,
    isRetry: state.isRetry,
  };
}

/** Player HP after the current wave, for the run HUD between fights: id →
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

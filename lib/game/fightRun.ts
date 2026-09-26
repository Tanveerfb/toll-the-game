import type { StageEffect } from "@/types/stageEffects";
import type { TeamPick } from "@/types/teamPick";

/**
 * A fight run in progress — several fights on one HP bar, kept pure.
 *
 * A run is 1–N fights fought back to back. **HP carries over and the fallen
 * stay down** (his ruling #103), so the run — not the battle — owns who is
 * still standing and at what. `BattleProvider` builds each fight from
 * `carryHp`, which is exactly what this produces.
 *
 * Deliberately not in the store and not in React: the interesting rules here
 * are arithmetic (who survived, whether the run is done) and they are worth
 * testing without mounting a provider. The screen holds one of these in state
 * and hands it back on every fight result.
 *
 * **History.** This was `lib/game/stageRun.ts`, built for story mode's stages
 * and shared with the First Ascension Trial from 2026-09-16. Story mode was
 * removed on 2026-09-26; the mission summary and retry flag it carried for
 * story went with it, and the "stage" vocabulary became "fight run".
 */

/** The minimum a thing needs to be fought as a run: an id and its fights. */
export interface RunnableEncounter {
  id: string;
  fights: {
    enemies: TeamPick[];
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
  /**
   * Character id → max HP, as the units were actually built for this fight:
   * level, ascension and stage effects included.
   *
   * It has to be captured here because it exists nowhere else by the time a
   * break screen renders. `resetBattle()` empties `playerTeam`, and the pages
   * call it *before* setting the break view - so a `maxHpOf` read from the
   * store fell through to `carryHp[id]`, making `max` equal `hp` and **every
   * surviving bar read 100%** however hurt the team was. Under the no-heal
   * rule (#103) that figure is the whole carry-on-or-abandon decision.
   */
  maxHp: Record<string, number>;
}

/** What one won fight looked like. See `FightRunState.history`. */
export interface FightRecord {
  /** Player turns this fight took. */
  turns: number;
  /** Player ultimates fired this fight. */
  ultimates: number;
  /** Units that fell during **this** fight, not the run so far. */
  fallen: string[];
  /** HP as this fight ended — the same snapshot `carryHp` takes. */
  carryHp: Record<string, number>;
}

export interface FightRunState {
  /** The encounter being fought — an event id for a trial. */
  encounterId: string;
  /** Which fight is being fought, 0-based. */
  fightIndex: number;
  fightCount: number;
  /** The lineup the run started with, resolved once on the brief. */
  team: TeamPick[];
  /** Character id → HP going into the next fight. A unit missing from here is
   *  either untouched (fight 1) or dead — `fallen` disambiguates. */
  carryHp: Record<string, number>;
  fallen: string[];
  turns: number;
  ultimatesUsed: number;
  rankUses: Record<1 | 2 | 3, number>;
  /**
   * Character id → max HP, accumulated from every fight folded so far.
   * Merged rather than replaced: a unit that fell in fight 1 is not in fight
   * 2's team at all, and its bar still has to draw at zero against a real max.
   */
  maxHp: Record<string, number>;
  /**
   * One record per fight already won, oldest first.
   *
   * The totals above answer "how did the run go"; this answers "how did each
   * fight go", which is what a post-fight banner and an end-of-run recap both
   * need and neither could reconstruct from a running sum.
   */
  history: FightRecord[];
  /** Set when the last fight has been won. */
  complete: boolean;
}

export function beginRun(
  encounter: RunnableEncounter,
  team: TeamPick[],
): FightRunState {
  return {
    encounterId: encounter.id,
    fightIndex: 0,
    fightCount: encounter.fights.length,
    team,
    carryHp: {},
    fallen: [],
    turns: 0,
    ultimatesUsed: 0,
    rankUses: { 1: 0, 2: 0, 3: 0 },
    maxHp: {},
    history: [],
    complete: encounter.fights.length === 0,
  };
}

/**
 * Folds a won fight into the run.
 *
 * Fallen units accumulate across fights and are never revived — that
 * permanence is what makes a multi-fight run a resource problem rather than
 * several separate fights.
 */
export function applyFightOutcome(
  state: FightRunState,
  outcome: FightOutcome,
): FightRunState {
  const carryHp: Record<string, number> = {};
  for (const survivor of outcome.survivors) {
    carryHp[survivor.id] = Math.max(1, Math.round(survivor.hp));
  }
  const fallen = [...state.fallen];
  for (const id of outcome.fallenIds) {
    if (!fallen.includes(id)) fallen.push(id);
  }
  const fightIndex = state.fightIndex + 1;
  // Merge, never replace: fight 2's team does not contain fight 1's casualty,
  // so replacing would lose the max its zeroed bar is drawn against.
  const maxHp = { ...state.maxHp, ...outcome.maxHp };
  return {
    ...state,
    fightIndex,
    carryHp,
    maxHp,
    history: [
      ...state.history,
      {
        turns: outcome.turns,
        ultimates: outcome.ultimates,
        fallen: outcome.fallenIds,
        carryHp,
      },
    ],
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
 * Dropping the dead rather than sending them in at 0 HP keeps the rule visible
 * in the battle itself — a three-unit team really is a two-unit team in fight
 * 2, with the action economy that implies (`actionsForTurn`, ruling #59),
 * which is most of why losing a unit early hurts.
 */
export function fightTeam(state: FightRunState): TeamPick[] {
  const fallen = new Set(state.fallen);
  return state.team.filter((pick) => !fallen.has(pick.id));
}

/** The current fight's authored enemies. */
export function fightEnemies(
  encounter: RunnableEncounter,
  state: FightRunState,
): TeamPick[] {
  return encounter.fights[state.fightIndex]?.enemies ?? [];
}

/** True when every unit that started the run has fallen — the run is lost, and
 *  a retry restarts it and charges stamina again. */
export function isWipe(state: FightRunState): boolean {
  return fightTeam(state).length === 0;
}

/**
 * Player HP after the current fight, for the run HUD between fights: id →
 * `{ hp, max }`, with the fallen at 0.
 *
 * **Both maxima come from the run itself** (`state.maxHp`). It used to take a
 * `maxHpOf` callback, and both callers built one that read `playerTeam` from
 * the battle store - which `resetBattle()` has already emptied by the time a
 * break screen renders. The fallback made `max` equal `hp`, so every living
 * bar drew full. See `FightOutcome.maxHp`.
 */
export function runHealthBars(
  state: FightRunState,
): { id: string; hp: number; max: number }[] {
  const fallen = new Set(state.fallen);
  return state.team.map((pick) => {
    // Before the first fold nothing is known and nothing has been lost, so a
    // unit reads full rather than reading as an error.
    const max = state.maxHp[pick.id] ?? state.carryHp[pick.id] ?? 1;
    if (fallen.has(pick.id)) return { id: pick.id, hp: 0, max };
    return { id: pick.id, hp: state.carryHp[pick.id] ?? max, max };
  });
}

/** One fight, as a post-fight banner or an end-of-run recap reads it. */
export interface FightSummary {
  /** 0-based, matching `history`. */
  index: number;
  turns: number;
  ultimates: number;
  fallen: string[];
  /** Share of the team's total HP pool lost during this fight, 0–100. */
  hpLostPercent: number;
  /** Share of the pool still standing when it ended, 0–100. */
  hpLeftPercent: number;
}

/**
 * Every fought fight, summarised.
 *
 * Percentages are of the **whole team's** pool rather than per unit, because
 * that is the number the no-heal rule makes load-bearing: what the run has
 * left, not who took it. A fight that kills one unit outright and a fight that
 * chips everyone read differently, and both read correctly.
 */
export function fightSummaries(state: FightRunState): FightSummary[] {
  const pool = state.team.reduce(
    (sum, pick) => sum + (state.maxHp[pick.id] ?? 0),
    0,
  );
  const total = (hp: Record<string, number>) =>
    state.team.reduce((sum, pick) => sum + (hp[pick.id] ?? 0), 0);

  return state.history.map((record, index) => {
    // Fight 1 starts from a full pool; every later fight starts from whatever
    // the one before it left.
    const before = index === 0 ? pool : total(state.history[index - 1].carryHp);
    const after = total(record.carryHp);
    const share = (value: number) =>
      pool > 0 ? Math.max(0, Math.min(100, (value / pool) * 100)) : 0;
    return {
      index,
      turns: record.turns,
      ultimates: record.ultimates,
      fallen: record.fallen,
      hpLostPercent: share(Math.max(0, before - after)),
      hpLeftPercent: share(after),
    };
  });
}

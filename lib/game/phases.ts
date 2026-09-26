import { battleStats, unitProgression } from "@/lib/game/battleStats";
import type {
  BattleCharacter,
  CharacterPhase,
} from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import type { StageEffect } from "@/types/stageEffects";

// Multi-phase ("hearts") boss transitions — 7DS GC Ragnarok model. Pure: the
// battle loop calls these when a boss's HP bar empties. Piece 3 of the Molvarr
// engine; loop wiring + multi-passive activation come next.

export function bossPhaseCount(char: { phases?: CharacterPhase[] }): number {
  return char.phases?.length ?? 0;
}

/**
 * Map a team, transitioning any boss whose HP hit 0 into its next phase instead
 * of leaving it dead. Returns the new team + a log line per transition. Call
 * this after any damage to enemies, BEFORE deciding victory — so a phased boss
 * at 0 HP with a later phase is not counted as defeated.
 *
 * `stageEffects` are the fight's, so a boss keeps the arena's modifiers
 * across its break. Every caller has them to hand: the battle store holds
 * them, and the simulator holds them per fight.
 */
export function transitionBossPhases(
  team: BattleCharacter[],
  stageEffects: StageEffect[] = [],
): {
  team: BattleCharacter[];
  transitions: string[];
  breaks: { name: string; phase: number }[];
} {
  const transitions: string[] = [];
  const breaks: { name: string; phase: number }[] = [];
  const next = team.map((c) => {
    if (!shouldAdvancePhase(c)) return c;
    const idx = (c.phaseIndex ?? 0) + 1;
    transitions.push(`${c.name} breaks and enters Phase ${idx + 1}!`);
    breaks.push({ name: c.name, phase: idx + 1 });
    return enterBossPhase(c, idx, stageEffects);
  });
  return { team: next, transitions, breaks };
}

/**
 * A boss whose current HP hit 0 but still has a later phase should transition
 * rather than die.
 */
export function shouldAdvancePhase(char: BattleCharacter): boolean {
  const count = bossPhaseCount(char);
  if (count === 0) return false;
  return char.currentHP <= 0 && (char.phaseIndex ?? 0) < count - 1;
}

/**
 * Build the runtime state for entering a boss phase (0-based). Applies the
 * phase's stat block + skills/ultimate/passive at full HP, and RESETS everything
 * on the boss: buffs, debuffs on it, ult gauge, and per-phase passive state.
 *
 * **The phase's stats go through the same pipeline as the unit's first build**
 * (`battleStats`): its own progression, then the fight's stage effects. This
 * used to copy the phase's raw JSON, so difficulty never reached a later phase
 * (2026-09-26, `tests/battleStats.test.ts`).
 *
 * The caller is responsible for what PERSISTS across the transition — player
 * team state, the global battle turn counter, and boss-applied debuffs already
 * on the players (e.g. Corrosion) — none of which this function touches.
 *
 * NOTE: `passive` holds passives[0] for the legacy single-passive combat hooks,
 * but ALL of a phase's passives are active — the boss engine
 * (lib/game/bossPassives.ts) reads them live from the phase each turn.
 */
export function enterBossPhase(
  base: BattleCharacter,
  phaseIndex: number,
  stageEffects: StageEffect[] = [],
): BattleCharacter {
  const phase = base.phases?.[phaseIndex];
  if (!phase) return base;

  const stats = battleStats(phase, {
    progression: unitProgression(base),
    stageEffects,
    side: base.team,
  });

  return {
    ...base,
    ...stats,
    currentHP: stats.hp,
    currentAttack: stats.atk,
    currentDefense: stats.def,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    phaseIndex,
    // Any-count skills at runtime (the playable 2-tuple type doesn't bind bosses)
    skills: phase.skills as unknown as [SkillCard, SkillCard],
    ultimate: phase.ultimate,
    passive: phase.passives?.[0],
  };
}

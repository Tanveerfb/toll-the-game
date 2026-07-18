import type {
  BattleCharacter,
  CharacterPhase,
} from "@/types/character";
import type { SkillCard } from "@/types/skillCard";

// Multi-phase ("hearts") boss transitions — 7DS GC Ragnarok model. Pure: the
// battle loop calls these when a boss's HP bar empties. Piece 3 of the Molvarr
// engine; loop wiring + multi-passive activation come next.

export function bossPhaseCount(char: { phases?: CharacterPhase[] }): number {
  return char.phases?.length ?? 0;
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
 * The caller is responsible for what PERSISTS across the transition — player
 * team state, the global battle turn counter, and boss-applied debuffs already
 * on the players (e.g. Corrosion) — none of which this function touches.
 *
 * NOTE: multi-passive activation is pending piece 4; for now the first passive
 * of the phase is applied.
 */
export function enterBossPhase(
  base: BattleCharacter,
  phaseIndex: number,
): BattleCharacter {
  const phase = base.phases?.[phaseIndex];
  if (!phase) return base;

  return {
    ...base,
    atk: phase.atk,
    def: phase.def,
    hp: phase.hp,
    currentHP: phase.hp,
    currentAttack: phase.atk,
    currentDefense: phase.def,
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

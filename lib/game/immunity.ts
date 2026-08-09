import type { BattleCharacter } from "@/types/character";
import { activeBossMechanics } from "@/lib/game/bossPassives";

/**
 * Whether a unit is permanently immune to having `stat` lowered.
 *
 * Sourced from a passive (`statDebuffImmunity`), so unlike Debuff Immunity —
 * a temporary blanket block applied by a skill — this is always on and can't
 * be cleansed, cancelled or waited out.
 *
 * Reads through `activeBossMechanics`, so it works for a phased boss (the
 * ACTIVE phase's passives) and for an ordinary unit's single `passive` alike.
 */
export function isImmuneToStatDebuff(
  unit: BattleCharacter,
  stat: string,
): boolean {
  return activeBossMechanics(unit).some(
    (m) => m.type === "statDebuffImmunity" && m.stats?.includes(stat),
  );
}

/** The stats a unit can never have lowered — for display and logging. */
export function immuneStats(unit: BattleCharacter): string[] {
  return activeBossMechanics(unit).flatMap((m) =>
    m.type === "statDebuffImmunity" ? (m.stats ?? []) : [],
  );
}

import type { BattleCharacter } from "@/types/character";
import { getEffectiveHealAmount } from "./heal";

/**
 * Lethal-damage survival (Sara's Nine Lives), shared by direct hits
 * (combat.ts) and DoT procs (tick.ts) — Tanveer's ruling: DoT deaths
 * count too.
 *
 * On trigger the unit survives at `healDamagePercent` of the incoming
 * damage (min 1 HP) and — ruling #29 — is stripped of ALL buffs and
 * debuffs, uncancellable ones included. Applies to any future revival
 * mechanic as well. Once per battle.
 *
 * Mutates `char` in place. Returns the heal amount, or null if the
 * passive didn't trigger (caller then applies death as usual).
 */
export function trySurviveLethal(
  char: BattleCharacter,
  incomingDamage: number,
): number | null {
  if (!char.passive || char.passive.trigger !== "onLethalDamage") return null;
  if (char.passiveState.lethalSurvived) return null;

  const mech = char.passive.mechanics?.find(
    (m) => m.type === "surviveLethal",
  );
  if (!mech || mech.type !== "surviveLethal") return null;

  const hpCondition = (mech.hpConditionPercent ?? 30) / 100;
  if (char.currentHP < char.hp * hpCondition) return null;

  const rawHealAmount = Math.floor(
    incomingDamage * ((mech.healDamagePercent ?? 50) / 100),
  );
  const healAmount = getEffectiveHealAmount(char, rawHealAmount);
  char.currentHP = Math.max(1, healAmount);
  char.passiveState.lethalSurvived = true;
  // Revival wipes the slate: all buffs AND debuffs go, cancellable or not
  char.buffs = [];
  char.debuffs = [];
  return healAmount;
}

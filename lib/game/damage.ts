import { BattleCharacter } from "../../types/character";
import { Mechanic } from "../../types/mechanic";
import type { Color } from "../../types/color";
import { getTypeModifier } from "./typeAdvantage";
import { getEffectiveDefense } from "./stats";

export interface DamageCalculationParams {
  baseDamage: number; // Pre-calculated (e.g. source.currentAttack * skill multiplier)
  skillMechanics: Mechanic[]; // Mechanics provided by the active skill/attack
  target: BattleCharacter;
  attackerColor?: Color; // Enables the type-advantage modifier when provided
}

export function calculateDamage({ baseDamage, skillMechanics, target, attackerColor }: DamageCalculationParams) {
  // Effective defense honors DEF buffs/debuffs (stances, Weaken, Extort)
  let effectiveDefense = getEffectiveDefense(target);

  // CRITICAL (Seras ult): ignores X% defense, ignores type matchups, +X% damage
  const criticalMechanic = skillMechanics.find(m => m.type === "critical");

  // Pierce Calculation (ignores X% of enemy defense)
  const pierceMechanic = skillMechanics.find(m => m.type === "pierce");
  if (pierceMechanic) {
    const piercePercent = pierceMechanic.value || 0;
    effectiveDefense = effectiveDefense * (1 - piercePercent / 100);
  }
  if (criticalMechanic) {
    const ignorePercent = criticalMechanic.ignoreDefensePercent ?? 50;
    effectiveDefense = effectiveDefense * (1 - ignorePercent / 100);
  }

  // 1. Calculate Effective Base Damage (shielded by target Defense)
  const effectiveBaseDamage = Math.max(1, baseDamage - effectiveDefense);

  let extraDamage = 0;

  // Ignite Calculation (+10% extra damage per ignite stack)
  // Automatically applies to ALL attacks against ignited enemies
  const igniteDebuff = target.debuffs.find(d => d.type === "ignite");
  if (igniteDebuff) {
    const stacks = igniteDebuff.stacks || 1;
    extraDamage += effectiveBaseDamage * (0.10 * stacks);
  }

  // Detonate Calculation (+20% extra damage per target's current ult gauge)
  // Only applies if the attacker's skill possesses "detonate"
  if (skillMechanics.find(m => m.type === "detonate")) {
    const ultGauge = target.ultGauge || 0;
    extraDamage += effectiveBaseDamage * (0.20 * ultGauge);
  }

  // Weakpoint Calculation (x3 total damage if target has >= 1 debuff)
  // Only applies if the attacker's skill possesses "weakpoint"
  if (skillMechanics.find(m => m.type === "weakpoint")) {
    const hasDebuff = target.debuffs.length > 0;
    if (hasDebuff) {
      extraDamage += effectiveBaseDamage * 2.0; // Base(1x) + Extra(2x) = 3x total
    }
  }

  // Rupture Calculation (x2 total damage if target has >= 1 buff)
  // Only applies if the attacker's skill possesses "rupture"
  if (skillMechanics.find(m => m.type === "rupture")) {
    const hasBuff = target.buffs.length > 0;
    if (hasBuff) {
      extraDamage += effectiveBaseDamage * 1.0; // Base(1x) + Extra(1x) = 2x total
    }
  }

  // Final sum resolves after all extra damages are dynamically stacked off the effective base
  let damageTaken = effectiveBaseDamage + extraDamage;

  // Type advantage: +20% advantage / -10% disadvantage / neutral 0.
  // CRITICAL attacks ignore the matchup entirely (both directions).
  if (!criticalMechanic) {
    damageTaken *= getTypeModifier(attackerColor, target.color);
  } else {
    damageTaken *= 1 + (criticalMechanic.damageBonusPercent ?? 50) / 100;
  }

  return damageTaken;
}

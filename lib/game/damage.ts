import { BattleCharacter } from "../../types/character";
import { MechanicType } from "../../types/mechanic";

export interface DamageCalculationParams {
  baseDamage: number; // Pre-calculated (e.g. source.currentAttack * skill multiplier)
  skillMechanics: MechanicType[]; // Mechanics provided by the active skill/attack
  target: BattleCharacter;
}

export function calculateDamage({ baseDamage, skillMechanics, target }: DamageCalculationParams) {
  // 1. Calculate Effective Base Damage (shielded by target Defense)
  const effectiveBaseDamage = Math.max(1, baseDamage - target.currentDefense);

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
  if (skillMechanics.includes("detonate")) {
    const ultGauge = target.ultGauge || 0;
    extraDamage += effectiveBaseDamage * (0.20 * ultGauge);
  }

  // Weakpoint Calculation (x3 total damage if target has >= 1 debuff)
  // Only applies if the attacker's skill possesses "weakpoint"
  if (skillMechanics.includes("weakpoint")) {
    const hasDebuff = target.debuffs.length > 0;
    if (hasDebuff) {
      extraDamage += effectiveBaseDamage * 2.0; // Base(1x) + Extra(2x) = 3x total
    }
  }

  // Final sum resolves after all extra damages are dynamically stacked off the effective base
  const damageTaken = effectiveBaseDamage + extraDamage;

  return damageTaken;
}

import { BattleCharacter } from "../../types/character";
import { Mechanic } from "../../types/mechanic";
import type { Color } from "../../types/color";
import { resolveTypeModifier } from "./typeAdvantage";
import { findAnyPassiveMechanic, passiveMechanics } from "./passiveBlocks";
import {
  getEffectiveDefense,
  getDamageDealtMultiplier,
  getDamageReductionMultiplier,
} from "./stats";
import { getEffectiveCritDamage } from "./substats";

export interface DamageCalculationParams {
  baseDamage: number; // Pre-calculated (e.g. source.currentAttack * skill multiplier)
  skillMechanics: Mechanic[]; // Mechanics provided by the active skill/attack
  target: BattleCharacter;
  attackerColor?: Color; // Enables the type-advantage modifier when provided
  attacker?: BattleCharacter; // Enables the attacker's damageDealt modifiers
}

export function calculateDamage({ baseDamage, skillMechanics, target, attackerColor, attacker }: DamageCalculationParams) {
  // Effective defense honors DEF buffs/debuffs (stances, Weaken, Extort)
  let effectiveDefense = getEffectiveDefense(target);

  // CRITICAL (Seras ult): ignores X% defense, ignores type matchups, +X% damage
  const criticalMechanic = skillMechanics.find(m => m.type === "critical");

  // Pierce ignores 50% of enemy defense (Tanveer 2026-07-11: generalized —
  // no per-card pierce values anymore; explicit value still wins if present)
  const pierceMechanic = skillMechanics.find(m => m.type === "pierce");
  if (pierceMechanic) {
    const piercePercent = pierceMechanic.value ?? 50;
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
  // Only applies if the attacker's skill possesses "weakpoint".
  // Ruling #30: uncancellable entries are "effects", not debuffs — excluded.
  if (skillMechanics.find(m => m.type === "weakpoint")) {
    const hasDebuff = target.debuffs.some(d => !d.uncancellable);
    if (hasDebuff) {
      extraDamage += effectiveBaseDamage * 2.0; // Base(1x) + Extra(2x) = 3x total
    }
  }

  // Rupture Calculation (x2 total damage if target has >= 1 buff)
  // Only applies if the attacker's skill possesses "rupture".
  // Ruling #30: uncancellable entries (synergy bonuses etc.) don't count.
  if (skillMechanics.find(m => m.type === "rupture")) {
    const hasBuff = target.buffs.some(b => !b.uncancellable);
    if (hasBuff) {
      extraDamage += effectiveBaseDamage * 1.0; // Base(1x) + Extra(1x) = 2x total
    }
  }

  // Final sum resolves after all extra damages are dynamically stacked off the effective base
  let damageTaken = effectiveBaseDamage + extraDamage;

  // Type advantage: +20% advantage / -10% disadvantage / neutral 0, then
  // [Guard] and [Effective] on top (ruling #111). Both live inside this
  // branch, which is what makes "critical bypasses both" fall out for free
  // rather than needing a guard of its own — a crit discards the matchup.
  //
  // [Effective] is a skill mechanic (a property of the card); [Guard] is a
  // passive on the defender (a property of the unit). Two lookups, each
  // reading the way it naturally does.
  if (!criticalMechanic) {
    damageTaken *= resolveTypeModifier(attackerColor, target.color, {
      attackerEffective: skillMechanics.some((m) => m.type === "effective"),
      defenderGuard: Boolean(findAnyPassiveMechanic(target, "guard")),
    });
  } else {
    const bonus =
      criticalMechanic.damageBonusPercent ??
      (attacker ? getEffectiveCritDamage(attacker) : 50);
    damageTaken *= 1 + bonus / 100;
  }

  // Damage-modifier stats (ruling #36, multiplicative stacking): attacker's
  // damageDealt raises the hit; target's damageReduction shrinks it.
  if (attacker) {
    damageTaken *= getDamageDealtMultiplier(attacker);

    // The attacker's passive inspecting WHO it is hitting: extra damage while
    // the target carries one of the named tags or colours. Symmetric by
    // construction — "our unit hits [Demon] harder" and "this enemy hits
    // [Human] harder" are the same mechanic from opposite sides.
    for (const mech of passiveMechanics(attacker)) {
      if (mech.type !== "targetTagBonus") continue;
      const tagHit = mech.conditionTags?.some((tag) =>
        target.tags?.includes(tag),
      );
      const colorHit = mech.conditionColors?.includes(target.color);
      // A status the target is currently carrying, matched case-insensitively
      // across the three fields the engine actually stores one under, because
      // which field it lands in depends on the status:
      //   - Bleed and Ignite are `{ type: "damageOverTime", name: "Bleed" }`,
      //     so the NAME is the only thing that distinguishes them;
      //   - stun / seal / taunt are their own `type`;
      //   - a stat debuff is identified by `stat`.
      // Author-facing, `conditionStatuses: ["bleed"]` should just work, so this
      // checks all three rather than making the kit know the storage shape.
      const statusHit = mech.conditionStatuses?.some((status) => {
        const needle = status.toLowerCase();
        return target.debuffs.some(
          (d) =>
            d.name?.toLowerCase() === needle ||
            d.type?.toLowerCase() === needle ||
            d.stat?.toLowerCase() === needle,
        );
      });
      if (tagHit || colorHit || statusHit) {
        damageTaken *= 1 + (mech.valuePercent ?? 0) / 100;
      }
    }
  }
  damageTaken *= getDamageReductionMultiplier(target);

  return damageTaken;
}

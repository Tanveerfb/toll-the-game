import { BattleCharacter } from "@/types/character";

/**
 * Effective stats = current stat scaled by percent buff/debuff entries.
 *
 * currentAttack/currentDefense hold the base plus permanently BAKED gains
 * (synergy, Charged stacks, Extort steals — these mutate the current stat
 * directly). Entries marked `preApplied` are display badges for baked gains
 * and are skipped here to avoid double counting.
 *
 * Percent buffs and debuffs both stack MULTIPLICATIVELY (ruling 2026-07-12),
 * matching how the rest of the game reads percentages off effective stats
 * (e.g. damageDealt already compounds). Each +X% buff is a (1 + X/100) factor
 * and each -X% debuff a (1 - X/100) factor, so N stacks of +10% go
 * 100→110→121→… and heavy debuff stacking (-25%,-50%,-25% → ×0.28)
 * approaches but never hits 0 — a fully-weakened unit still deals chip damage.
 * A single ≥100% debuff still floors the stat to 0. Flat values apply after
 * the percent product.
 */
function effectiveStat(char: BattleCharacter, stat: "atk" | "def", current: number): number {
  let buffMult = 1;
  let flat = 0;
  for (const buff of char.buffs) {
    if (buff.preApplied) continue;
    if ((buff.type === "buff" || buff.type === "stance") && (buff.stat === stat || buff.stat === "all")) {
      buffMult *= 1 + (buff.valuePercent ?? buff.value ?? 0) / 100;
      flat += buff.flatValue ?? 0;
    }
  }
  let debuffMult = 1;
  for (const debuff of char.debuffs) {
    if (debuff.type === "debuff" && (debuff.stat === stat || debuff.stat === "all")) {
      const reduction = debuff.valuePercent ?? debuff.value ?? 0;
      debuffMult *= Math.max(0, 1 - reduction / 100);
      flat -= debuff.flatValue ?? 0;
    }
  }
  return Math.max(0, Math.floor(current * buffMult * debuffMult + flat));
}

export function getEffectiveAttack(char: BattleCharacter): number {
  return effectiveStat(char, "atk", char.currentAttack);
}

export function getEffectiveDefense(char: BattleCharacter): number {
  return effectiveStat(char, "def", char.currentDefense);
}

/**
 * Damage-modifier stats (ruling #36): sources stack MULTIPLICATIVELY.
 * These are never baked into currentAttack/currentDefense, so preApplied
 * entries are read here too (unlike effectiveStat).
 */
export function getDamageDealtMultiplier(char: BattleCharacter): number {
  let mult = 1;
  for (const buff of char.buffs) {
    if (buff.stat === "damageDealt") {
      mult *= 1 + (buff.valuePercent ?? buff.value ?? 0) / 100;
    }
  }
  for (const debuff of char.debuffs) {
    if (debuff.stat === "damageDealt") {
      mult *= 1 - (debuff.valuePercent ?? debuff.value ?? 0) / 100;
    }
  }
  return Math.max(0, mult);
}

export function getDamageReductionMultiplier(char: BattleCharacter): number {
  let mult = 1;
  for (const buff of char.buffs) {
    if (buff.stat === "damageReduction") {
      mult *= 1 - (buff.valuePercent ?? buff.value ?? 0) / 100;
    }
  }
  return Math.max(0, mult);
}

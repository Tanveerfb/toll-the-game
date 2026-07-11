import { BattleCharacter } from "@/types/character";

/**
 * Effective stats = current stat scaled by percent buff/debuff entries.
 *
 * currentAttack/currentDefense hold the base plus permanently BAKED gains
 * (synergy, Charged stacks, Extort steals — these mutate the current stat
 * directly). Entries marked `preApplied` are display badges for baked gains
 * and are skipped here to avoid double counting. Everything else — Weaken,
 * Flowing Ruin ATK-down, DEF stances — applies multiplicatively at read time.
 */
function effectiveStat(char: BattleCharacter, stat: "atk" | "def", current: number): number {
  let percent = 0;
  let flat = 0;
  for (const buff of char.buffs) {
    if (buff.preApplied) continue;
    if ((buff.type === "buff" || buff.type === "stance") && (buff.stat === stat || buff.stat === "all")) {
      percent += buff.valuePercent ?? buff.value ?? 0;
      flat += buff.flatValue ?? 0;
    }
  }
  for (const debuff of char.debuffs) {
    if (debuff.type === "debuff" && (debuff.stat === stat || debuff.stat === "all")) {
      percent -= debuff.valuePercent ?? debuff.value ?? 0;
      flat -= debuff.flatValue ?? 0;
    }
  }
  return Math.max(0, Math.floor(current * (1 + percent / 100) + flat));
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

import { BattleCharacter } from "@/types/character";

/**
 * Effective substats = base field (or a hardcoded default if the character's
 * JSON omits it) scaled by percent buff/debuff entries tagged with the
 * matching `stat` key. Stacks MULTIPLICATIVELY, same rule as every other
 * stat in the game (never additive, never reaches 0/runs away) — see
 * lib/game/stats.ts. Unlike ATK/DEF, a generic `stat: "all"` buff/debuff
 * does NOT touch these — "all" stays basic-stats-only (Molvarr/Leorio
 * wording ruling, 2026-07-24).
 */

const DEFAULT_CRIT_DAMAGE_PERCENT = 50;
const DEFAULT_RECOVERY_RATE_PERCENT = 100;
const DEFAULT_LIFESTEAL_PERCENT = 5;
const DEFAULT_CRIT_RESIST_PERCENT = 10;

function effectiveSubstat(
  char: BattleCharacter,
  statKey: string,
  base: number,
): number {
  let mult = 1;
  for (const buff of char.buffs) {
    if (
      (buff.type === "buff" || buff.type === "stance") &&
      buff.stat === statKey
    ) {
      mult *= 1 + (buff.valuePercent ?? buff.value ?? 0) / 100;
    }
  }
  for (const debuff of char.debuffs) {
    if (debuff.type === "debuff" && debuff.stat === statKey) {
      mult *= Math.max(0, 1 - (debuff.valuePercent ?? debuff.value ?? 0) / 100);
    }
  }
  return Math.max(0, Math.floor(base * mult));
}

export function getEffectiveCritDamage(char: BattleCharacter): number {
  return effectiveSubstat(
    char,
    "critDamage",
    char.critDamagePercent ?? DEFAULT_CRIT_DAMAGE_PERCENT,
  );
}

export function getEffectiveRecoveryRate(char: BattleCharacter): number {
  return effectiveSubstat(
    char,
    "recoveryRate",
    char.recoveryRatePercent ?? DEFAULT_RECOVERY_RATE_PERCENT,
  );
}

export function getEffectiveLifesteal(char: BattleCharacter): number {
  return effectiveSubstat(
    char,
    "lifesteal",
    char.lifestealPercent ?? DEFAULT_LIFESTEAL_PERCENT,
  );
}

export function getEffectiveCritResist(char: BattleCharacter): number {
  return effectiveSubstat(
    char,
    "critResist",
    char.critResistPercent ?? DEFAULT_CRIT_RESIST_PERCENT,
  );
}

import { entryAffectsStat } from "@/lib/game/stats";
import { BattleCharacter } from "@/types/character";

/**
 * Effective substats = base field (or a hardcoded default if the character's
 * JSON omits it) scaled by percent buff/debuff entries tagged with the
 * matching `stat` key. Stacks MULTIPLICATIVELY, same rule as every other
 * stat in the game (never additive, never reaches 0/runs away) — see
 * lib/game/stats.ts.
 *
 * `stat: "all"` DOES reach these (changed 2026-08-09). Tanveer's definition:
 * "all stats" = basic stats (ATK/DEF/HP) **plus substats**, excluding damage
 * reduction and evade chance — see ruling #55. This reverses the earlier
 * basic-stats-only reading noted here on 2026-07-24; damage reduction,
 * damageDealt and evade are still read by exact name elsewhere, so "all"
 * cannot touch them.
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
  // Substats are PERCENTAGES, not counts, so a "+5%" modifier adds five
  // percentage points rather than scaling by 1.05 (Tanveer, 2026-08-09):
  // 10% lifesteal buffed 5% is 15% lifesteal, not 10.5%.
  //
  // This is why ATK/DEF/HP scale multiplicatively (`effectiveStat`) while
  // these accumulate additively — and it's the convention `evade.ts` already
  // used. Under the old multiplicative reading Isolde's +10% lifesteal aura
  // computed 5 * 1.1 = 5.5 and floored straight back to 5, doing nothing at
  // all; a +33% evade buff on a 0% base was likewise a no-op.
  //
  // `stat: "all"` reaches these (ruling #55: all stats = basic + substats,
  // minus damage reduction and evade chance, which are read by exact name
  // elsewhere and so stay out of reach).
  let points = 0;
  for (const buff of char.buffs) {
    if (
      (buff.type === "buff" || buff.type === "stance") &&
      entryAffectsStat(buff, statKey)
    ) {
      points += buff.valuePercent ?? buff.value ?? 0;
    }
  }
  for (const debuff of char.debuffs) {
    if (debuff.type === "debuff" && entryAffectsStat(debuff, statKey)) {
      points -= debuff.valuePercent ?? debuff.value ?? 0;
    }
  }
  return Math.max(0, Math.floor(base + points));
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

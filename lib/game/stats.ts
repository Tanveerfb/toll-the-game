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
/**
 * Whether one status entry modifies `stat`.
 *
 * Three ways an entry can say yes, and they mean different things:
 *  - `stat: "atk"`            — exactly that stat
 *  - `stats: ["atk", "def"]`  — exactly those, as ONE effect ("raises ATK and
 *                               DEF" is a single buff, not two — Tanveer,
 *                               2026-08-09)
 *  - `stat: "all"`            — literally every stat
 *
 * Every consumer must go through this rather than comparing `.stat`, or a
 * combined entry silently stops applying to one of its own stats.
 */
export function entryAffectsStat(
  entry: { stat?: string; stats?: string[] },
  stat: string,
): boolean {
  if (entry.stat === stat || entry.stat === "all") return true;
  return entry.stats?.includes(stat) ?? false;
}

/** The three stats every kit has. Ruling #55 names this set "basic stats". */
export const BASIC_STATS = ["atk", "def", "hp"] as const;

const STAT_WORD: Record<string, string> = {
  atk: "ATK",
  def: "DEF",
  hp: "HP",
  damageDealt: "damage dealt",
  damageReduction: "damage taken",
  evade: "evade chance",
  critChance: "crit chance",
  critDamage: "crit damage",
  recoveryRate: "recovery rate",
  lifesteal: "lifesteal",
};

/**
 * How a status entry's stat coverage reads in running text — battle-log lines
 * and anywhere else prose names the stats an effect touches.
 *
 * The vocabulary is Tanveer's (2026-08-13) and predates the `stats` array, so
 * the array has to be translated rather than printed:
 *  - **basic stats** = ATK, DEF, HP — which is exactly what `stats:
 *    ["atk","def","hp"]` means, and every tribe synergy in the roster uses it.
 *  - **all stats** = basic stats plus every substat except evade chance and
 *    damage reduction — spelled `stat: "all"`.
 *  - anything else is a plain list.
 *
 * Deliberately NOT used by `descriptionTranslator.ts` (its keys have to match
 * the description prose Tanveer authored, "raises ATK and DEF") or by the kit
 * preview's `statLabel` (a table column, where "ATK · DEF · HP" is clearer than
 * a category name).
 */
export function statPhrase(entry: { stat?: string; stats?: string[] }): string {
  if (entry.stat === "all") return "all stats";

  const list = entry.stats?.length
    ? entry.stats
    : entry.stat
      ? [entry.stat]
      : [];
  if (list.length === 0) return "stats";
  if (
    list.length === BASIC_STATS.length &&
    BASIC_STATS.every((s) => list.includes(s))
  ) {
    return "basic stats";
  }

  const words = list.map((s) => STAT_WORD[s] ?? s.toUpperCase());
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function effectiveStat(char: BattleCharacter, stat: "atk" | "def", current: number): number {
  let buffMult = 1;
  let flat = 0;
  for (const buff of char.buffs) {
    if (buff.preApplied) continue;
    if ((buff.type === "buff" || buff.type === "stance") && entryAffectsStat(buff, stat)) {
      buffMult *= 1 + (buff.valuePercent ?? buff.value ?? 0) / 100;
      flat += buff.flatValue ?? 0;
    }
  }
  let debuffMult = 1;
  for (const debuff of char.debuffs) {
    if (debuff.type === "debuff" && entryAffectsStat(debuff, stat)) {
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

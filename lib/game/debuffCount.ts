import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";

/**
 * How many DISTINCT debuffs a unit carries - the one counting rule behind
 * [Co-Destruction] (+damage per debuff on the target), the `enemyDebuffs`
 * live bonus (+DEF per debuff on the enemy team) and the `turnStartCleanse`
 * pick (one random debuff).
 *
 * The engine stores debuffs as entries, and the entry count is not the answer
 * a player expects: Ignite is one entry per unit however many stacks it holds,
 * and a second stun is the same stun. So:
 *
 * - **Uncancellable entries do not count.** Ruling #30: they are "effects"
 *   (Frostline's [Cold]), not debuffs - the rule `weakpoint` already uses.
 * - **A stat-down entry (`type: "debuff"`) counts once per entry**, however it
 *   got there. Two separate Weaken casts are two debuffs; so is Extort, which
 *   the engine models as an ATK entry and a DEF entry.
 * - **Every other status counts once per kind**: Ignite at any stack count is
 *   one, Bleed is one, a stun is one, an Attack Seal is one (and an Ultimate
 *   Seal is another).
 */

/** The unit's debuffs grouped as the player counts them: each group is the
 *  indices of the entries that make up ONE debuff. */
export function debuffGroups(
  unit: Pick<BattleCharacter, "debuffs">,
): number[][] {
  const groups: number[][] = [];
  const byKind = new Map<string, number[]>();
  unit.debuffs.forEach((entry: StatusEffect, index) => {
    if (entry.uncancellable) return;
    if (entry.type === "debuff") {
      groups.push([index]);
      return;
    }
    const kind = `${entry.type}|${entry.sealType ?? entry.name ?? ""}`;
    const group = byKind.get(kind);
    if (group) group.push(index);
    else {
      const fresh = [index];
      byKind.set(kind, fresh);
      groups.push(fresh);
    }
  });
  return groups;
}

export function countDistinctDebuffs(
  unit: Pick<BattleCharacter, "debuffs">,
): number {
  return debuffGroups(unit).length;
}

/**
 * Removes `count` randomly chosen distinct debuffs (whole kinds: removing
 * Ignite removes every stack) and returns the remaining entries, or the same
 * array when there is nothing to remove. `rng` is the battle's RNG.
 */
export function removeRandomDebuffs(
  unit: Pick<BattleCharacter, "debuffs">,
  count: number,
  rng: () => number,
): { debuffs: StatusEffect[]; removed: StatusEffect[]; kinds: number } {
  const groups = debuffGroups(unit);
  const dropped = new Set<number>();
  let kinds = 0;
  for (let n = 0; n < count && groups.length > 0; n += 1) {
    const pick = Math.min(groups.length - 1, Math.floor(rng() * groups.length));
    for (const index of groups[pick]) dropped.add(index);
    groups.splice(pick, 1);
    kinds += 1;
  }
  if (dropped.size === 0) return { debuffs: unit.debuffs, removed: [], kinds: 0 };
  return {
    debuffs: unit.debuffs.filter((_, index) => !dropped.has(index)),
    removed: unit.debuffs.filter((_, index) => dropped.has(index)),
    kinds,
  };
}

/** Ignite stacks on a unit (the one Ignite entry's `stacks`, default 1). */
export function igniteStacksOn(unit: Pick<BattleCharacter, "debuffs">): number {
  return unit.debuffs
    .filter((d) => d.type === "ignite")
    .reduce((sum, d) => sum + (d.stacks ?? 1), 0);
}

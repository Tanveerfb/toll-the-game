import { BattleCharacter } from "@/types/character";

/**
 * Evade (a.k.a. dodge) chance in percent. Base evade is 0 for every unit
 * (Tanveer ruling 2026-07-07); only passives/buffs add to it. An evaded
 * attack deals no damage and applies none of its hostile effects.
 */
export function getEvadeChance(char: BattleCharacter): number {
  let chance = 0;

  // Charged-style passives: +evadePerStackPercent per stack
  if (char.passive?.trigger === "onAttackReceived") {
    const mech = char.passive.mechanics?.find(
      (m) => m.type === "chargedStacks",
    );
    if (mech && mech.type === "chargedStacks") {
      const stacks = (char.passiveState.chargedStacks as number) || 0;
      chance += stacks * (mech.evadePerStackPercent ?? 5);
    }
  }

  // Generic evade buffs.
  //
  // Matches `stat: "evade"` AND `stats: [..., "evade"]`. One entry may cover a
  // basic stat and a substat together — Chiara's ultimate raises ATK and evade
  // chance as a single effect (one pill, one thing to cleanse, ruling #55) —
  // and reading only `stat` silently dropped the whole buff. That is the same
  // failure family as the lifesteal and evade no-ops #55 documents: the entry
  // sits in the data, renders on the card, and does nothing.
  //
  // Deliberately NOT reachable through `stat: "all"`: ruling #55 places evade
  // chance and damage reduction outside "all stats", which is why this can't
  // just call `entryAffectsStat`.
  const touchesEvade = (entry: { stat?: string; stats?: string[] }) =>
    entry.stat === "evade" || (entry.stats?.includes("evade") ?? false);

  for (const buff of char.buffs) {
    if (touchesEvade(buff)) chance += buff.valuePercent ?? 0;
  }

  return chance;
}

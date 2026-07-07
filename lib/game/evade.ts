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
      (m: { type?: string }) => m.type === "chargedStacks",
    );
    if (mech) {
      const stacks = (char.passiveState.chargedStacks as number) || 0;
      chance += stacks * (mech.evadePerStackPercent ?? 5);
    }
  }

  // Generic evade buffs (future characters)
  for (const buff of char.buffs) {
    if (buff.stat === "evade" && buff.valuePercent) chance += buff.valuePercent;
  }

  return chance;
}

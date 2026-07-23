import { BattleCharacter } from "@/types/character";
import { getEffectiveRecoveryRate } from "./substats";

/**
 * Recovery-Rate-scaled heal amount, recalculated live off the character's
 * CURRENT recovery rate every time this is called (not snapshotted) — a
 * HoT's healing power responds immediately if the recipient's recovery
 * rate changes mid-duration (Tanveer ruling 2026-07-24).
 */
export function getEffectiveHealAmount(
  char: BattleCharacter,
  rawAmount: number,
): number {
  if (rawAmount <= 0) return 0;
  return Math.floor(rawAmount * (getEffectiveRecoveryRate(char) / 100));
}

/**
 * Single choke point for additive healing (adds to currentHP, clamped at
 * max HP). Every heal source in the engine should route through this so
 * Recovery Rate applies consistently. Not used by Sara's lethal-survival
 * heal (lib/game/lethal.ts), which SETS currentHP to an absolute value
 * rather than adding to it — that call site uses getEffectiveHealAmount
 * directly instead.
 */
export function applyHeal(
  char: BattleCharacter,
  rawAmount: number,
  log?: (entry: string) => void,
): { character: BattleCharacter; healed: number } {
  const scaled = getEffectiveHealAmount(char, rawAmount);
  const healed = Math.min(scaled, char.hp - char.currentHP);
  const character = { ...char, currentHP: char.currentHP + Math.max(0, healed) };
  if (log && healed > 0) {
    log(`${char.name} heals ${healed} HP.`);
  }
  return { character, healed: Math.max(0, healed) };
}

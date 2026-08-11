import type { BattleCharacter } from "@/types/character";

/**
 * When a battle is won.
 *
 * The engine had exactly one answer — every enemy at zero HP — which made three
 * authored story battles impossible to build without contradicting their own
 * scenes: Chiara concedes rather than falls, Duke and Batra break off without
 * either going down, and Molvarr is explicitly a fight neither lead can win
 * (his own beat sheet says "survival and crossing, not victory").
 *
 * Tanveer's ruling, 2026-08-11: the fight still happens and **ends early**.
 * Drop the enemy to a threshold — 20% by default — and the battle resolves as a
 * victory, the chapter's panels explain what actually happened, and rewards pay
 * out as normal.
 *
 * A chapter that sets no threshold keeps the old rule exactly, so every battle
 * shipped before this is untouched.
 */

/** The ruled default for a "you aren't meant to win this" battle. */
export const DEFAULT_RETREAT_PERCENT = 20;

export interface VictoryCheckTeam {
  currentHP: number;
  hp: number;
  isSub?: boolean;
}

/**
 * Bench units don't count toward defeat — a side with a living sub is still in
 * the fight, which is why `allEnemiesDead` has always looked at the whole team
 * rather than the field. Kept identical here.
 */
export function allDown(team: VictoryCheckTeam[]): boolean {
  return team.length > 0 && team.every((unit) => unit.currentHP <= 0);
}

/**
 * Has the enemy side fallen to `percent` of its total HP?
 *
 * Measured across the **whole side's pooled HP**, not per unit. Against a lone
 * boss those are the same number; against a group it means the battle ends when
 * the side as a whole is broken, rather than when whichever unit happens to be
 * targeted first dips low. A dead unit contributes 0, so kills count fully
 * toward the threshold.
 */
export function enemyAtRetreatThreshold(
  team: VictoryCheckTeam[],
  percent: number | undefined,
): boolean {
  if (percent === undefined) return false;
  if (team.length === 0) return false;
  const maxHp = team.reduce((sum, unit) => sum + unit.hp, 0);
  if (maxHp <= 0) return false;
  const currentHp = team.reduce(
    (sum, unit) => sum + Math.max(0, unit.currentHP),
    0,
  );
  return (currentHp / maxHp) * 100 <= percent;
}

/**
 * The single question the phase machine asks after every commit.
 *
 * `retreatPercent` is the chapter's `victoryAtEnemyHpPercent`; leaving it
 * undefined is the ordinary fight-to-the-end battle.
 */
export function evaluateBattleOutcome({
  playerTeam,
  enemyTeam,
  retreatPercent,
}: {
  playerTeam: VictoryCheckTeam[];
  enemyTeam: VictoryCheckTeam[];
  retreatPercent?: number;
}): "victory" | "defeat" | null {
  // Defeat is checked first and without the threshold: a battle you were never
  // meant to win is still one you can lose, and losing has to beat a
  // simultaneous threshold crossing or a mutual knockout would read as a win.
  if (allDown(playerTeam)) return "defeat";
  if (allDown(enemyTeam)) return "victory";
  if (enemyAtRetreatThreshold(enemyTeam, retreatPercent)) return "victory";
  return null;
}

/** Brief copy — the player has to know the rule before they play by it. */
export function retreatBriefLine(percent: number): string {
  return `This fight ends when the enemy drops to ${percent}% health — you aren't expected to finish it.`;
}

/** Narrowing helper for the real `BattleCharacter`, which carries far more. */
export function toVictoryTeam(team: BattleCharacter[]): VictoryCheckTeam[] {
  return team.map((unit) => ({
    currentHP: unit.currentHP,
    hp: unit.hp,
    isSub: unit.isSub,
  }));
}

import { BattleCharacter } from "@/types/character";

/** Hard cap on actions either side takes per turn. */
export const ACTIONS_PER_TURN = 3;

/**
 * Action economy for one side of the field (ruling 2026-08-09, amends the
 * 2026-07-12 enemy-only ruling). Counting only living field members — subs
 * grant none:
 *
 *  - Elite tier present (named bosses — `tier: "elite"`): the side always
 *    takes the full 3 actions, even a lone boss like Lyra/Tao/Seras.
 *  - Otherwise: the side gets its member count +1, so one unit acts twice
 *    and two units act three times.
 *
 * Either branch is capped at ACTIONS_PER_TURN (3), so 3+ living members —
 * up to a 5-unit pack — still take 3 actions.
 *
 * This applies to BOTH sides. The player was previously pinned at a flat 3
 * while the enemy already scaled; that was a testing shortcut Tanveer left
 * in, and it meant a player down to their last unit kept full tempo while
 * an enemy in the same spot lost an action.
 */
export function actionsForTurn(
  team: BattleCharacter[],
  bonusActions = 0,
): number {
  const livingField = team.filter((u) => u.currentHP > 0 && !u.isSub);
  if (livingField.length === 0) return 0;
  const hasElite = livingField.some((u) => u.tier === "elite");
  const actions = hasElite ? ACTIONS_PER_TURN : livingField.length + 1;
  // Stage effects can lift a side that is UNDER the cap (a lone unit at 2);
  // they never raise the ceiling (Tanveer, 2026-08-10: "it does respect the
  // hard cap of 3").
  return Math.min(ACTIONS_PER_TURN, actions + bonusActions);
}

import { applyFightOutcome, type StageRunState } from "@/lib/game/stageRun";
import type { BattleCharacter } from "@/types/character";
import type { AnyBattleEvent } from "@/types/battleEvent";

/**
 * Turning a finished battle into a folded fight.
 *
 * Extracted from `app/story/page.tsx` on 2026-09-16, when the First Ascension
 * Trial became the second screen to run fights. It was a `useCallback` closing
 * over the battle store; none of it is React and none of it is a combat rule,
 * so a second copy on the events page would have been a straight duplicate of
 * the one piece of fight logic that reads three separate store fields and has
 * to get all three right.
 *
 * Takes the battle snapshot as an argument rather than reaching for the store,
 * which keeps it pure and testable — `lib/game/stageRun.ts` documents the same
 * choice and the same reason.
 */
export interface BattleSnapshot {
  playerTeam: BattleCharacter[];
  battleEvents: AnyBattleEvent[];
  playerTurns: number;
}

export function foldFightFromBattle(
  run: StageRunState,
  battle: BattleSnapshot,
): StageRunState {
  const survivors = battle.playerTeam
    .filter((unit) => unit.currentHP > 0)
    .map((unit) => ({ id: unit.id, hp: unit.currentHP }));
  const fallenIds = battle.playerTeam
    .filter((unit) => unit.currentHP <= 0)
    .map((unit) => unit.id);
  // One pass over the player's actions: ultimates and ranked cards are
  // mutually exclusive, since an ultimate carries no rank at all. `rank` is
  // optional on the event and an absent rank reads as 1, matching the
  // sequencer's own convention.
  let ultimates = 0;
  const rankUses: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
  for (const event of battle.battleEvents) {
    if (event.kind !== "action" || event.sourceTeam !== "player") continue;
    if (event.isUlt) ultimates += 1;
    else rankUses[event.rank ?? 1] += 1;
  }
  return applyFightOutcome(run, {
    survivors,
    fallenIds,
    turns: battle.playerTurns,
    ultimates,
    rankUses,
  });
}

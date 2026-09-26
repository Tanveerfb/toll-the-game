import { applyFightOutcome, type FightRunState } from "@/lib/game/fightRun";
import type { BattleCharacter } from "@/types/character";
import type { AnyBattleEvent } from "@/types/battleEvent";

/**
 * Turning a finished battle into a folded fight.
 *
 * Extracted from the story page on 2026-09-16, when the First Ascension Trial
 * became the second screen to run fights. It reads three separate battle store
 * fields and has to get all three right, which is why one copy is shared
 * rather than one per screen. (Story mode was removed on 2026-09-26; the
 * events board is its only caller now.)
 *
 * Takes the battle snapshot as an argument rather than reaching for the store,
 * which keeps it pure and testable — `lib/game/fightRun.ts` documents the same
 * choice and the same reason.
 */
export interface BattleSnapshot {
  playerTeam: BattleCharacter[];
  battleEvents: AnyBattleEvent[];
  playerTurns: number;
}

export function foldFightFromBattle(
  run: FightRunState,
  battle: BattleSnapshot,
): FightRunState {
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
  // Captured here or nowhere: this is the last moment the built units exist.
  // The caller resets the battle immediately after folding, and a break or
  // results screen rendering afterwards has no way back to `unit.hp`.
  const maxHp: Record<string, number> = {};
  for (const unit of battle.playerTeam) maxHp[unit.id] = unit.hp;

  return applyFightOutcome(run, {
    survivors,
    fallenIds,
    turns: battle.playerTurns,
    ultimates,
    rankUses,
    maxHp,
  });
}

import { BattleCharacter } from "@/types/character";

/** A unit is actively on the field: not a sub and still alive. */
export function isOnField(character: BattleCharacter): boolean {
  return !character.isSub && character.currentHP > 0;
}

/**
 * Promotes bench units after deaths: for every dead on-field character an
 * alive sub may take the field. Once promoted, the unit's cards enter the
 * draw pool and it can act/be targeted like any field unit.
 *
 * Returns the same array reference when nothing changed.
 */
export function promoteSubs(
  team: BattleCharacter[],
  log: (entry: string) => void,
): BattleCharacter[] {
  const deadOnField = team.filter(
    (c) => !c.isSub && c.currentHP <= 0,
  ).length;
  const promotedAlready = (team as BattleCharacter[]).filter(
    (c) => c.passiveState?.promotedFromSub === true,
  ).length;
  let openSlots = deadOnField - promotedAlready;

  if (openSlots <= 0) return team;

  let changed = false;
  const next = team.map((c) => {
    if (openSlots > 0 && c.isSub && c.currentHP > 0) {
      openSlots -= 1;
      changed = true;
      log(`[System] ${c.name} enters the field from the sub position!`);
      return {
        ...c,
        isSub: false,
        passiveState: { ...c.passiveState, promotedFromSub: true },
      };
    }
    return c;
  });

  return changed ? next : team;
}

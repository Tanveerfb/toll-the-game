/**
 * Battle format — how many of a side's units stand on the field.
 *
 * This rule used to live inside `components/game/TeamSelect.tsx`, the practice
 * sandbox, which meant it applied to exactly one screen. Story and world-boss
 * battles went through `OwnedTeamSelect`, which had no concept of a format at
 * all, so they shipped four units on the field — "all battles are meant to be
 * 3 + 1 sub vs enemy, not 4 vs enemy like we have been playing" (Tanveer,
 * 2026-08-11).
 *
 * It now lives here and is applied where teams are assembled, so no screen can
 * forget it. The cap is a DEFAULT, not a law: it "would constrain the enemies
 * to 3+1 by default unless I say otherwise", so an authored encounter or the
 * practice bench can override it.
 */

/** Units of a side that stand on the field; the rest start benched. */
export const FIELD_CAP = 3;

/** Most units a side may bring at all. */
export const TEAM_CAP = 4;

/**
 * Marks everything past the field cap as a sub, preserving order — slot 4 is
 * the bench.
 *
 * Picks that already declare `isSub` keep that answer: an authored encounter
 * that deliberately benches its second unit isn't overruled by position.
 */
export function applyFieldCap<T extends { isSub?: boolean }>(
  picks: T[],
  fieldCap: number = FIELD_CAP,
): T[] {
  const cap = Math.max(1, Math.floor(fieldCap));
  let onField = 0;
  return picks.map((pick) => {
    if (pick.isSub === true) return pick;
    onField += 1;
    return onField > cap ? { ...pick, isSub: true } : pick;
  });
}

/** How many of these picks would actually start on the field. Generic rather
 *  than taking `{ isSub?: boolean }[]`: that's a weak type, so TypeScript
 *  rejects any caller whose picks don't already mention `isSub`. */
export function fieldCount<T extends { isSub?: boolean }>(
  picks: T[],
  fieldCap: number = FIELD_CAP,
): number {
  return applyFieldCap(picks, fieldCap).filter((p) => p.isSub !== true).length;
}

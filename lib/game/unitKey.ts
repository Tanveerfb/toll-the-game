/**
 * A unit's colour-qualified key — what its art folder and its coin are named.
 *
 * Ruling #162 named art folders `<color>_<id>` so a colour variant of a
 * character gets its own (`red_lyra/`). Variants whose id already carries the
 * colour would read it twice (`blue_blue_lyra`), so Tanveer settled the
 * exception on 2026-10-02: **when the id already starts with its colour, the id
 * alone is the key.** `blue_lyra` → `blue_lyra`; `lyra` (red) → `red_lyra`.
 *
 * One function, so the folder and the coin cannot disagree.
 */
export function colorQualifiedId(unit: { id: string; color: string }): string {
  return unit.id.startsWith(`${unit.color}_`) ? unit.id : `${unit.color}_${unit.id}`;
}

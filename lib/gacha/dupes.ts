export interface DupeResolution {
  isNew: boolean;
  ultLevel: number;
}

/** The ceiling dupes can award, and the ceiling the ultimate damage curve
 *  scales against (`lib/game/progression.ts`). One definition — two copies of
 *  this number would drift. */
export const MAX_ULT_LEVEL = 6;

/** A pull result lands on a character already owned (dupe) or not owned
 *  (new). Reused by every reward source — normal pulls, the 300 milestone,
 *  and the 600 milestone — since dupe handling is identical everywhere.
 *  Dupes past ultLevel 6 currently do nothing extra (no bonus reward) —
 *  that's an open tuning question in the design spec, not a bug. */
export function resolvePullResult<T extends { ultLevel?: number }>(
  characterId: string,
  roster: string[],
  characters: Record<string, T>,
): DupeResolution {
  const owned = roster.includes(characterId);
  if (!owned) {
    return { isNew: true, ultLevel: 1 };
  }
  const current = characters[characterId]?.ultLevel ?? 1;
  return { isNew: false, ultLevel: Math.min(current + 1, MAX_ULT_LEVEL) };
}

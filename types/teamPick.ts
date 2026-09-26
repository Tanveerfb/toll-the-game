/**
 * One unit as a battle is asked to field it: who, where, and at what
 * progression.
 *
 * This is the shape every fight is launched with — `startCustomBattle`, the
 * fight runner (`lib/game/fightRun.ts`), an authored encounter's enemy list and
 * the simulator all speak it. It lived in `hooks/BattleProvider.tsx` until
 * 2026-09-26, with a structurally identical `StoryTeamPick` beside it in the
 * story types; story mode was removed that day and the two became one.
 */
export interface TeamPick {
  id: string;
  /** Bench slot: passive active, no cards, enters field when a teammate dies */
  isSub?: boolean;
  /**
   * Progression this unit fights at. Omitted means level 1 / ascension 0 —
   * exactly the catalog statline, which is what every unspecified unit gets.
   *
   * Set explicitly for an authored enemy (a trial fight's levels). For the
   * player's own units it is filled in from `playerStore` at battle start.
   */
  level?: number;
  ascension?: number;
  ultLevel?: number;
}

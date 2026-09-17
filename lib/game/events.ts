import { getCharacterById, getCharacterPhases } from "@/lib/game/characterCatalog";
import { RANK_WALLS } from "@/lib/game/accountRank";
import { getTrialEncounter } from "@/lib/game/trialEncounters";

/**
 * The events board.
 *
 * `/world-boss` was a page hardcoded to one boss id and one stamina cost, with
 * nowhere for a second fight to go. It's `/events` now, and this is the list it
 * renders (Tanveer, 2026-08-11).
 *
 * The two ascension trials are here because `RANK_WALLS` has declared them at
 * ranks 20 and 40 since the rank system landed and **no screen has ever
 * mentioned them** — a player who hits the rank 20 wall simply stops gaining
 * ranks with no explanation anywhere in the game. Their encounters are
 * Tanveer's to design; what's authored here is the entry, its unlock rule and
 * its stamina cost, so the board can show a locked trial and say what lifts it.
 */

export type EventKind = "boss" | "trial";

export interface GameEvent {
  id: string;
  kind: EventKind;
  /** Short label above the name — "World Boss · Permanent", "Trial · Rank 20". */
  kicker: string;
  name: string;
  summary: string;
  /** Character id fought. Trials with no authored encounter leave this null. */
  enemyId: string | null;
  staminaCost: number;
  /** Account rank required to enter. */
  requiredRank: number;
  /** Repeatable, or a single clear that unlocks something. */
  repeatable: boolean;
  /** The rank wall this clears, for trials. */
  clearsWall?: number;
  /**
   * An Auto Clear Ticket may be spent here, once the player has beaten it
   * manually. Absent = manual only.
   *
   * Molvarr alone for now (Tanveer, 2026-08-13). A non-repeatable event should
   * never carry this: skipping a one-off clear skips the content itself, and
   * the trials exist to be fought.
   */
  autoClearEligible?: boolean;
  /**
   * When the board may show this event at all — separate from whether it can be
   * entered (Tanveer, 2026-09-01).
   *
   * **Visibility and unlock are different questions, and every event answers
   * both.** The board conflated them until now: an event was listed the moment
   * it existed, and `requiredRank` only decided whether the row was tappable.
   * That is right for the first trial and wrong for the other two — a rank-1
   * player was being shown a rank-40 trial gated behind a fight they had never
   * heard of, and Molvarr was on the board before the story that introduces
   * him.
   *
   * Omitted = visible from the start, which is the first trial's rule and the
   * default for anything with nothing to hide.
   */
  visibleWhen?: EventVisibility;
}

/**
 * A visibility gate. Every field present must hold.
 *
 * Deliberately a small declarative record rather than a predicate function:
 * these rules are authored data, they get read by whoever adds the next event,
 * and a rule you can read is a rule that gets copied correctly.
 */
export interface EventVisibility {
  /** Minimum account rank before the row appears. */
  minRank?: number;
  /** Every one of these walls must already be cleared. */
  clearedWalls?: number[];
  /**
   * Story chapter id that must be fully cleared — `c1`, `c9`, matching
   * `data/story/chapter-N.json`.
   *
   * **A chapter that is not authored yet cannot gate anything.** Arc One is 12
   * chapters and one is adapted, so a gate naming `c9` today would hide its
   * event *forever* rather than until chapter 9 — "clear a chapter that does
   * not exist" is unsatisfiable, and Molvarr is the World Boss, the game's only
   * repeatable fight and the source of half of Bureau Orders. So the gate
   * activates when the chapter lands, and until then the event behaves as
   * ungated. Write the real chapter id; do not wait for it to exist.
   */
  clearedChapter?: string;
}

const [FIRST_WALL, SECOND_WALL] = RANK_WALLS;

export const GAME_EVENTS: readonly GameEvent[] = [
  {
    id: "molvarr",
    kind: "boss",
    kicker: "World Boss · Permanent",
    name: "Molvarr",
    summary: "Elite. Scales with world level. Drops ascension materials.",
    enemyId: "molvarr",
    staminaCost: 40,
    requiredRank: 1,
    repeatable: true,
    autoClearEligible: true,
    // Tanveer, 2026-09-01: "Its chapter 9. so molvarr unlocks after completing
    // chapter 9." Chapter 9 is written but not adapted — 1 of 12 chapters is
    // live — so this gate is inert today and starts biting the day `c9` lands
    // in `data/story/`. That is deliberate; see `clearedChapter` above for why
    // an unauthored chapter must not gate.
    visibleWhen: { clearedChapter: "c9" },
  },
  {
    id: "trial-rank-20",
    kind: "trial",
    kicker: `Trial · Rank ${FIRST_WALL} wall`,
    name: "First Ascension Trial",
    summary: `Three fights, one HP bar. Clear once to lift the rank ${FIRST_WALL} cap and resume gaining ranks.`,
    // Deliberately null: this trial is a three-fight run, not one opponent, so
    // its encounter lives in `trialEncounters.ts` and `hasEncounter` is what
    // decides whether it can be entered (2026-09-16).
    enemyId: null,
    staminaCost: 30,
    requiredRank: FIRST_WALL,
    repeatable: false,
    clearsWall: FIRST_WALL,
    // No `visibleWhen`: on the board from rank 1, locked until rank 20. This is
    // the one event whose visibility is deliberately wider than its unlock —
    // the wall at 20 is invisible otherwise, which is the whole reason these
    // two entries were authored (see the file header).
  },
  {
    id: "trial-rank-40",
    kind: "trial",
    kicker: `Trial · Rank ${SECOND_WALL} wall`,
    name: "Second Ascension Trial",
    summary: `Clear once to lift the rank ${SECOND_WALL} cap.`,
    enemyId: null,
    staminaCost: 30,
    requiredRank: SECOND_WALL,
    repeatable: false,
    clearsWall: SECOND_WALL,
    // Visible one rank past the first wall and only once that trial is behind
    // you; unlocks at rank 40. Deliberately not `minRank: FIRST_WALL` — a
    // player sitting *at* rank 20 has the first trial in front of them and
    // showing the second one beside it makes the wall they are actually on
    // ambiguous. The rank clause is redundant while the only way past 20 is the
    // first trial, and it is written anyway: it is the rule, not an inference
    // from today's progression.
    visibleWhen: { minRank: FIRST_WALL + 1, clearedWalls: [FIRST_WALL] },
  },
];

export function getEvent(id: string): GameEvent | undefined {
  return GAME_EVENTS.find((event) => event.id === id);
}

/**
 * Whether the board may list this event at all.
 *
 * **Not the same question as `eventLockReason`.** A locked event is shown with
 * the reason it is locked, which is how a player learns a wall exists. A
 * withheld event is not shown, because naming it would spoil or confuse
 * something that has not happened yet. Every event answers both, and an event
 * that answers neither is visible and enterable.
 */
export function isEventVisible(
  event: GameEvent,
  ctx: {
    accountRank: number;
    clearedWalls: number[];
    /** `chapterId -> fully cleared`. */
    clearedChapters: Record<string, boolean>;
  },
): boolean {
  const gate = event.visibleWhen;
  if (!gate) return true;
  if (gate.minRank !== undefined && ctx.accountRank < gate.minRank) return false;
  if (gate.clearedWalls?.some((wall) => !ctx.clearedWalls.includes(wall))) {
    return false;
  }
  if (gate.clearedChapter) {
    // Absent from the map = the chapter is not adapted yet, and an
    // unsatisfiable gate hides its event permanently rather than temporarily.
    // Present and false = adapted and unfinished, which is the real gate.
    // `clearedChapterMap` builds the map from the story catalog, so membership
    // is exactly "this chapter exists".
    const authored = gate.clearedChapter in ctx.clearedChapters;
    if (authored && !ctx.clearedChapters[gate.clearedChapter]) return false;
  }
  return true;
}

/** Why an event can't be entered, or null when it can. */
export function eventLockReason(
  event: GameEvent,
  accountRank: number,
  clearedWalls: number[],
): string | null {
  if (accountRank < event.requiredRank) {
    return `Reaches at account rank ${event.requiredRank}`;
  }
  if (event.clearsWall !== undefined && clearedWalls.includes(event.clearsWall)) {
    return "Already cleared";
  }
  if (!hasEncounter(event)) {
    // Honest about the real state rather than presenting a dead button.
    return "Encounter not authored yet";
  }
  return null;
}

/**
 * Whether this event has a fight behind it.
 *
 * Two shapes answer yes. A boss names a single `enemyId`. A **trial** names
 * none and instead carries a multi-fight encounter in `trialEncounters.ts`,
 * because the First Ascension Trial is three fights on one HP bar rather than
 * one opponent (Tanveer, 2026-09-16). The Second still has neither, and the
 * board keeps saying so.
 */
export function hasEncounter(event: GameEvent): boolean {
  return event.enemyId !== null || getTrialEncounter(event.id) !== undefined;
}

/** How many fights entering this event commits you to. 1 for a boss, the fight
 *  count for a trial, 0 when nothing is authored. */
export function eventFightCount(event: GameEvent): number {
  const encounter = getTrialEncounter(event.id);
  if (encounter) return encounter.fights.length;
  return event.enemyId ? 1 : 0;
}

/** Phase count for the board's summary line; 1 for anything not multi-phase. */
export function eventPhaseCount(event: GameEvent): number {
  if (!event.enemyId) return 0;
  const character = getCharacterById(event.enemyId);
  if (!character) return 0;
  return getCharacterPhases(character).length || 1;
}

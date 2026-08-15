import {
  ascensionMultiplier,
  levelMultiplier,
} from "@/lib/game/progression";
import type { StoryChapter, StoryTeamPick } from "@/types/story";

/** Battle team cap, matching the 1–4 rule enforced everywhere else. */
export const STORY_TEAM_CAP = 4;

/**
 * Level a story lead is lent at when the player doesn't own them.
 *
 * Anchors have always bypassed the ownership check so a fresh account could
 * play Duke's story without pulling Duke — but they fought at the bare catalog
 * statline, identical to a unit the player had invested in. A trial unit is
 * now explicitly levelled, and a chapter may raise it via `trialLevel`
 * (Tanveer, 2026-08-11).
 *
 * An owned lead is NOT overridden: the player's own progression applies, so a
 * levelled Chiara always beats the story's loaner Chiara.
 */
export const DEFAULT_TRIAL_LEVEL = 10;

/**
 * Ascension a lent lead fights at when the chapter doesn't say.
 *
 * Zero, which keeps every chapter authored before `trialAscension` existed at
 * exactly the stats it was tuned with. Note this makes a bare `trialLevel`
 * describe a unit the player could never actually own — `maxLevelForAscension`
 * caps ascension 0 at level 1 — so a chapter that means "a real Lv N character"
 * has to say so with `trialAscension`.
 */
export const DEFAULT_TRIAL_ASCENSION = 0;

/** Which of a chapter's anchors are being lent rather than owned. */
export function storyTrialIds(
  chapter: StoryChapter,
  ownedIds: string[],
): string[] {
  const owned = new Set(ownedIds);
  return storyAnchors(chapter)
    .map((pick) => pick.id)
    .filter((id) => !owned.has(id));
}

/**
 * The chapter's fixed units. For `anchored` these are the canon leads the
 * player cannot remove; for `canon` the whole team is an anchor; for `free`
 * there are none (the canon team becomes a prefill suggestion instead).
 */
export function storyAnchors(chapter: StoryChapter): StoryTeamPick[] {
  // A scene-only chapter has no team to anchor.
  if (!chapter.battle) return [];
  switch (chapter.teamMode) {
    case "canon":
    case "anchored":
      return chapter.battle.playerTeam;
    case "free":
      return [];
  }
}

/** How many slots the player may fill themselves. */
export function storyOpenSlots(chapter: StoryChapter): number {
  if (chapter.teamMode === "canon") return 0;
  return Math.max(0, STORY_TEAM_CAP - storyAnchors(chapter).length);
}

/** The progression a chapter lends an anchor at. */
export function trialProgression(chapter: StoryChapter): {
  level: number;
  ascension: number;
} {
  return {
    level: chapter.trialLevel ?? DEFAULT_TRIAL_LEVEL,
    ascension: chapter.trialAscension ?? DEFAULT_TRIAL_ASCENSION,
  };
}

/**
 * Whether the chapter's loaner is stronger than what the player has built.
 *
 * The comparison is the same sum `progressedStat` multiplies by, so it ranks
 * the two the way the battle will. Ties go to the trial, which only happens
 * when the player has built the identical statline anyway.
 */
export function trialBeatsOwned(
  chapter: StoryChapter,
  ownedProgress: { level: number; ascension: number },
): boolean {
  const trial = trialProgression(chapter);
  const strength = (p: { level: number; ascension: number }) =>
    levelMultiplier(p.level) + ascensionMultiplier(p.ascension);
  return strength(trial) >= strength(ownedProgress);
}

/**
 * Which owned anchors should default to the lent version.
 *
 * Owning a lead used to make a chapter *harder*: `trialLevel` applied only to
 * units outside the roster, so a player who pulled Duke and hadn't levelled him
 * fought part 9 at 1.000x while a player who never pulled him got a 2.159x
 * loaner. Defaulting to whichever is stronger means acquiring a character can
 * never cost you a fight; the picker then lets the player override it either
 * way (Tanveer, 2026-08-14 — "most of the other similar games also do provide
 * 'trial' versions for the character for required story or PVE content").
 */
export function defaultTrialSelection(
  chapter: StoryChapter,
  ownedIds: string[],
  progressOf: (id: string) => { level: number; ascension: number },
): string[] {
  const owned = new Set(ownedIds);
  return storyAnchors(chapter)
    .map((pick) => pick.id)
    .filter((id) => owned.has(id) && trialBeatsOwned(chapter, progressOf(id)));
}

/**
 * Builds the team a story battle actually starts with.
 *
 * `playerPicks` are character ids chosen on the brief screen; they are ignored
 * entirely in `canon` mode. Picks that duplicate an anchor are dropped rather
 * than rejected — the same unit cannot occupy two slots, and silently
 * de-duplicating is kinder than an error the player can't act on.
 *
 * `free` with no picks falls back to the canon team, so a player who owns
 * nothing (or who taps straight through) still gets a playable battle.
 */
export function resolveStoryTeam(
  chapter: StoryChapter,
  playerPicks: string[],
  /** The player's roster. Anchors outside it fight as trial units at the
   *  chapter's `trialLevel`; anchors inside it keep the player's own
   *  progression, which `BattleProvider` reads from the save. */
  ownedIds: string[] = [],
  /** Owned anchors the player has chosen to play as the LENT version instead
   *  of their own. Ignored for anchors they don't own — those are always lent,
   *  since there is no other copy to field. */
  useTrialFor: string[] = [],
): StoryTeamPick[] {
  const { level: trialLevel, ascension: trialAscension } =
    trialProgression(chapter);
  const owned = new Set(ownedIds);
  const lentByChoice = new Set(useTrialFor);
  const asTrial = (pick: StoryTeamPick): StoryTeamPick =>
    owned.has(pick.id) && !lentByChoice.has(pick.id)
      ? pick
      : { ...pick, level: trialLevel, ascension: trialAscension };

  if (!chapter.battle) return [];
  if (chapter.teamMode === "canon") {
    return chapter.battle.playerTeam.map(asTrial);
  }

  const anchors = storyAnchors(chapter).map(asTrial);
  const anchoredIds = new Set(anchors.map((pick) => pick.id));
  const chosen = playerPicks
    .filter((id) => !anchoredIds.has(id))
    .slice(0, storyOpenSlots(chapter))
    // Player-chosen units are field units; the 3v3/4v4 format rule in
    // `lib/game/sub.ts` decides who benches, exactly as it does elsewhere.
    .map((id): StoryTeamPick => ({ id }));

  const team = [...anchors, ...chosen];
  return team.length > 0 ? team : chapter.battle.playerTeam;
}

/**
 * Which characters the player may put in an open slot: the ones they own,
 * minus anyone already anchored.
 *
 * Anchors deliberately bypass ownership (they are handed to the battle
 * directly by `resolveStoryTeam`), so a fresh account can play Duke's story
 * without having pulled Duke.
 */
export function storySelectableIds(
  chapter: StoryChapter,
  ownedIds: string[],
): string[] {
  const anchoredIds = new Set(storyAnchors(chapter).map((pick) => pick.id));
  return ownedIds.filter((id) => !anchoredIds.has(id));
}

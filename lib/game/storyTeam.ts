import {
  ascensionMultiplier,
  levelMultiplier,
} from "@/lib/game/progression";
import type { StoryStage, StoryTeamPick } from "@/types/story";

/**
 * Which team a story stage fights with.
 *
 * Ported from the chapter-shaped v1 (a chapter had one battle; a stage has a
 * lineup and 1–3 waves) — the trial-vs-owned rules below are unchanged, because
 * they were his rulings and they were right.
 *
 * The player's side is authored once per stage, on `stage.team`, and is not
 * re-authored per wave: whoever survives wave N starts wave N+1.
 */

/** Battle team cap, matching the 1–4 rule enforced everywhere else. */
export const STORY_TEAM_CAP = 4;

/**
 * Level a story lead is lent at when the player doesn't own them.
 *
 * Anchors have always bypassed the ownership check so a fresh account could
 * play Duke's story without pulling Duke — but they fought at the bare catalog
 * statline, identical to a unit the player had invested in. A trial unit is
 * explicitly levelled, and a stage may raise it via `trialLevel`.
 *
 * An owned lead is NOT overridden: the player's own progression applies, so a
 * levelled Duke always beats the story's loaner Duke.
 */
export const DEFAULT_TRIAL_LEVEL = 10;

/**
 * Ascension a lent lead fights at when the stage doesn't say.
 *
 * Zero. Note this makes a bare `trialLevel` describe a unit the player could
 * never actually own — `maxLevelForAscension` caps ascension 0 at level 1 — so a
 * stage that means "a real Lv N character" has to say so with `trialAscension`
 * (ruling #93).
 */
export const DEFAULT_TRIAL_ASCENSION = 0;

/**
 * The stage's fixed units. For `anchored` these are the canon leads the player
 * cannot remove; for `canon` the whole team is an anchor; for `free` there are
 * none (the authored team becomes a prefill suggestion instead).
 */
export function storyAnchors(stage: StoryStage): StoryTeamPick[] {
  // A scene stage has no team to anchor.
  if (stage.team.length === 0) return [];
  switch (stage.teamMode) {
    case "canon":
    case "anchored":
      return stage.team;
    case "free":
      return [];
  }
}

/** Which of a stage's anchors are being lent rather than owned. */
export function storyTrialIds(stage: StoryStage, ownedIds: string[]): string[] {
  const owned = new Set(ownedIds);
  return storyAnchors(stage)
    .map((pick) => pick.id)
    .filter((id) => !owned.has(id));
}

/** How many slots the player may fill themselves. */
export function storyOpenSlots(stage: StoryStage): number {
  if (stage.teamMode === "canon") return 0;
  return Math.max(0, STORY_TEAM_CAP - storyAnchors(stage).length);
}

/** The progression a stage lends an anchor at. */
export function trialProgression(stage: StoryStage): {
  level: number;
  ascension: number;
} {
  return {
    level: stage.trialLevel ?? DEFAULT_TRIAL_LEVEL,
    ascension: stage.trialAscension ?? DEFAULT_TRIAL_ASCENSION,
  };
}

/**
 * Whether the stage's loaner is stronger than what the player has built.
 *
 * The comparison is the same sum `progressedStat` multiplies by, so it ranks the
 * two the way the battle will. Ties go to the trial, which only happens when the
 * player has built the identical statline anyway.
 */
export function trialBeatsOwned(
  stage: StoryStage,
  ownedProgress: { level: number; ascension: number },
): boolean {
  const trial = trialProgression(stage);
  const strength = (p: { level: number; ascension: number }) =>
    levelMultiplier(p.level) + ascensionMultiplier(p.ascension);
  return strength(trial) >= strength(ownedProgress);
}

/**
 * Which owned anchors should default to the lent version.
 *
 * Owning a lead used to make a fight *harder*: `trialLevel` applied only to units
 * outside the roster, so a player who pulled Duke and hadn't levelled him fought
 * at 1.000x while a player who never pulled him got the loaner. Defaulting to
 * whichever is stronger means acquiring a character can never cost you a fight;
 * the picker then lets the player override it either way (ruling #93).
 */
export function defaultTrialSelection(
  stage: StoryStage,
  ownedIds: string[],
  progressOf: (id: string) => { level: number; ascension: number },
): string[] {
  const owned = new Set(ownedIds);
  return storyAnchors(stage)
    .map((pick) => pick.id)
    .filter((id) => owned.has(id) && trialBeatsOwned(stage, progressOf(id)));
}

/**
 * Builds the team a stage's **first wave** starts with.
 *
 * `playerPicks` are character ids chosen on the brief screen; they are ignored
 * entirely in `canon` mode. Picks that duplicate an anchor are dropped rather
 * than rejected — the same unit cannot occupy two slots, and silently
 * de-duplicating is kinder than an error the player can't act on.
 *
 * `free` with no picks falls back to the authored team, so a player who owns
 * nothing (or who taps straight through) still gets a playable battle.
 */
export function resolveStoryTeam(
  stage: StoryStage,
  playerPicks: string[],
  /** The player's roster. Anchors outside it fight as trial units at the stage's
   *  `trialLevel`; anchors inside it keep the player's own progression, which
   *  `BattleProvider` reads from the save. */
  ownedIds: string[] = [],
  /** Owned anchors the player has chosen to play as the LENT version instead of
   *  their own. Ignored for anchors they don't own — those are always lent, since
   *  there is no other copy to field. */
  useTrialFor: string[] = [],
): StoryTeamPick[] {
  const { level: trialLevel, ascension: trialAscension } = trialProgression(stage);
  const owned = new Set(ownedIds);
  const lentByChoice = new Set(useTrialFor);
  const asTrial = (pick: StoryTeamPick): StoryTeamPick =>
    owned.has(pick.id) && !lentByChoice.has(pick.id)
      ? pick
      : { ...pick, level: trialLevel, ascension: trialAscension };

  if (stage.team.length === 0) return [];
  if (stage.teamMode === "canon") return stage.team.map(asTrial);

  const anchors = storyAnchors(stage).map(asTrial);
  const anchoredIds = new Set(anchors.map((pick) => pick.id));
  const chosen = playerPicks
    .filter((id) => !anchoredIds.has(id))
    .slice(0, storyOpenSlots(stage))
    // Player-chosen units are field units; the 3v3/4v4 format rule in
    // `lib/game/sub.ts` decides who benches, exactly as it does elsewhere.
    .map((id): StoryTeamPick => ({ id }));

  const team = [...anchors, ...chosen];
  return team.length > 0 ? team : stage.team;
}

/**
 * Which characters the player may put in an open slot: the ones they own, minus
 * anyone already anchored.
 *
 * Anchors deliberately bypass ownership (they are handed to the battle directly
 * by `resolveStoryTeam`), so a fresh account can play Duke's story without having
 * pulled Duke.
 */
export function storySelectableIds(
  stage: StoryStage,
  ownedIds: string[],
): string[] {
  const anchoredIds = new Set(storyAnchors(stage).map((pick) => pick.id));
  return ownedIds.filter((id) => !anchoredIds.has(id));
}

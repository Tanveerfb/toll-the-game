import type { StoryChapter, StoryTeamPick } from "@/types/story";

/** Battle team cap, matching the 1–4 rule enforced everywhere else. */
export const STORY_TEAM_CAP = 4;

/**
 * The chapter's fixed units. For `anchored` these are the canon leads the
 * player cannot remove; for `canon` the whole team is an anchor; for `free`
 * there are none (the canon team becomes a prefill suggestion instead).
 */
export function storyAnchors(chapter: StoryChapter): StoryTeamPick[] {
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
): StoryTeamPick[] {
  if (chapter.teamMode === "canon") return chapter.battle.playerTeam;

  const anchors = storyAnchors(chapter);
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

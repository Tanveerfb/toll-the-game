import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRIAL_LEVEL,
  resolveStoryTeam,
  storyAnchors,
  storyOpenSlots,
  storySelectableIds,
} from "@/lib/game/storyTeam";
import type { StoryChapter, StoryTeamMode } from "@/types/story";

/** These cases are about how picks merge with anchors, not about trial
 *  characters — owning every lead keeps `resolveStoryTeam` from stamping a
 *  trial level onto them and muddying the assertions. */
const OWNED = ["duke", "lyra", "sara", "gabrist", "yalina"];

function chapter(
  teamMode: StoryTeamMode,
  playerTeam: NonNullable<StoryChapter["battle"]>["playerTeam"],
): StoryChapter {
  return {
    id: "c1",
    title: "Test Chapter",
    intro: [],
    outro: [],
    teamMode,
    battle: { playerTeam, enemyTeam: [{ id: "raider" }] },
    rewards: { firstClear: {}, repeat: {}, replayStamina: 0 },
  };
}

describe("resolveStoryTeam", () => {
  it("ignores player picks entirely in canon mode", () => {
    const c = chapter("canon", [{ id: "duke" }]);
    expect(resolveStoryTeam(c, ["lyra", "sara"], OWNED)).toEqual([{ id: "duke" }]);
  });

  it("keeps anchors and appends picks up to the cap in anchored mode", () => {
    const c = chapter("anchored", [{ id: "duke" }]);
    expect(resolveStoryTeam(c, ["lyra", "sara", "gabrist", "yalina"], OWNED)).toEqual([
      { id: "duke" },
      { id: "lyra" },
      { id: "sara" },
      { id: "gabrist" },
    ]);
  });

  it("drops a pick that duplicates an anchor instead of seating it twice", () => {
    const c = chapter("anchored", [{ id: "duke" }]);
    expect(resolveStoryTeam(c, ["duke", "lyra"], OWNED)).toEqual([
      { id: "duke" },
      { id: "lyra" },
    ]);
  });

  it("uses the player's picks in free mode", () => {
    const c = chapter("free", [{ id: "duke" }]);
    expect(resolveStoryTeam(c, ["lyra", "sara"], OWNED)).toEqual([
      { id: "lyra" },
      { id: "sara" },
    ]);
  });

  it("falls back to the canon team when a free chapter gets no picks", () => {
    const c = chapter("free", [{ id: "duke" }]);
    expect(resolveStoryTeam(c, [], OWNED)).toEqual([{ id: "duke" }]);
  });

  it("preserves isSub flags on anchors", () => {
    const c = chapter("anchored", [{ id: "duke" }, { id: "lyra", isSub: true }]);
    expect(resolveStoryTeam(c, ["sara"], OWNED)).toEqual([
      { id: "duke" },
      { id: "lyra", isSub: true },
      { id: "sara" },
    ]);
  });

  it("never exceeds the 4-unit cap", () => {
    const c = chapter("free", []);
    expect(
      resolveStoryTeam(c, ["duke", "lyra", "sara", "gabrist", "yalina"], OWNED),
    ).toHaveLength(4);
  });
});

describe("scene-only chapters", () => {
  it("anchors nobody and resolves to no team", () => {
    // A chapter with no battle still runs — intro, outro, first-clear rewards
    // — so every team helper has to answer sensibly rather than throw
    // (Tanveer, 2026-08-11).
    const c: StoryChapter = {
      id: "scene-only",
      title: "Aftermath",
      intro: [],
      outro: [],
      teamMode: "canon",
      rewards: { firstClear: {}, repeat: {}, replayStamina: 0 },
    };
    expect(storyAnchors(c)).toEqual([]);
    expect(resolveStoryTeam(c, ["duke"], OWNED)).toEqual([]);
    expect(storySelectableIds(c, OWNED)).toEqual(OWNED);
  });
});

describe("storyAnchors / storyOpenSlots", () => {
  it("treats the whole canon team as anchored, leaving no open slots", () => {
    const c = chapter("canon", [{ id: "duke" }]);
    expect(storyAnchors(c)).toEqual([{ id: "duke" }]);
    expect(storyOpenSlots(c)).toBe(0);
  });

  it("opens the remaining slots in anchored mode", () => {
    const c = chapter("anchored", [{ id: "duke" }, { id: "lyra" }]);
    expect(storyOpenSlots(c)).toBe(2);
  });

  it("anchors nothing in free mode", () => {
    const c = chapter("free", [{ id: "duke" }]);
    expect(storyAnchors(c)).toEqual([]);
    expect(storyOpenSlots(c)).toBe(4);
  });
});

describe("storySelectableIds", () => {
  it("offers owned characters minus anyone already anchored", () => {
    const c = chapter("anchored", [{ id: "duke" }]);
    expect(storySelectableIds(c, ["duke", "lyra", "sara"])).toEqual([
      "lyra",
      "sara",
    ]);
  });

  it("plays an anchor the player does not own — story is never ownership-locked", () => {
    const c = chapter("anchored", [{ id: "duke" }]);
    // The account owns nobody, yet the canon lead still reaches the battle —
    // now lent at the trial level rather than at the bare catalog statline.
    expect(resolveStoryTeam(c, [], [])).toEqual([
      { id: "duke", level: DEFAULT_TRIAL_LEVEL },
    ]);
    expect(storySelectableIds(c, [])).toEqual([]);
  });
});

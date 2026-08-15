import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRIAL_ASCENSION,
  defaultTrialSelection,
  DEFAULT_TRIAL_LEVEL,
  resolveStoryTeam,
  storyAnchors,
  storyOpenSlots,
  storySelectableIds,
  trialBeatsOwned,
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
      {
        id: "duke",
        level: DEFAULT_TRIAL_LEVEL,
        ascension: DEFAULT_TRIAL_ASCENSION,
      },
    ]);
    expect(storySelectableIds(c, [])).toEqual([]);
  });

  // A level alone under-describes a unit: `maxLevelForAscension` caps ascension
  // 0 at level 1, so a bare `trialLevel: 20` loaner is 1.322x where the
  // player's own Lv20 (which needs ascension 1 to exist) is 1.489x. Part 9
  // authors both so "a level 40 Duke" means what it says.
  it("lends at the chapter's ascension when it authors one", () => {
    const c = { ...chapter("canon", [{ id: "duke" }]), trialLevel: 40, trialAscension: 3 };
    expect(resolveStoryTeam(c, [], [])).toEqual([
      { id: "duke", level: 40, ascension: 3 },
    ]);
  });

  it("leaves an owned lead on the player's own progression, ascension included", () => {
    const c = { ...chapter("canon", [{ id: "duke" }]), trialLevel: 40, trialAscension: 3 };
    expect(resolveStoryTeam(c, [], ["duke"])).toEqual([{ id: "duke" }]);
  });
});

/**
 * Owning a lead used to make a chapter HARDER: `trialLevel` applied only to
 * units outside the roster, so a player who pulled Duke and hadn't levelled him
 * fought part 9 at 1.000x while a player who never pulled him got the 2.159x
 * loaner. The picker exists so acquiring a character can never cost you a
 * fight (Tanveer, 2026-08-14).
 */
describe("trial-vs-owned choice", () => {
  const p9 = () => ({
    ...chapter("canon", [{ id: "duke" }, { id: "batra" }]),
    trialLevel: 40,
    trialAscension: 3,
  });

  it("lends an owned anchor when the player asks for the trial version", () => {
    expect(resolveStoryTeam(p9(), [], ["duke", "batra"], ["duke"])).toEqual([
      { id: "duke", level: 40, ascension: 3 },
      { id: "batra" },
    ]);
  });

  it("still lends an unowned anchor even if it isn't in the trial list", () => {
    // There is no other copy to field, so the choice cannot apply.
    expect(resolveStoryTeam(p9(), [], ["duke"], [])).toEqual([
      { id: "duke" },
      { id: "batra", level: 40, ascension: 3 },
    ]);
  });

  it("defaults an under-levelled owner to the loaner", () => {
    const unlevelled = () => ({ level: 1, ascension: 0 });
    expect(defaultTrialSelection(p9(), ["duke", "batra"], unlevelled)).toEqual([
      "duke",
      "batra",
    ]);
  });

  it("defaults a maxed owner to their own character", () => {
    const maxed = () => ({ level: 40, ascension: 3 });
    // Equal strength ties to the trial only when nothing is owned outright;
    // here the player matches it, so there is nothing to gain by lending.
    expect(defaultTrialSelection(p9(), ["duke", "batra"], maxed)).toEqual([
      "duke",
      "batra",
    ]);
    const beyond = () => ({ level: 40, ascension: 4 });
    expect(defaultTrialSelection(p9(), ["duke", "batra"], beyond)).toEqual([]);
  });

  it("decides per character, not per team", () => {
    const progress = (id: string) =>
      id === "duke" ? { level: 40, ascension: 5 } : { level: 3, ascension: 0 };
    expect(defaultTrialSelection(p9(), ["duke", "batra"], progress)).toEqual([
      "batra",
    ]);
  });

  it("never defaults a character the player doesn't own", () => {
    expect(
      defaultTrialSelection(p9(), [], () => ({ level: 1, ascension: 0 })),
    ).toEqual([]);
  });

  it("ranks the loaner the way the battle will", () => {
    const c = { ...chapter("canon", [{ id: "duke" }]), trialLevel: 20, trialAscension: 1 };
    // A bare Lv20 (ascension 0) is 1.322x; the chapter's Lv20/asc1 is 1.489x.
    expect(trialBeatsOwned(c, { level: 20, ascension: 0 })).toBe(true);
    expect(trialBeatsOwned(c, { level: 25, ascension: 1 })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRIAL_LEVEL,
  resolveStoryTeam,
  storyTrialIds,
} from "@/lib/game/storyTeam";
import { getStoryChapter } from "@/lib/game/storyCatalog";
import { progressedStats } from "@/lib/game/progression";
import { getCharacterById } from "@/lib/game/characterCatalog";

/**
 * Story leads have always bypassed the ownership check so a fresh account can
 * play Duke's story without pulling Duke. What's new is that a lent unit is
 * explicitly levelled, and that the player's own copy always beats the loaner
 * (Tanveer, 2026-08-11).
 */
const chapter = getStoryChapter("part1", "p1c1")!;
const leadId = chapter.battle!.playerTeam[0].id;

describe("storyTrialIds", () => {
  it("names the leads the player doesn't own", () => {
    expect(storyTrialIds(chapter, [])).toEqual([leadId]);
  });

  it("names nobody once the lead is owned", () => {
    expect(storyTrialIds(chapter, [leadId])).toEqual([]);
  });
});

describe("resolveStoryTeam trial levels", () => {
  it("lends an unowned lead at the trial level", () => {
    const team = resolveStoryTeam(chapter, [], []);
    expect(team[0].id).toBe(leadId);
    expect(team[0].level).toBe(DEFAULT_TRIAL_LEVEL);
  });

  it("leaves an owned lead alone so the player's own progression applies", () => {
    // No level on the pick means BattleProvider reads the save instead —
    // which is what makes an invested character beat the loaner.
    const team = resolveStoryTeam(chapter, [], [leadId]);
    expect(team[0].level).toBeUndefined();
  });

  it("honours a chapter that raises its trial level", () => {
    const deeper = { ...chapter, trialLevel: 25 };
    expect(resolveStoryTeam(deeper, [], [])[0].level).toBe(25);
  });

  it("does not mutate the chapter's authored team", () => {
    const before = JSON.stringify(chapter.battle!.playerTeam);
    resolveStoryTeam(chapter, [], []);
    expect(JSON.stringify(chapter.battle!.playerTeam)).toBe(before);
  });
});

describe("owned always beats lent", () => {
  it("puts a levelled character ahead of the story's loaner", () => {
    const lead = getCharacterById(leadId)!;
    const base = { hp: lead.hp, atk: lead.atk, def: lead.def };
    const lent = progressedStats(base, {
      level: DEFAULT_TRIAL_LEVEL,
      ascension: 0,
    });
    const invested = progressedStats(base, { level: 40, ascension: 3 });
    expect(invested.atk).toBeGreaterThan(lent.atk);
    expect(invested.hp).toBeGreaterThan(lent.hp);
  });

  it("still beats the loaner at the very next level after it", () => {
    // The crossover has to be immediate, or there's a band where investing
    // makes a character worse than the free one.
    const lead = getCharacterById(leadId)!;
    const base = { hp: lead.hp, atk: lead.atk, def: lead.def };
    const lent = progressedStats(base, {
      level: DEFAULT_TRIAL_LEVEL,
      ascension: 0,
    });
    const justAhead = progressedStats(base, {
      level: DEFAULT_TRIAL_LEVEL + 1,
      ascension: 0,
    });
    expect(justAhead.hp).toBeGreaterThanOrEqual(lent.hp);
  });
});

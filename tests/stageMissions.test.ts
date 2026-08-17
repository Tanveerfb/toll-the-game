import { describe, expect, it } from "vitest";
import {
  emptyRunSummary,
  evaluateMissions,
  isCleared,
  isGoalMet,
  missionKey,
  missionProgress,
  type StageRunSummary,
} from "@/lib/game/stageMissions";
import type { StoryMission, StoryStage } from "@/types/story";

/**
 * Stage missions (story mode v2, 2026-08-18).
 *
 * The property that matters most is the one a player would notice being wrong:
 * **a mission is never lost**. Clearing a stage without meeting one leaves it
 * claimable, and nothing here records a failure — only what a run satisfied.
 */

function run(overrides: Partial<StageRunSummary> = {}): StageRunSummary {
  return { ...emptyRunSummary(3), wavesCleared: 3, ...overrides };
}

function mission(
  id: string,
  goal: StoryMission["goal"],
  gems = 3,
): StoryMission {
  return { id, label: id, goal, reward: { gems } };
}

function stage(missions: StoryMission[]): StoryStage {
  return {
    id: "s1",
    number: 1,
    name: "A Fight",
    kind: "battle",
    origin: "filler",
    intro: [],
    outro: [],
    waves: [{ enemies: [{ id: "wild_beast" }] }],
    team: [{ id: "duke" }],
    teamMode: "canon",
    missions,
    rewards: { firstClear: {} },
    stamina: 1,
  };
}

describe("goals", () => {
  it("noLosses reads the run, not a single wave", () => {
    expect(isGoalMet({ type: "noLosses" }, run())).toBe(true);
    // A unit lost in wave 1 is still lost at the end of wave 3 — that permanence
    // is the whole point of the wave model (ruling #103).
    expect(isGoalMet({ type: "noLosses" }, run({ fallen: ["duke"] }))).toBe(false);
  });

  it("withinTurns counts every wave, and is inclusive at the bound", () => {
    expect(isGoalMet({ type: "withinTurns", turns: 10 }, run({ turns: 10 }))).toBe(
      true,
    );
    expect(isGoalMet({ type: "withinTurns", turns: 10 }, run({ turns: 11 }))).toBe(
      false,
    );
  });

  it("fieldCharacter counts the bench, since a sub's passive is live from it", () => {
    const summary = run({ fielded: ["duke", "lyra"] });
    expect(isGoalMet({ type: "fieldCharacter", characterId: "lyra" }, summary)).toBe(
      true,
    );
    expect(isGoalMet({ type: "fieldCharacter", characterId: "sara" }, summary)).toBe(
      false,
    );
  });

  it("fieldTag reads tags off the catalog", () => {
    // Duke carries no Collab tag; the HxH trio do. Reading the real catalog is
    // deliberate — a goal authored against a tag nobody has would otherwise pass
    // its unit test with a hand-made fixture.
    const collab = run({ fielded: ["gon", "killua", "leorio"] });
    expect(isGoalMet({ type: "fieldTag", tag: "Collab", count: 3 }, collab)).toBe(true);
    expect(isGoalMet({ type: "fieldTag", tag: "Collab", count: 4 }, collab)).toBe(false);
    expect(
      isGoalMet({ type: "fieldTag", tag: "Collab", count: 1 }, run({ fielded: ["duke"] })),
    ).toBe(false);
  });

  it("fieldTag matches case-insensitively, so authoring can't miss on casing", () => {
    // Kits write tags in mixed case ("Collab", "Hunter x Hunter"); a mission
    // authored as "collab" must still find them.
    const collab = run({ fielded: ["gon"] });
    expect(isGoalMet({ type: "fieldTag", tag: "collab", count: 1 }, collab)).toBe(true);
  });

  it("useUltimates is a floor", () => {
    expect(isGoalMet({ type: "useUltimates", count: 2 }, run({ ultimatesUsed: 2 }))).toBe(
      true,
    );
    expect(isGoalMet({ type: "useUltimates", count: 2 }, run({ ultimatesUsed: 1 }))).toBe(
      false,
    );
  });

  it("firstAttempt fails on a retry after a defeat", () => {
    expect(isGoalMet({ type: "firstAttempt" }, run())).toBe(true);
    expect(isGoalMet({ type: "firstAttempt" }, run({ isRetry: true }))).toBe(false);
  });

  it("allWaves needs the last wave, not just progress", () => {
    expect(isGoalMet({ type: "allWaves" }, run({ wavesCleared: 2 }))).toBe(false);
    expect(isGoalMet({ type: "allWaves" }, run({ wavesCleared: 3 }))).toBe(true);
  });
});

describe("clear gate", () => {
  it("a scene stage clears by being finished", () => {
    expect(isCleared(emptyRunSummary(0))).toBe(true);
  });

  it("an abandoned run is not a clear", () => {
    expect(isCleared(run({ wavesCleared: 1 }))).toBe(false);
  });

  it("no mission is met by a run that didn't clear", () => {
    // The trap this guards: losing wave 3 with everyone alive would otherwise
    // satisfy `noLosses`.
    const outcomes = evaluateMissions(
      stage([mission("m1", { type: "noLosses" })]),
      "c1",
      run({ wavesCleared: 2 }),
      {},
    );
    expect(outcomes[0].met).toBe(false);
    expect(outcomes[0].paysNow).toBe(false);
  });
});

describe("claiming", () => {
  const m = mission("m1", { type: "noLosses" });

  it("pays a met, unclaimed mission once", () => {
    const first = evaluateMissions(stage([m]), "c1", run(), {})[0];
    expect(first.paysNow).toBe(true);

    const again = evaluateMissions(stage([m]), "c1", run(), {
      [missionKey("c1", "s1", "m1")]: true,
    })[0];
    expect(again.met).toBe(true);
    expect(again.alreadyClaimed).toBe(true);
    expect(again.paysNow).toBe(false);
  });

  it("keeps an unmet mission claimable rather than failing it", () => {
    // The result screen reads this as STILL OPEN. There is no third state.
    const outcome = evaluateMissions(stage([m]), "c1", run({ fallen: ["duke"] }), {})[0];
    expect(outcome.met).toBe(false);
    expect(outcome.alreadyClaimed).toBe(false);
  });

  it("returns an entry per mission so the screen can list them all", () => {
    const outcomes = evaluateMissions(
      stage([m, mission("m2", { type: "withinTurns", turns: 1 })]),
      "c1",
      run({ turns: 20 }),
      {},
    );
    expect(outcomes).toHaveLength(2);
    expect(outcomes.map((o) => o.met)).toEqual([true, false]);
  });

  it("counts chapter progress across stages", () => {
    const stages = [
      stage([m]),
      { ...stage([mission("m2", { type: "allWaves" })]), id: "s2", number: 2 },
    ];
    expect(missionProgress(stages, "c1", {})).toEqual({ claimed: 0, total: 2 });
    expect(
      missionProgress(stages, "c1", { [missionKey("c1", "s2", "m2")]: true }),
    ).toEqual({ claimed: 1, total: 2 });
  });
});

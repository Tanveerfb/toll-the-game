import { describe, expect, it } from "vitest";
import {
  applyFightOutcome,
  beginRun,
  isWipe,
  runHealthBars,
  toSummary,
  fightEnemies,
  fightTeam,
} from "@/lib/game/stageRun";
import type { StoryStage } from "@/types/story";

/**
 * The fight loop (story mode v2, 2026-08-18) — his ruling #103 made real.
 *
 * Two properties carry the whole design: **HP carries between fights** and **the
 * fallen stay down**. If either leaks, a 3-fight stage collapses into three
 * independent fights and every mission and reward tuned against attrition is
 * wrong.
 */

const STAGE: StoryStage = {
  id: "s5",
  number: 5,
  name: "Where the Traffic Thins",
  kind: "boss",
  origin: "filler",
  intro: [],
  outro: [],
  fights: [
    { enemies: [{ id: "road_bandit" }, { id: "road_bandit" }] },
    { enemies: [{ id: "raider" }] },
    { enemies: [{ id: "road_bandit", level: 12 }] },
  ],
  team: [{ id: "duke" }, { id: "lyra" }, { id: "sara" }],
  teamMode: "anchored",
  missions: [],
  rewards: { firstClear: {} },
  stamina: 9,
};

const SCENE_STAGE: StoryStage = {
  ...STAGE,
  id: "s1",
  number: 1,
  kind: "story",
  fights: [],
  team: [],
};

function start() {
  return beginRun("c1", STAGE, STAGE.team);
}

describe("beginning a run", () => {
  it("starts on fight 1 with everyone at full", () => {
    const run = start();
    expect(run.fightIndex).toBe(0);
    expect(run.fightCount).toBe(3);
    expect(run.carryHp).toEqual({});
    expect(fightTeam(run).map((p) => p.id)).toEqual(["duke", "lyra", "sara"]);
    expect(run.complete).toBe(false);
  });

  it("treats a scene stage as already complete", () => {
    expect(beginRun("c1", SCENE_STAGE, []).complete).toBe(true);
  });
});

describe("carrying attrition forward", () => {
  it("carries survivors' HP and drops the fallen from the next fight", () => {
    const run = applyFightOutcome(start(), {
      survivors: [
        { id: "duke", hp: 1800 },
        { id: "lyra", hp: 640 },
      ],
      fallenIds: ["sara"],
      turns: 4,
      ultimates: 1,
      rankUses: { 1: 0, 2: 0, 3: 0 },
    });

    expect(run.fightIndex).toBe(1);
    expect(run.carryHp).toEqual({ duke: 1800, lyra: 640 });
    expect(fightTeam(run).map((p) => p.id)).toEqual(["duke", "lyra"]);
    expect(fightEnemies(STAGE, run).map((e) => e.id)).toEqual(["raider"]);
  });

  it("never revives a unit that fell in an earlier fight", () => {
    // The engine would happily rebuild Sara at full HP for fight 3 if the run let
    // it, and nothing else in the codebase remembers she died.
    const afterOne = applyFightOutcome(start(), {
      survivors: [{ id: "duke", hp: 1000 }],
      fallenIds: ["sara", "lyra"],
      turns: 5,
      ultimates: 0,
      rankUses: { 1: 0, 2: 0, 3: 0 },
    });
    const afterTwo = applyFightOutcome(afterOne, {
      survivors: [{ id: "duke", hp: 400 }],
      fallenIds: [],
      turns: 3,
      ultimates: 1,
      rankUses: { 1: 0, 2: 0, 3: 0 },
    });
    expect(afterTwo.fallen.sort()).toEqual(["lyra", "sara"]);
    expect(fightTeam(afterTwo).map((p) => p.id)).toEqual(["duke"]);
    expect(afterTwo.carryHp).toEqual({ duke: 400 });
  });

  it("records a death once even if it is reported twice", () => {
    const once = applyFightOutcome(start(), {
      survivors: [{ id: "duke", hp: 900 }],
      fallenIds: ["sara"],
      turns: 2,
      ultimates: 0,
      rankUses: { 1: 0, 2: 0, 3: 0 },
    });
    const twice = applyFightOutcome(once, {
      survivors: [{ id: "duke", hp: 500 }],
      fallenIds: ["sara"],
      turns: 2,
      ultimates: 0,
      rankUses: { 1: 0, 2: 0, 3: 0 },
    });
    expect(twice.fallen).toEqual(["sara"]);
  });

  it("floors carried HP at 1 — a survivor is never handed 0", () => {
    const run = applyFightOutcome(start(), {
      survivors: [{ id: "duke", hp: 0.4 }],
      fallenIds: [],
      turns: 1,
      ultimates: 0,
      rankUses: { 1: 0, 2: 0, 3: 0 },
    });
    expect(run.carryHp.duke).toBe(1);
  });

  it("accumulates turns and ultimates across fights", () => {
    let run = start();
    run = applyFightOutcome(run, {
      survivors: [{ id: "duke", hp: 10 }],
      fallenIds: [],
      turns: 4,
      ultimates: 1,
      rankUses: { 1: 0, 2: 0, 3: 0 },
    });
    run = applyFightOutcome(run, {
      survivors: [{ id: "duke", hp: 8 }],
      fallenIds: [],
      turns: 3,
      ultimates: 2,
      rankUses: { 1: 0, 2: 0, 3: 0 },
    });
    expect(run.turns).toBe(7);
    expect(run.ultimatesUsed).toBe(3);
  });

  it("completes only after the last fight", () => {
    let run = start();
    const win = (hp: number) => ({
      survivors: [{ id: "duke", hp }],
      fallenIds: [],
      turns: 1,
      ultimates: 0,
      rankUses: { 1: 0, 2: 0, 3: 0 },
    });
    run = applyFightOutcome(run, win(900));
    expect(run.complete).toBe(false);
    run = applyFightOutcome(run, win(700));
    expect(run.complete).toBe(false);
    run = applyFightOutcome(run, win(500));
    expect(run.complete).toBe(true);
  });
});

describe("wipes", () => {
  it("is a wipe when nobody is left to field", () => {
    const run = applyFightOutcome(start(), {
      survivors: [],
      fallenIds: ["duke", "lyra", "sara"],
      turns: 6,
      ultimates: 0,
      rankUses: { 1: 0, 2: 0, 3: 0 },
    });
    expect(isWipe(run)).toBe(true);
    expect(fightTeam(run)).toEqual([]);
  });
});

describe("summarising for missions", () => {
  it("reports what the run did, with everyone who started listed as fielded", () => {
    const run = applyFightOutcome(start(), {
      survivors: [{ id: "duke", hp: 100 }],
      fallenIds: ["sara"],
      turns: 9,
      ultimates: 2,
      rankUses: { 1: 0, 2: 0, 3: 0 },
    });
    const summary = toSummary(run);
    expect(summary).toMatchObject({
      fightsCleared: 1,
      fightsTotal: 3,
      turns: 9,
      ultimatesUsed: 2,
      fallen: ["sara"],
      isRetry: false,
    });
    // `fielded` is who *started*, not who survived — that's what a
    // `fieldCharacter` mission asks about.
    expect(summary.fielded).toEqual(["duke", "lyra", "sara"]);
  });

  it("carries the retry flag through, since firstAttempt reads it", () => {
    const retried = beginRun("c1", STAGE, STAGE.team, true);
    expect(toSummary(retried).isRetry).toBe(true);
  });
});

describe("the between-fights HUD", () => {
  it("shows full HP before the first fight, carried HP after, and 0 for the dead", () => {
    const maxOf = () => 2000;
    expect(runHealthBars(start(), maxOf)).toEqual([
      { id: "duke", hp: 2000, max: 2000 },
      { id: "lyra", hp: 2000, max: 2000 },
      { id: "sara", hp: 2000, max: 2000 },
    ]);

    const run = applyFightOutcome(start(), {
      survivors: [
        { id: "duke", hp: 1200 },
        { id: "lyra", hp: 300 },
      ],
      fallenIds: ["sara"],
      turns: 3,
      ultimates: 0,
      rankUses: { 1: 0, 2: 0, 3: 0 },
    });
    expect(runHealthBars(run, maxOf)).toEqual([
      { id: "duke", hp: 1200, max: 2000 },
      { id: "lyra", hp: 300, max: 2000 },
      { id: "sara", hp: 0, max: 2000 },
    ]);
  });
});

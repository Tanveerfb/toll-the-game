import { describe, expect, it } from "vitest";
import {
  applyFightOutcome,
  beginRun,
  fightSummaries,
  isWipe,
  runHealthBars,
  fightEnemies,
  fightTeam,
  type RunnableEncounter,
} from "@/lib/game/fightRun";
import type { TeamPick } from "@/types/teamPick";

/**
 * The fight loop — his ruling #103 made real.
 *
 * Two properties carry the whole design: **HP carries between fights** and **the
 * fallen stay down**. If either leaks, a 3-fight run collapses into three
 * independent fights and everything tuned against attrition is wrong.
 *
 * Ported from `tests/stageRun.test.ts` when story mode was removed
 * (2026-09-26). The mission-summary tests went with story's missions.
 */

const ENCOUNTER: RunnableEncounter = {
  id: "test-run",
  fights: [
    { enemies: [{ id: "road_bandit" }, { id: "road_bandit" }] },
    { enemies: [{ id: "raider" }] },
    { enemies: [{ id: "road_bandit", level: 12 }] },
  ],
};

const TEAM: TeamPick[] = [{ id: "duke" }, { id: "lyra" }, { id: "sara" }];

/** Max HP as the units were built for the fight. `FightOutcome` requires it:
 *  it is the field whose absence made every living bar on both break screens
 *  draw 100%, because the pages looked it up from a store already reset. */
const MAX = { duke: 2000, lyra: 2000, sara: 2000 };

function start() {
  return beginRun(ENCOUNTER, TEAM);
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

  it("treats an encounter with no fights as already complete", () => {
    expect(beginRun({ id: "empty", fights: [] }, []).complete).toBe(true);
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
      maxHp: MAX,
    });

    expect(run.fightIndex).toBe(1);
    expect(run.carryHp).toEqual({ duke: 1800, lyra: 640 });
    expect(fightTeam(run).map((p) => p.id)).toEqual(["duke", "lyra"]);
    expect(fightEnemies(ENCOUNTER, run).map((e) => e.id)).toEqual(["raider"]);
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
      maxHp: MAX,
    });
    const afterTwo = applyFightOutcome(afterOne, {
      survivors: [{ id: "duke", hp: 400 }],
      fallenIds: [],
      turns: 3,
      ultimates: 1,
      rankUses: { 1: 0, 2: 0, 3: 0 },
      maxHp: MAX,
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
      maxHp: MAX,
    });
    const twice = applyFightOutcome(once, {
      survivors: [{ id: "duke", hp: 500 }],
      fallenIds: ["sara"],
      turns: 2,
      ultimates: 0,
      rankUses: { 1: 0, 2: 0, 3: 0 },
      maxHp: MAX,
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
      maxHp: MAX,
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
      maxHp: MAX,
    });
    run = applyFightOutcome(run, {
      survivors: [{ id: "duke", hp: 8 }],
      fallenIds: [],
      turns: 3,
      ultimates: 2,
      rankUses: { 1: 0, 2: 0, 3: 0 },
      maxHp: MAX,
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
      maxHp: MAX,
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
      maxHp: MAX,
    });
    expect(isWipe(run)).toBe(true);
    expect(fightTeam(run)).toEqual([]);
  });
});

describe("the between-fights HUD", () => {
  it("shows full HP before the first fight, carried HP after, and 0 for the dead", () => {
    // Before any fold no maximum is known, so a unit reads full rather than
    // reading as an error. The break screen never renders in this state — it
    // only ever follows a won fight — but the function has to be total.
    expect(runHealthBars(start())).toEqual([
      { id: "duke", hp: 1, max: 1 },
      { id: "lyra", hp: 1, max: 1 },
      { id: "sara", hp: 1, max: 1 },
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
      maxHp: MAX,
    });
    expect(runHealthBars(run)).toEqual([
      { id: "duke", hp: 1200, max: 2000 },
      { id: "lyra", hp: 300, max: 2000 },
      { id: "sara", hp: 0, max: 2000 },
    ]);
  });
});

/**
 * Per-fight history, added 2026-09-20 for the post-fight banner (option C) and
 * the end-of-run recap (option E).
 *
 * The running totals on `StageRunState` answer "how did the run go". Neither
 * screen could be built from them: a banner needs the fight that just ended,
 * and a recap needs all of them separately.
 *
 * **Falsified before being trusted** (`AGENTS.md`). Making `applyFightOutcome`
 * replace `maxHp` instead of merging it turns **two** of these red — the
 * casualty's maximum, and the pool the percentages are measured against, which
 * is built from the same map. Dropping the `index === 0` branch in
 * `fightSummaries` turns the first fight's loss into 0%, since there is no
 * earlier record to diff against.
 */
describe("per-fight history", () => {
  const fight = (
    survivors: { id: string; hp: number }[],
    fallenIds: string[],
    turns: number,
    ultimates = 0,
  ) => ({
    survivors,
    fallenIds,
    turns,
    ultimates,
    rankUses: { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>,
    // Fight 2 is fought by whoever is left, so its outcome only knows about
    // them — exactly the case the merge in `applyFightOutcome` exists for.
    maxHp: Object.fromEntries(survivors.concat(
      fallenIds.map((id) => ({ id, hp: 0 })),
    ).map((unit) => [unit.id, 2000])),
  });

  it("records one entry per fight, with only that fight's casualties", () => {
    let run = applyFightOutcome(start(), fight(
      [{ id: "duke", hp: 1200 }, { id: "lyra", hp: 300 }], ["sara"], 3, 1,
    ));
    run = applyFightOutcome(run, fight(
      [{ id: "duke", hp: 900 }], ["lyra"], 5, 2,
    ));

    expect(run.history).toHaveLength(2);
    expect(run.history[0].fallen).toEqual(["sara"]);
    // NOT ["sara", "lyra"] — `fallen` on the run is cumulative, a record is not.
    expect(run.history[1].fallen).toEqual(["lyra"]);
    expect(run.fallen.slice().sort()).toEqual(["lyra", "sara"]);
    expect(run.history.map((r) => r.turns)).toEqual([3, 5]);
    expect(run.history.map((r) => r.ultimates)).toEqual([1, 2]);
  });

  it("a unit that fell in an earlier fight keeps its maximum", () => {
    let run = applyFightOutcome(start(), fight(
      [{ id: "duke", hp: 1200 }, { id: "lyra", hp: 300 }], ["sara"], 3,
    ));
    // Sara is not in fight 2's team at all, so its outcome never mentions her.
    run = applyFightOutcome(run, fight([{ id: "duke", hp: 900 }], ["lyra"], 5));

    expect(run.maxHp.sara).toBe(2000);
    expect(runHealthBars(run)).toEqual([
      { id: "duke", hp: 900, max: 2000 },
      { id: "lyra", hp: 0, max: 2000 },
      { id: "sara", hp: 0, max: 2000 },
    ]);
  });

  it("measures loss against the whole team's pool, not per unit", () => {
    // Pool is 3 x 2000 = 6000.
    let run = applyFightOutcome(start(), fight(
      [{ id: "duke", hp: 1200 }, { id: "lyra", hp: 300 }], ["sara"], 3,
    ));
    run = applyFightOutcome(run, fight([{ id: "duke", hp: 900 }], ["lyra"], 5));

    const [first, second] = fightSummaries(run);
    // 6000 -> 1500. Sara's whole bar went with her.
    expect(first.hpLostPercent).toBeCloseTo(75, 5);
    expect(first.hpLeftPercent).toBeCloseTo(25, 5);
    // 1500 -> 900, measured against the same 6000 pool.
    expect(second.hpLostPercent).toBeCloseTo(10, 5);
    expect(second.hpLeftPercent).toBeCloseTo(15, 5);
  });

  it("is empty before the first fight, and never negative", () => {
    expect(fightSummaries(start())).toEqual([]);
    const run = applyFightOutcome(start(), fight(
      [{ id: "duke", hp: 2000 }, { id: "lyra", hp: 2000 }, { id: "sara", hp: 2000 }],
      [], 1,
    ));
    expect(fightSummaries(run)[0].hpLostPercent).toBe(0);
    expect(fightSummaries(run)[0].hpLeftPercent).toBeCloseTo(100, 5);
  });
});

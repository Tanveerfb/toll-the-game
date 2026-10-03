import { describe, expect, it } from "vitest";

import { playerBand, simulate } from "@/lib/game/simulate";
import { aggregateFights, liveSeriesKey } from "@/lib/game/simStats";

/**
 * The simulator's opt-in statistics. A tiny fixed fight is enough to pin the
 * bookkeeping: what one side deals the other takes, overkill is accounted for
 * rather than hidden, and asking for stats changes nothing about the fight.
 */

const RUNS = 40;
const opts = { runs: RUNS, seed: 1, fieldCap: 1, collectStats: true };

describe("simulate({ collectStats })", () => {
  it("is opt-in and does not change the fight", async () => {
    const plain = await simulate(["gon"], ["wild_beast"], {
      runs: RUNS,
      seed: 1,
      fieldCap: 1,
    });
    const counted = await simulate(["gon"], ["wild_beast"], opts);
    expect(plain.stats).toBeUndefined();
    expect(counted.stats).toBeDefined();
    const { stats, ...rest } = counted;
    void stats;
    expect(rest).toEqual(plain);
  });

  it("agrees with the result it rides on", async () => {
    const result = await simulate(["gon"], ["wild_beast"], opts);
    const stats = result.stats!;
    expect(stats.runs).toBe(RUNS);
    expect(stats.outcomes).toEqual({
      wins: result.wins,
      losses: result.losses,
      draws: result.draws,
    });
    expect(stats.turns.min).toBeLessThanOrEqual(stats.turns.mean);
    expect(stats.turns.mean).toBeLessThanOrEqual(stats.turns.max);
  });

  it("balances: what one side deals the other takes, less damage over time", async () => {
    const { stats } = await simulate(["gon", "killua"], ["wild_beast", "raider"], {
      ...opts,
      fieldCap: 2,
    });
    const side = (team: "player" | "enemy") =>
      stats!.units.filter((u) => u.team === team);
    const sum = (rows: ReturnType<typeof side>, pick: (u: (typeof rows)[0]) => number) =>
      rows.reduce((n, u) => n + pick(u), 0);
    // Means are linear, so the identity holds on the means as it does per fight.
    expect(sum(side("player"), (u) => u.damageDealt.mean)).toBeCloseTo(
      sum(side("enemy"), (u) => u.damageTaken.mean - u.tickTaken.mean),
      6,
    );
    expect(sum(side("enemy"), (u) => u.damageDealt.mean)).toBeCloseTo(
      sum(side("player"), (u) => u.damageTaken.mean - u.tickTaken.mean),
      6,
    );
  });

  it("accounts for overkill: reported damage includes it, effective damage does not", async () => {
    const { stats } = await simulate(["gon"], ["wild_beast"], opts);
    const beast = stats!.units.find((u) => u.team === "enemy")!;
    expect(beast.overkillTaken.mean).toBeGreaterThanOrEqual(0);
    expect(beast.overkillTaken.mean).toBeLessThanOrEqual(beast.damageTaken.mean);
    // Every fight is decisive here, so the dead unit's effective damage is
    // exactly its HP pool when it falls (heals aside, wild_beast has none).
    const effective = beast.damageTaken.mean - beast.overkillTaken.mean;
    expect(effective).toBeGreaterThan(0);
  });

  it("splits damage by skill so the pieces add to the total", async () => {
    const { stats } = await simulate(["gon", "killua"], ["wild_beast", "raider"], {
      ...opts,
      fieldCap: 2,
    });
    for (const unit of stats!.units) {
      const parts = Object.values(unit.bySkill).reduce((n, v) => n + v, 0);
      expect(parts).toBeCloseTo(unit.damageDealt.mean, 6);
    }
  });

  it("counts deaths: in a decisive 1v1 exactly one unit falls per fight", async () => {
    const result = await simulate(["gon"], ["wild_beast"], opts);
    const [player, enemy] = ["player", "enemy"].map(
      (team) => result.stats!.units.find((u) => u.team === team)!,
    );
    expect(result.draws).toBe(0);
    expect(player.deathRate).toBeCloseTo(result.losses / RUNS, 9);
    expect(enemy.deathRate).toBeCloseTo(result.wins / RUNS, 9);
    if (result.wins > 0) expect(enemy.meanDeathTurn).toBeGreaterThanOrEqual(1);
  });

  it("is deterministic for a seed", async () => {
    const a = await simulate(["gon"], ["wild_beast"], opts);
    const b = await simulate(["gon"], ["wild_beast"], opts);
    expect(a.stats).toEqual(b.stats);
  });
});

describe("boss passive telemetry", () => {
  const boss = { id: "master_tao_npc", level: 20 };
  const run = () =>
    simulate(playerBand(["duke", "lyra", "siddiq"], 20), [boss], {
      runs: 20,
      seed: 1,
      fieldCap: 3,
      collectStats: true,
    });

  it("reads the live bonus entries off the real unit", async () => {
    const { stats } = await run();
    const tao = stats!.units.find((u) => u.characterId === "master_tao_npc")!;
    const t = stats!.telemetry[tao.instanceId];
    expect(t).toBeDefined();
    const def = t.series[liveSeriesKey("enemyDebuffs", ["def"])];
    const duke = t.series[liveSeriesKey("enemyNamePresent", ["damageDealt"])];
    expect(def.peakMax).toBeLessThanOrEqual(50);
    expect(def.peakMean).toBeLessThanOrEqual(def.peakMax);
    expect(def.mean).toBeLessThanOrEqual(def.peakMax);
    // Duke is on the player's team the whole fight until he falls.
    expect(duke.peakMax).toBe(20);
    expect(duke.activeShare).toBeGreaterThan(0);
    expect(duke.activeShare).toBeLessThanOrEqual(1);
    expect(t.rampTriggers.max).toBeLessThanOrEqual(10);
  });

  it("never lets a non-boss unit grow telemetry", async () => {
    const { stats } = await run();
    const ids = Object.keys(stats!.telemetry);
    expect(ids).toHaveLength(1);
  });
});

describe("aggregateFights", () => {
  it("is safe on no fights", () => {
    const stats = aggregateFights([]);
    expect(stats.runs).toBe(0);
    expect(stats.turns).toEqual({ mean: 0, min: 0, max: 0 });
    expect(stats.units).toEqual([]);
  });
});

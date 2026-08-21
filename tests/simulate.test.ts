import { describe, expect, it } from "vitest";

import { simulate, winRate } from "@/lib/game/simulate";

/**
 * The balance simulator (`lib/game/simulate.ts`, driven by `scripts/sim.ts`).
 *
 * These do not assert that any matchup is balanced — balance is Tanveer's, and
 * a test that pinned a win rate would fail on every deliberate retune. They
 * assert the properties that make a reported number worth believing:
 * determinism, that the engine is actually being driven, and that format
 * changes the answer, which is the whole premise of ruling #57.
 *
 * Kept small on purpose: each run is a real fight through `executeSkill`, so
 * the run counts here are the lowest that still show the property.
 */
describe("the balance simulator", () => {
  it("is deterministic for a given seed", async () => {
    // A balance number nobody can reproduce is a rumour. This is what makes a
    // before/after comparison across a retune mean anything at all.
    const a = await simulate(["duke"], ["seras"], { runs: 12, seed: 42 });
    const b = await simulate(["duke"], ["seras"], { runs: 12, seed: 42 });
    expect(a).toEqual(b);
  });

  it("gives a different answer for a different seed, so it isn't fixed", async () => {
    // Guards the opposite failure: a "deterministic" simulator that ignores
    // its RNG entirely would pass the test above and be worthless.
    const results = [1, 2, 3, 4, 5].map((seed) =>
      simulate(["duke", "lyra", "seras"], ["chiara", "gon", "ban"], {
        runs: 6,
        seed,
        fieldCap: 3,
      }),
    );
    const settled = await Promise.all(results);
    const distinct = new Set(settled.map((r) => `${r.wins}/${r.averageTurns}`));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("accounts every run as a win, a loss or a draw", async () => {
    const result = await simulate(["duke"], ["seras"], { runs: 10, seed: 3 });
    expect(result.wins + result.losses + result.draws).toBe(result.runs);
  });

  it("resolves fights rather than timing them out", async () => {
    // Every fight hitting the turn cap would produce a page of draws and no
    // information — the sign that the loop runs but nobody is dealing damage.
    const result = await simulate(["duke"], ["seras"], { runs: 10, seed: 5 });
    expect(result.draws).toBeLessThan(result.runs);
    expect(result.averageTurns).toBeGreaterThan(0);
  });

  /**
   * Ruling #57's actual claim: card frequency swings 4x between 1v1 and 4v4, so
   * a conclusion from a duel is not a conclusion. If format stopped changing
   * the outcome, this tool would be answering a question nobody asked.
   */
  it("gives a different answer per format, which is the point", async () => {
    const team = ["duke", "lyra", "seras"];
    const foes = ["chiara", "gon", "ban"];
    const duel = await simulate(team.slice(0, 1), foes.slice(0, 1), {
      runs: 20,
      seed: 11,
      fieldCap: 1,
    });
    const full = await simulate(team, foes, {
      runs: 20,
      seed: 11,
      fieldCap: 3,
    });

    // A team fight takes materially longer than a duel — the clearest
    // observable consequence of more units, more actions and more healing.
    expect(full.averageTurns).toBeGreaterThan(duel.averageTurns);
  });

  it("reports no win rate when nothing was decisive", () => {
    expect(
      winRate({
        wins: 0,
        losses: 0,
        draws: 5,
        runs: 5,
        averageTurns: 0,
        averageSurvivors: 0,
      }),
    ).toBeNull();
  });
});

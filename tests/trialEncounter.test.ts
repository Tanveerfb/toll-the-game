import { describe, expect, it } from "vitest";
import {
  FIRST_ASCENSION_TRIAL,
  TRIAL_TUNING_REFERENCE,
  getTrialEncounter,
} from "@/lib/game/trialEncounters";
import {
  eventLockReason,
  eventWaveCount,
  getEvent,
  hasEncounter,
  GAME_EVENTS,
} from "@/lib/game/events";
import {
  applyWaveOutcome,
  beginRun,
  isWipe,
  waveEnemies,
  waveTeam,
} from "@/lib/game/stageRun";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { FIELD_CAP } from "@/lib/game/format";
import { levelMultiplier, ascensionMultiplier } from "@/lib/game/progression";
import { maxLevelForAscension } from "@/lib/game/ascension";
import { simulateRun, clearRate, playerBand } from "@/lib/game/simulate";

/**
 * The First Ascension Trial — three fights on one HP bar (Tanveer,
 * 2026-09-16), adopting Dokkan's battle-road structure: *"Clearing one fight
 * will lead to next one. The hp of chars stay. And there is no heal in
 * between."*
 *
 * The behavioural half is `stageRun.ts`, already pinned by `stageRun.test.ts`.
 * What is new here is the ENCOUNTER: that it exists, that it is shaped the way
 * he specified, and that its levels still produce the difficulty they were
 * tuned to.
 */

describe("the encounter exists and the board can reach it", () => {
  it("is wired to the first trial and unlocks it", () => {
    const trial = getEvent("trial-rank-20")!;
    expect(getTrialEncounter(trial.id)).toBe(FIRST_ASCENSION_TRIAL);
    expect(hasEncounter(trial)).toBe(true);
    // It used to refuse entry with "Encounter not authored yet". At its own
    // rank, with the wall still up, it is now enterable.
    expect(eventLockReason(trial, trial.requiredRank, [])).toBeNull();
  });

  it("still refuses the trial that has no encounter", () => {
    // The Second is deliberately unauthored. If this ever starts passing by
    // accident, the board is promising a fight that does not exist.
    const second = getEvent("trial-rank-40")!;
    expect(hasEncounter(second)).toBe(false);
    expect(eventLockReason(second, second.requiredRank, [])).toBe(
      "Encounter not authored yet",
    );
  });

  it("reports three fights, where the boss reports one", () => {
    expect(eventWaveCount(getEvent("trial-rank-20")!)).toBe(3);
    expect(eventWaveCount(getEvent("molvarr")!)).toBe(1);
    expect(eventWaveCount(getEvent("trial-rank-40")!)).toBe(0);
  });

  it("every authored enemy is a real character", () => {
    for (const wave of FIRST_ASCENSION_TRIAL.waves) {
      expect(wave.enemies.length).toBeGreaterThan(0);
      for (const pick of wave.enemies) {
        expect(getCharacterById(pick.id), `unknown id: ${pick.id}`).toBeDefined();
      }
    }
  });
});

describe("the shape he asked for", () => {
  const [first, second, third] = FIRST_ASCENSION_TRIAL.waves;

  it("is three fights", () => {
    expect(FIRST_ASCENSION_TRIAL.waves).toHaveLength(3);
  });

  it("opens on a group of four, one of them benched", () => {
    // "It can also be a 3+1 sub battle. All four npc can be present." The sub
    // is what keeps the enemy at 3 actions a turn past the point a trio drops
    // to 2, so the count and the flag both matter.
    expect(first.enemies).toHaveLength(FIELD_CAP + 1);
    expect(first.enemies.filter((e) => e.isSub)).toHaveLength(1);
    expect(first.enemies.map((e) => e.id).sort()).toEqual([
      "frost",
      "gale",
      "iron",
      "prism",
    ]);
  });

  it("puts an elite, non-boss enemy second", () => {
    expect(second.enemies).toHaveLength(1);
    const lyra = getCharacterById(second.enemies[0].id)!;
    expect(lyra.tier).toBe("elite");
    // Non-boss: the multi-phase kit is wave 3's job.
    expect(lyra.phases ?? []).toHaveLength(0);
  });

  it("ends on Molvarr, both phases, fought to the end", () => {
    expect(third.enemies).toEqual([{ id: "molvarr", level: 24 }]);
    expect(getCharacterById("molvarr")!.phases).toHaveLength(2);
    // He chose the kill over the survive-to-a-threshold option, so the wave
    // must NOT carry an early-victory condition.
    expect(third.victoryAtEnemyHpPercent).toBeUndefined();
  });

  it("escalates — no wave is easier than the one before", () => {
    const levels = FIRST_ASCENSION_TRIAL.waves.map((w) =>
      Math.max(...w.enemies.map((e) => e.level ?? 1)),
    );
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });
});

describe("the tuning reference is a team the game can produce", () => {
  it("level 20 really does require ascension 1", () => {
    // The trap this guards: tuning against {level: 20, ascension: 0} measures
    // a 1.322x team that cannot exist, understating the player by 13%.
    const { level, ascension, multiplier } = TRIAL_TUNING_REFERENCE;
    expect(maxLevelForAscension(ascension)).toBe(level);
    expect(maxLevelForAscension(ascension - 1)).toBeLessThan(level);
    expect(levelMultiplier(level) + ascensionMultiplier(ascension)).toBeCloseTo(
      multiplier,
      3,
    );
  });
});

describe("the run rule: no heal between fights", () => {
  it("carries damage forward and never revives the fallen", () => {
    const team = [{ id: "duke" }, { id: "lyra" }, { id: "seras" }];
    let run = beginRun("trial-rank-20", FIRST_ASCENSION_TRIAL, team);
    expect(waveEnemies(FIRST_ASCENSION_TRIAL, run)).toHaveLength(4);

    run = applyWaveOutcome(run, {
      survivors: [
        { id: "duke", hp: 900 },
        { id: "lyra", hp: 120 },
      ],
      fallenIds: ["seras"],
      turns: 6,
      ultimates: 1,
      rankUses: { 1: 3, 2: 1, 3: 0 },
    });

    // Wave 2 is fought by two units at the HP wave 1 left them.
    expect(run.carryHp).toEqual({ duke: 900, lyra: 120 });
    expect(waveTeam(run).map((p) => p.id)).toEqual(["duke", "lyra"]);
    expect(run.complete).toBe(false);
    expect(isWipe(run)).toBe(false);

    run = applyWaveOutcome(run, {
      survivors: [{ id: "duke", hp: 400 }],
      fallenIds: ["lyra"],
      turns: 9,
      ultimates: 0,
      rankUses: { 1: 4, 2: 0, 3: 1 },
    });
    // Still not healed, still not revived.
    expect(run.carryHp).toEqual({ duke: 400 });
    expect(run.fallen.sort()).toEqual(["lyra", "seras"]);

    run = applyWaveOutcome(run, {
      survivors: [{ id: "duke", hp: 55 }],
      fallenIds: [],
      turns: 11,
      ultimates: 1,
      rankUses: { 1: 2, 2: 2, 3: 0 },
    });
    expect(run.complete).toBe(true);
    expect(run.turns).toBe(26);
  });

  it("a wipe is losing everyone, not losing a fight", () => {
    const run = applyWaveOutcome(
      beginRun("trial-rank-20", FIRST_ASCENSION_TRIAL, [{ id: "duke" }]),
      {
        survivors: [],
        fallenIds: ["duke"],
        turns: 4,
        ultimates: 0,
        rankUses: { 1: 1, 2: 0, 3: 0 },
      },
    );
    expect(isWipe(run)).toBe(true);
  });
});

/**
 * The tuning itself, run through the real engine.
 *
 * Deliberately wide bounds. This asserts the encounter is still in the band it
 * was designed for — not an exact win rate, which would go red on any engine
 * change and tell nobody anything. Remember `simulateRun` plays the PLAYER
 * side with the enemy AI, so these are floors rather than expectations.
 */
describe("difficulty is still where it was tuned", () => {
  const BALANCED = ["meliodas", "seras", "leorio", "mustafa"];

  it("a level-20 balanced team clears more often than not, but bleeds", async () => {
    const result = await simulateRun(
      playerBand(BALANCED, 20),
      FIRST_ASCENSION_TRIAL.waves.map((w) => w.enemies),
      { runs: 60, seed: 11, maxTurns: 80 },
    );
    const rate = clearRate(result);
    expect(rate).toBeGreaterThan(55);
    expect(rate).toBeLessThan(95);
    // The climax is wave 3, not wave 1 — if that inverts, the escalation broke.
    expect(result.wipesByWave[2]).toBeGreaterThanOrEqual(
      result.wipesByWave[0],
    );
  }, 120_000);

  it("the same team at level 1 does not clear", async () => {
    const result = await simulateRun(
      playerBand(BALANCED, 1),
      FIRST_ASCENSION_TRIAL.waves.map((w) => w.enemies),
      { runs: 40, seed: 11, maxTurns: 80 },
    );
    expect(clearRate(result)).toBe(0);
    // And it is the elite that stops them, which is what makes the trial a
    // level check rather than a boss check.
    expect(result.averageWavesCleared).toBeLessThan(2);
  }, 120_000);
});

describe("the registry", () => {
  it("every trial event with an encounter clears a wall", () => {
    for (const event of GAME_EVENTS) {
      if (!getTrialEncounter(event.id)) continue;
      expect(event.kind).toBe("trial");
      expect(event.clearsWall).toBeDefined();
    }
  });
});

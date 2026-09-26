import { describe, expect, it } from "vitest";
import {
  FIRST_ASCENSION_TRIAL,
  TRIAL_TUNING_REFERENCE,
  getTrialEncounter,
} from "@/lib/game/trialEncounters";
import {
  eventLockReason,
  eventFightCount,
  getEvent,
  hasEncounter,
  GAME_EVENTS,
} from "@/lib/game/events";
import {
  applyFightOutcome,
  beginRun,
  isWipe,
  fightEnemies,
  fightTeam,
} from "@/lib/game/fightRun";
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
 * The behavioural half is `fightRun.ts`, already pinned by `fightRun.test.ts`.
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

  it("is enterable by the only rule the brief may ask", () => {
    // The bug this pins, found by opening the page rather than by any test
    // (2026-09-17): the brief gated its Enter button on `!!event.enemyId`,
    // which is **null on a trial** — so the fight was unreachable while
    // `eventLockReason` reported it unlocked. Two conditions answering one
    // question, and only one of them was updated when trials gained
    // encounters. `eventLockReason` is now the single source, and this asserts
    // the property the brief depends on: a trial with an encounter, at its own
    // rank, with the wall still up, has NO lock reason and NO enemyId.
    const trial = getEvent("trial-rank-20")!;
    expect(trial.enemyId).toBeNull();
    expect(eventLockReason(trial, trial.requiredRank, [])).toBeNull();
  });

  it("reports three fights, where the boss reports one", () => {
    expect(eventFightCount(getEvent("trial-rank-20")!)).toBe(3);
    expect(eventFightCount(getEvent("molvarr")!)).toBe(1);
    expect(eventFightCount(getEvent("trial-rank-40")!)).toBe(0);
  });

  it("every authored enemy is a real character", () => {
    for (const fight of FIRST_ASCENSION_TRIAL.fights) {
      expect(fight.enemies.length).toBeGreaterThan(0);
      for (const pick of fight.enemies) {
        expect(getCharacterById(pick.id), `unknown id: ${pick.id}`).toBeDefined();
      }
    }
  });
});

describe("the shape he asked for", () => {
  const [first, second, third] = FIRST_ASCENSION_TRIAL.fights;

  it("is three fights", () => {
    expect(FIRST_ASCENSION_TRIAL.fights).toHaveLength(3);
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
    // Non-boss: the multi-phase kit is fight 3's job.
    expect(lyra.phases ?? []).toHaveLength(0);
  });

  it("ends on Molvarr, both phases, fought to the end", () => {
    expect(third.enemies).toEqual([{ id: "molvarr", level: 24 }]);
    expect(getCharacterById("molvarr")!.phases).toHaveLength(2);
    // He chose the kill over the survive-to-a-threshold option, so the fight
    // must NOT carry an early-victory condition.
    expect(third.victoryAtEnemyHpPercent).toBeUndefined();
  });

  it("escalates — no fight is easier than the one before", () => {
    const levels = FIRST_ASCENSION_TRIAL.fights.map((w) =>
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

/** Max HP for the trial team below. See `FightOutcome.maxHp`. */
const TRIAL_MAX = { duke: 2000, lyra: 2000, seras: 2000 };

describe("the run rule: no heal between fights", () => {
  it("carries damage forward and never revives the fallen", () => {
    const team = [{ id: "duke" }, { id: "lyra" }, { id: "seras" }];
    let run = beginRun(FIRST_ASCENSION_TRIAL, team);
    expect(fightEnemies(FIRST_ASCENSION_TRIAL, run)).toHaveLength(4);

    run = applyFightOutcome(run, {
      survivors: [
        { id: "duke", hp: 900 },
        { id: "lyra", hp: 120 },
      ],
      fallenIds: ["seras"],
      turns: 6,
      ultimates: 1,
      rankUses: { 1: 3, 2: 1, 3: 0 },
      maxHp: TRIAL_MAX,
    });

    // Fight 2 is fought by two units at the HP fight 1 left them.
    expect(run.carryHp).toEqual({ duke: 900, lyra: 120 });
    expect(fightTeam(run).map((p) => p.id)).toEqual(["duke", "lyra"]);
    expect(run.complete).toBe(false);
    expect(isWipe(run)).toBe(false);

    run = applyFightOutcome(run, {
      survivors: [{ id: "duke", hp: 400 }],
      fallenIds: ["lyra"],
      turns: 9,
      ultimates: 0,
      rankUses: { 1: 4, 2: 0, 3: 1 },
      maxHp: TRIAL_MAX,
    });
    // Still not healed, still not revived.
    expect(run.carryHp).toEqual({ duke: 400 });
    expect(run.fallen.sort()).toEqual(["lyra", "seras"]);

    run = applyFightOutcome(run, {
      survivors: [{ id: "duke", hp: 55 }],
      fallenIds: [],
      turns: 11,
      ultimates: 1,
      rankUses: { 1: 2, 2: 2, 3: 0 },
      maxHp: TRIAL_MAX,
    });
    expect(run.complete).toBe(true);
    expect(run.turns).toBe(26);
  });

  it("a wipe is losing everyone, not losing a fight", () => {
    const run = applyFightOutcome(
      beginRun(FIRST_ASCENSION_TRIAL, [{ id: "duke" }]),
      {
        survivors: [],
        fallenIds: ["duke"],
        turns: 4,
        ultimates: 0,
        rankUses: { 1: 1, 2: 0, 3: 0 },
        maxHp: TRIAL_MAX,
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

  /**
   * PARKED 2026-09-26, pending his playtest.
   *
   * This clear rate (~77%) was measured while Molvarr's second phase ignored
   * his level (`enterBossPhase` copied raw JSON). With the stat pipeline fixed
   * (`tests/battleStats.test.ts`) the same team clears **2.2%** at his
   * authored level 24. Measured, Lv20 balanced team, 180 runs:
   *
   *   Molvarr Lv1 96.1% · Lv6 79.4% · Lv10 52.8% · Lv14 24.4% · Lv18 12.2% ·
   *   Lv24 2.2%
   *
   * Tanveer, 2026-09-26: *"let me judge if the molvarr fight is too difficult
   * or not. i will play test it and get back to you"*. The level is his call;
   * un-skip this with whatever band his answer implies.
   */
  it.skip("a level-20 balanced team clears more often than not, but bleeds", async () => {
    const result = await simulateRun(
      playerBand(BALANCED, 20),
      FIRST_ASCENSION_TRIAL.fights.map((w) => w.enemies),
      { runs: 60, seed: 11, maxTurns: 80 },
    );
    const rate = clearRate(result);
    expect(rate).toBeGreaterThan(55);
    expect(rate).toBeLessThan(95);
    // The climax is fight 3, not fight 1 — if that inverts, the escalation broke.
    expect(result.wipesByFight[2]).toBeGreaterThanOrEqual(
      result.wipesByFight[0],
    );
  }, 120_000);

  it("the same team at level 1 does not clear", async () => {
    const result = await simulateRun(
      playerBand(BALANCED, 1),
      FIRST_ASCENSION_TRIAL.fights.map((w) => w.enemies),
      { runs: 40, seed: 11, maxTurns: 80 },
    );
    expect(clearRate(result)).toBe(0);
    // And it is the elite that stops them, which is what makes the trial a
    // level check rather than a boss check.
    expect(result.averageFightsCleared).toBeLessThan(2);
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

import { describe, expect, it } from "vitest";
import { battleStats } from "@/lib/game/battleStats";
import { buildBattleUnit } from "@/lib/game/buildUnit";
import {
  getCharacterById,
  getCharacterPhases,
} from "@/lib/game/characterCatalog";
import { enterBossPhase, transitionBossPhases } from "@/lib/game/phases";
import { progressedStats } from "@/lib/game/progression";
import { enemyLevelForDifficulty, MAX_WORLD_LEVEL } from "@/lib/game/worldLevel";
import type { BattleCharacter } from "@/types/character";
import type { StageEffect } from "@/types/stageEffects";

/**
 * One path from a statline to the numbers a unit fights at (2026-09-26).
 *
 * Found by Tanveer on the world boss: *"difficulty two does not change the
 * stats even though the boss levels up"*. Two causes, one shape — a second
 * code path that skipped the pipeline:
 *
 * - `enterBossPhase` built every later phase from the phase's raw JSON, so
 *   Molvarr's second phase fought at 10,000 / 400 / 230 at **every**
 *   difficulty and dropped any stage effect. At difficulty 2 and up he got
 *   *weaker* when he broke. The simulator shared the function, so it shared
 *   the bug.
 * - The boss brief printed catalog stats beside "Level 26".
 *
 * These pin the pipeline, and pin every consumer to it.
 */

const molvarr = getCharacterById("molvarr")!;
const [phase1, phase2] = getCharacterPhases(molvarr);

const ENEMY_BOOST: StageEffect[] = [
  { type: "statBoost", stat: "all", valuePercent: 20, target: "enemy" },
];

/** Molvarr exactly as the battle and the simulator build him. */
function builtMolvarr(level: number, stageEffects: StageEffect[] = []): BattleCharacter {
  return buildBattleUnit({
    raw: molvarr,
    pick: { id: "molvarr", level },
    team: "enemy",
    instanceId: "e1_molvarr",
    isSub: false,
    stageEffects,
  });
}

describe("battleStats", () => {
  it("is progression alone when there are no stage effects", () => {
    const progression = { level: 26, ascension: 1 };
    expect(battleStats(molvarr, { progression, side: "enemy" })).toEqual(
      progressedStats(molvarr, progression),
    );
  });

  it("applies stage effects after progression, to the side they name", () => {
    const progression = { level: 26, ascension: 0 };
    const leveled = progressedStats(molvarr, progression);
    const boosted = battleStats(molvarr, {
      progression,
      stageEffects: ENEMY_BOOST,
      side: "enemy",
    });
    expect(boosted.hp).toBe(Math.round(leveled.hp * 1.2));
    // The player's side is untouched by an enemy-only effect.
    expect(
      battleStats(molvarr, { progression, stageEffects: ENEMY_BOOST, side: "player" }),
    ).toEqual(leveled);
  });

  it("defaults to the bare statline", () => {
    expect(battleStats(molvarr, { side: "enemy" })).toEqual({
      hp: molvarr.hp,
      atk: molvarr.atk,
      def: molvarr.def,
    });
  });
});

describe("buildBattleUnit — the one builder the battle and the simulator share", () => {
  const duke = getCharacterById("duke")!;
  const build = (over: Partial<Parameters<typeof buildBattleUnit>[0]> = {}) =>
    buildBattleUnit({
      raw: duke,
      pick: { id: "duke" },
      team: "player",
      instanceId: "p1_duke",
      isSub: false,
      ...over,
    });

  it("stamps the progression it built at, so a later rebuild can use it", () => {
    // Without this a boss's next phase has nothing to scale from, which is
    // the whole of his difficulty-2 bug.
    const unit = build({ pick: { id: "duke", level: 26, ascension: 1 } });
    expect(unit.level).toBe(26);
    expect(unit.ascension).toBe(1);
  });

  it("builds stats through battleStats", () => {
    const unit = build({
      pick: { id: "duke", level: 26 },
      stageEffects: ENEMY_BOOST.map((e) => ({ ...e, target: "player" as const })),
    });
    const expected = battleStats(duke, {
      progression: { level: 26, ascension: 0 },
      stageEffects: ENEMY_BOOST.map((e) => ({ ...e, target: "player" as const })),
      side: "player",
    });
    expect({ hp: unit.hp, atk: unit.atk, def: unit.def }).toEqual(expected);
    expect(unit.currentHP).toBe(expected.hp);
  });

  it("lets an authored level beat the save, and the save beat the default", () => {
    const saved = { level: 12, ascension: 1, ultLevel: 3 };
    expect(build({ saved }).level).toBe(12);
    expect(build({ saved }).ultLevel).toBe(3);
    expect(build({ saved, pick: { id: "duke", level: 30 } }).level).toBe(30);
    expect(build().level).toBe(1);
  });

  it("clamps carried HP to [1, max] — a survivor is never handed 0", () => {
    // The simulator's old copy let this reach 0, the battle's did not.
    expect(build({ carriedHp: 0 }).currentHP).toBe(1);
    expect(build({ carriedHp: 999_999 }).currentHP).toBe(build().hp);
    expect(build({ carriedHp: 1234.4 }).currentHP).toBe(1234);
  });
});

describe("a boss's later phase goes through the same pipeline", () => {
  it("scales phase 2 with the level phase 1 was built at", () => {
    const level = enemyLevelForDifficulty(2);
    const next = enterBossPhase(builtMolvarr(level), 1);
    const expected = progressedStats(phase2, { level, ascension: 0 });
    expect({ hp: next.hp, atk: next.atk, def: next.def }).toEqual(expected);
    expect(next.currentHP).toBe(expected.hp);
    expect(next.currentAttack).toBe(expected.atk);
    expect(next.currentDefense).toBe(expected.def);
  });

  it("keeps the fight's stage effects across the break", () => {
    const level = enemyLevelForDifficulty(2);
    const next = enterBossPhase(builtMolvarr(level, ENEMY_BOOST), 1, ENEMY_BOOST);
    const expected = battleStats(phase2, {
      progression: { level, ascension: 0 },
      stageEffects: ENEMY_BOOST,
      side: "enemy",
    });
    expect({ hp: next.hp, atk: next.atk, def: next.def }).toEqual(expected);
  });

  it("carries the unit's progression into the new phase", () => {
    const next = enterBossPhase(builtMolvarr(26), 1);
    expect(next.level).toBe(26);
    expect(next.ascension).toBe(0);
  });

  it("never gets weaker at the break, at any difficulty", () => {
    // The shape of his bug: phase 2's authored stats are all higher than
    // phase 1's, so a boss that loses stats when it breaks is scaling one
    // phase and not the other.
    for (let d = 1; d <= MAX_WORLD_LEVEL; d += 1) {
      const unit = builtMolvarr(enemyLevelForDifficulty(d));
      const next = enterBossPhase(unit, 1);
      expect(next.hp, `difficulty ${d}`).toBeGreaterThan(unit.hp);
      expect(next.atk, `difficulty ${d}`).toBeGreaterThan(unit.atk);
      expect(next.def, `difficulty ${d}`).toBeGreaterThan(unit.def);
    }
  });

  it("rises with difficulty in both phases", () => {
    let previous = 0;
    for (let d = 1; d <= MAX_WORLD_LEVEL; d += 1) {
      const next = enterBossPhase(builtMolvarr(enemyLevelForDifficulty(d)), 1);
      expect(next.hp, `difficulty ${d}`).toBeGreaterThan(previous);
      previous = next.hp;
    }
  });

  it("transitionBossPhases passes the fight's stage effects through", () => {
    const unit = { ...builtMolvarr(26, ENEMY_BOOST), currentHP: 0 };
    const { team } = transitionBossPhases([unit], ENEMY_BOOST);
    const expected = battleStats(phase2, {
      progression: { level: 26, ascension: 0 },
      stageEffects: ENEMY_BOOST,
      side: "enemy",
    });
    expect(team[0].phaseIndex).toBe(1);
    expect(team[0].hp).toBe(expected.hp);
  });

  it("phase 1 JSON matches the top-level statline it is built from", () => {
    // `startCustomBattle` builds phase 1 from the kit's top level, and the
    // break reads `phases[1]`. If the two ever disagreed, phase 1 would be
    // fought at stats nothing displays.
    expect({ hp: phase1.hp, atk: phase1.atk, def: phase1.def }).toEqual({
      hp: molvarr.hp,
      atk: molvarr.atk,
      def: molvarr.def,
    });
  });
});

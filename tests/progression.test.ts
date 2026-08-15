import { describe, expect, it } from "vitest";
import {
  ascensionMultiplier,
  BASE_PROGRESSION,
  LEVEL_CAP,
  levelMultiplier,
  progressedStat,
  progressedStats,
  scaledUltDamage,
  ultDamageForLevel,
  ultMultiplier,
} from "@/lib/game/progression";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";
import { MAX_ULT_LEVEL } from "@/lib/gacha/dupes";
import { getCharacterById } from "@/lib/game/characterCatalog";

describe("levelMultiplier", () => {
  it("is a no-op at level 1", () => {
    expect(levelMultiplier(1)).toBe(1);
  });

  it("doubles at the cap", () => {
    expect(levelMultiplier(LEVEL_CAP)).toBeCloseTo(2, 10);
  });

  it("climbs linearly between", () => {
    const step = levelMultiplier(2) - levelMultiplier(1);
    expect(levelMultiplier(31) - levelMultiplier(30)).toBeCloseTo(step, 10);
  });

  it("clamps rather than paying out past the cap", () => {
    expect(levelMultiplier(LEVEL_CAP + 40)).toBe(levelMultiplier(LEVEL_CAP));
    expect(levelMultiplier(0)).toBe(1);
    expect(levelMultiplier(-5)).toBe(1);
  });
});

describe("ascensionMultiplier", () => {
  it("adds nothing unascended", () => {
    expect(ascensionMultiplier(0)).toBe(0);
  });

  it("adds a full base across all six bands", () => {
    expect(ascensionMultiplier(6)).toBeCloseTo(1, 10);
  });

  it("adds a sixth per band", () => {
    expect(ascensionMultiplier(3)).toBeCloseTo(0.5, 10);
  });
});

describe("progressedStat", () => {
  it("changes nothing at the default progression", () => {
    // The whole roster sits here today: playerStore defaults to level 1 /
    // ascension 0, and ascension 0 caps max level at 1. Wiring progression in
    // must not move a single existing number.
    for (const base of [80, 145, 245, 3150, 4000]) {
      expect(progressedStat(base, BASE_PROGRESSION)).toBe(base);
    }
  });

  it("reaches exactly 2x at the cap for every stat magnitude", () => {
    // This is the correction to the spec's rounded per-level constant, which
    // gave a small DEF 1.74x while a large HP got 2.00x.
    for (const base of [80, 110, 145, 190, 300, 3150, 4000]) {
      expect(progressedStat(base, { level: LEVEL_CAP, ascension: 0 })).toBe(
        base * 2,
      );
    }
  });

  it("reaches 3x fully levelled and fully ascended", () => {
    expect(progressedStat(3150, { level: LEVEL_CAP, ascension: 6 })).toBe(9450);
    expect(progressedStat(80, { level: LEVEL_CAP, ascension: 6 })).toBe(240);
  });
});

describe("progressedStats on real characters", () => {
  it("leaves Duke untouched at the floor", () => {
    const duke = getCharacterById("duke")!;
    expect(
      progressedStats(
        { hp: duke.hp, atk: duke.atk, def: duke.def },
        BASE_PROGRESSION,
      ),
    ).toEqual({ hp: duke.hp, atk: duke.atk, def: duke.def });
  });

  it("keeps an owned, levelled character ahead of a story trial", () => {
    // Tanveer's requirement: "my own level 40 chiara would be stronger than
    // story level 10 chiara provided that i have chiara and i levelled her up".
    const chiara = getCharacterById("chiara")!;
    const base = { hp: chiara.hp, atk: chiara.atk, def: chiara.def };
    const trial = progressedStats(base, { level: 10, ascension: 0 });
    const owned = progressedStats(base, { level: 40, ascension: 3 });
    expect(owned.hp).toBeGreaterThan(trial.hp);
    expect(owned.atk).toBeGreaterThan(trial.atk);
    expect(owned.def).toBeGreaterThan(trial.def);
  });

  it("keeps a trial character ahead of an unlevelled one", () => {
    const chiara = getCharacterById("chiara")!;
    const base = { hp: chiara.hp, atk: chiara.atk, def: chiara.def };
    const trial = progressedStats(base, { level: 10, ascension: 0 });
    expect(trial.atk).toBeGreaterThan(base.atk);
  });
});

describe("ultMultiplier", () => {
  it("is a no-op at ult level 1", () => {
    expect(ultMultiplier(1, MAX_ULT_LEVEL)).toBe(1);
  });

  it("adds 60% of the base multiplier at max", () => {
    expect(ultMultiplier(MAX_ULT_LEVEL, MAX_ULT_LEVEL)).toBeCloseTo(1.6, 10);
  });

  it("walks a 500% ultimate up the ladder Tanveer specified", () => {
    // 500 at level 1 reaching 800 at level 6.
    const ladder = Array.from({ length: MAX_ULT_LEVEL }, (_, i) =>
      scaledUltDamage(500, i + 1, MAX_ULT_LEVEL),
    );
    expect(ladder).toEqual([500, 560, 620, 680, 740, 800]);
  });

  it("applies the same relative growth to any base multiplier", () => {
    expect(scaledUltDamage(300, MAX_ULT_LEVEL, MAX_ULT_LEVEL)).toBe(480);
    expect(scaledUltDamage(1000, MAX_ULT_LEVEL, MAX_ULT_LEVEL)).toBe(1600);
  });

  it("clamps out-of-range ult levels", () => {
    expect(ultMultiplier(0, MAX_ULT_LEVEL)).toBe(1);
    expect(ultMultiplier(99, MAX_ULT_LEVEL)).toBe(
      ultMultiplier(MAX_ULT_LEVEL, MAX_ULT_LEVEL),
    );
  });

  it("survives a single-level ceiling without dividing by zero", () => {
    expect(ultMultiplier(1, 1)).toBe(1);
  });
});

/**
 * Ult ladders (Tanveer, 2026-08-14): "ult levels work in a similar fashion to
 * skill ranks... only one of 6 values comes to the battle". Every playable
 * ultimate authors its own six values; the old uniform +60% curve survives only
 * for kits without a ladder — bosses and story NPCs, which have no ult level.
 */
describe("ultDamageForLevel", () => {
  const duke = { damage: 350, damageByUltLevel: [350, 385, 430, 475, 520, 575] };

  it("reads the authored value for the level", () => {
    expect(ultDamageForLevel(duke, 1, 6)).toBe(350);
    expect(ultDamageForLevel(duke, 4, 6)).toBe(475);
    expect(ultDamageForLevel(duke, 6, 6)).toBe(575);
  });

  it("clamps rather than reading past the ends of the ladder", () => {
    expect(ultDamageForLevel(duke, 0, 6)).toBe(350);
    expect(ultDamageForLevel(duke, 99, 6)).toBe(575);
  });

  it("falls back to the uniform curve when no ladder is authored", () => {
    // A boss ultimate: flat `damage`, always fought at level 1.
    const boss = { damage: 500 };
    expect(ultDamageForLevel(boss, 1, 6)).toBe(500);
    expect(ultDamageForLevel(boss, 6, 6)).toBe(800);
  });

  it("every playable ultimate authors a six-value ladder that only climbs", () => {
    for (const character of getPlayableCharacters()) {
      const ult = character.ultimate;
      if (!ult) continue;
      const ladder = ult.damageByUltLevel;
      // Isolde's ultimate deals no damage — hers ladders through mechanics.
      if (ult.damage === 0 && !ladder) continue;
      expect(ladder, `${character.id} has no ult ladder`).toHaveLength(6);
      expect([...ladder!].sort((a, b) => a - b), character.id).toEqual(ladder);
      expect(ladder![0], `${character.id} level 1`).toBe(ult.damage);
    }
  });
});

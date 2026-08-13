import { describe, expect, it } from "vitest";
import {
  addRewards,
  BASE_CORRODED_SEAWEED,
  BASE_SEA_MONSTER_EYE,
  TRAINING_MANUAL_MAX,
  TRAINING_MANUAL_MIN,
  attemptableTiers,
  emptyRewards,
  getBossTier,
  MOLVARR_TIERS,
  tierKey,
  type WorldBossRewards,
  rollFarmableRewards,
  rollWorldBossRewards,
} from "@/lib/game/worldBossRewards";
import { ASCENSION_COSTS } from "@/lib/game/ascension";
import { MAX_WORLD_LEVEL } from "@/lib/game/worldLevel";

describe("rollWorldBossRewards", () => {
  it("grants the base amounts with no bonus when the rng always misses the 10% roll", () => {
    const result = rollWorldBossRewards(() => 0.99);
    expect(result.sea_monster_eye).toBe(BASE_SEA_MONSTER_EYE);
    expect(result.corroded_seaweed).toBe(BASE_CORRODED_SEAWEED);
  });

  it("grants the +1 bonus on both rolls when the rng always hits the 10% threshold", () => {
    const result = rollWorldBossRewards(() => 0);
    expect(result.sea_monster_eye).toBe(BASE_SEA_MONSTER_EYE + 1);
    expect(result.corroded_seaweed).toBe(BASE_CORRODED_SEAWEED + 1);
  });

  it("does not grant bonus at exactly the 10% threshold (uses < not <=)", () => {
    const result = rollWorldBossRewards(() => 0.1);
    expect(result.sea_monster_eye).toBe(BASE_SEA_MONSTER_EYE);
    expect(result.corroded_seaweed).toBe(BASE_CORRODED_SEAWEED);
  });

  // The two materials only ever drop together, from the same clear, so their
  // drop ratio has to cover the worst ascension ratio or one of them becomes
  // the sole gate while the other accumulates unspent. That is exactly what
  // Tanveer hit on 2026-08-13: 8 eyes banked against 4 seaweed.
  it("drops seaweed fast enough to cover every ascension band's ratio", () => {
    for (const [band, cost] of Object.entries(ASCENSION_COSTS)) {
      const needed = cost.corroded_seaweed / cost.sea_monster_eye;
      const dropped = BASE_CORRODED_SEAWEED / BASE_SEA_MONSTER_EYE;
      expect(dropped, `band ${band}`).toBeGreaterThanOrEqual(needed);
    }
  });

  // Asserted against the constants, not literals. These are tuning numbers —
  // they moved from 3-6 to 4-8 on 2026-08-13 — and a test that hardcodes them
  // tests the retune, not the roll.
  it("grants the training_manual minimum when rng is 0", () => {
    const result = rollWorldBossRewards(() => 0);
    expect(result.training_manual).toBe(TRAINING_MANUAL_MIN);
  });

  it("grants the training_manual maximum when rng is just under 1", () => {
    const result = rollWorldBossRewards(() => 0.999999);
    expect(result.training_manual).toBe(TRAINING_MANUAL_MAX);
  });

  it("grants coin minimum (2000) when rng is 0", () => {
    const result = rollWorldBossRewards(() => 0);
    expect(result.coin).toBe(2000);
  });

  it("grants coin maximum (10000) when rng is just under 1", () => {
    const result = rollWorldBossRewards(() => 0.999999);
    expect(result.coin).toBe(10000);
  });

  it("pays the first clear's FIXED 50 gems regardless of the roll", () => {
    // The point of the rewrite: a first clear is a designed payout, not a
    // lottery. Both extremes of rng must give the same gems.
    expect(rollWorldBossRewards(() => 0, { firstClear: true }).gems).toBe(50);
    expect(
      rollWorldBossRewards(() => 0.999999, { firstClear: true }).gems,
    ).toBe(50);
  });

  it("grants no permanentTicket on a farmed clear", () => {
    // It used to roll 1-3 EVERY clear. Tanveer's farmable list (2026-08-13)
    // doesn't include it — it is summon currency, so it lives in the
    // first-clear bundle at a fixed 1 and nowhere else.
    const result = rollWorldBossRewards(() => 0);
    expect(result.permanentTicket).toBe(0);
  });

  it("grants exactly one permanentTicket on the first clear, fixed", () => {
    expect(
      rollWorldBossRewards(() => 0.999999, { firstClear: true }).permanentTicket,
    ).toBe(1);
  });
});

describe("the first-clear bundle is fixed, never rolled (Tanveer, 2026-08-13)", () => {
  it("pays his exact numbers", () => {
    expect(getBossTier(1).firstClear).toEqual({
      gems: 50,
      sea_monster_eye: 3,
      corroded_seaweed: 10,
      coin: 50_000,
      accountXp: 50,
      training_manual: 15,
      training_manual_advanced: 10,
      training_manual_premium: 5,
      permanentTicket: 1,
    });
  });

  it("is identical at every rng value", () => {
    const lo = rollWorldBossRewards(() => 0, { firstClear: true });
    const hi = rollWorldBossRewards(() => 0.999999, { firstClear: true });
    // Only the farmable half may differ between the two.
    expect(addRewards(lo, getBossTier(1).firstClear)).not.toEqual(hi);
    for (const key of ["gems", "permanentTicket", "training_manual_advanced", "training_manual_premium"] as const) {
      expect(lo[key], key).toBe(hi[key]);
    }
  });

  it("pays BOTH halves on a first clear", () => {
    // "ofc first time clearing the boss will give the player both type of
    // rewards together" — his words.
    const farmable = rollFarmableRewards(1, () => 0.5);
    const first = rollWorldBossRewards(() => 0.5, { firstClear: true });
    expect(first).toEqual(addRewards(getBossTier(1).firstClear, farmable));
    expect(first.sea_monster_eye).toBe(
      getBossTier(1).firstClear.sea_monster_eye + farmable.sea_monster_eye,
    );
  });
});

describe("the farmable half never carries summon currency", () => {
  it("pays no gems and no permanent ticket, at any roll", () => {
    for (const r of [0, 0.5, 0.999999]) {
      const farmable = rollFarmableRewards(1, () => r);
      expect(farmable.gems, `rng ${r}`).toBe(0);
      expect(farmable.permanentTicket, `rng ${r}`).toBe(0);
    }
  });

  it("pays no higher-tier manuals — those are first-clear only", () => {
    const farmable = rollFarmableRewards(1, () => 0.5);
    expect(farmable.training_manual_advanced).toBe(0);
    expect(farmable.training_manual_premium).toBe(0);
    expect(farmable.training_manual).toBeGreaterThan(0);
  });
});

describe("gems are a first-clear reward and never grindable (Tanveer, 2026-08-13)", () => {
  it("pays no gems on a repeat clear", () => {
    // The bug: the boss paid 20-50 gems EVERY clear, which made the summoning
    // currency farmable at roughly seven runs a day.
    expect(rollWorldBossRewards(() => 0.5).gems).toBe(0);
    expect(rollWorldBossRewards(() => 0.5, { firstClear: false }).gems).toBe(0);
  });

  it("defaults to a repeat clear when nothing is said", () => {
    // The safe default: an unflagged call is the grind, not the first time.
    expect(rollWorldBossRewards(() => 0.999999).gems).toBe(0);
  });

  it("differs from a first clear by exactly the bundle", () => {
    const first = rollWorldBossRewards(() => 0.5, { firstClear: true });
    const repeat = rollWorldBossRewards(() => 0.5, { firstClear: false });
    expect(addRewards(repeat, getBossTier(1).firstClear)).toEqual(first);
  });

  it("still pays the materials the grind exists for", () => {
    const repeat = rollWorldBossRewards(() => 0.5);
    expect(repeat.sea_monster_eye).toBeGreaterThan(0);
    expect(repeat.corroded_seaweed).toBeGreaterThan(0);
    expect(repeat.accountXp).toBeGreaterThan(0);
  });
});

describe("difficulty is content, not a coefficient (Tanveer, 2026-08-13)", () => {
  it("authors one tier per world level, gated by it", () => {
    expect(MOLVARR_TIERS).toHaveLength(MAX_WORLD_LEVEL);
    MOLVARR_TIERS.forEach((tier, i) => {
      expect(tier.difficulty).toBe(i + 1);
      // "higher world level is required to attempt the fights that have that
      // kind of multi difficulty variations" — his words.
      expect(tier.requiredWorldLevel).toBe(tier.difficulty);
    });
  });

  it("makes every tier strictly better than the one below it", () => {
    // The invariant that holds whatever numbers he lands on. If a tier ever
    // pays less than an easier one, nobody would ever climb.
    for (let i = 1; i < MOLVARR_TIERS.length; i += 1) {
      const lower = MOLVARR_TIERS[i - 1];
      const higher = MOLVARR_TIERS[i];
      const label = `tier ${higher.difficulty} vs ${lower.difficulty}`;

      for (const key of Object.keys(emptyRewards()) as Array<
        keyof WorldBossRewards
      >) {
        expect(
          higher.firstClear[key],
          `${label} firstClear.${key}`,
        ).toBeGreaterThanOrEqual(lower.firstClear[key]);
      }

      // Compare the farm at its floor, which is the honest comparison — a
      // wider range with a lower minimum is not an upgrade.
      const lowFarm = rollFarmableRewards(lower.difficulty, () => 0);
      const highFarm = rollFarmableRewards(higher.difficulty, () => 0);
      for (const key of Object.keys(emptyRewards()) as Array<
        keyof WorldBossRewards
      >) {
        expect(highFarm[key], `${label} farm.${key}`).toBeGreaterThanOrEqual(
          lowFarm[key],
        );
      }
    }
  });

  it("never puts summon currency in ANY tier's farm", () => {
    // Ruling #80 has to survive tier authoring, not just tier 1.
    for (const tier of MOLVARR_TIERS) {
      for (const r of [0, 0.5, 0.999999]) {
        const farm = rollFarmableRewards(tier.difficulty, () => r);
        expect(farm.gems, `tier ${tier.difficulty}`).toBe(0);
        expect(farm.permanentTicket, `tier ${tier.difficulty}`).toBe(0);
      }
    }
  });

  it("pays a tier's own bundle, unscaled by anything", () => {
    // "first clear doesn't need to scale with world level" — each bundle is
    // authored at the value it should pay, so this is an identity check.
    for (const tier of MOLVARR_TIERS) {
      const first = rollWorldBossRewards(() => 0.5, {
        firstClear: true,
        difficulty: tier.difficulty,
      });
      const farm = rollFarmableRewards(tier.difficulty, () => 0.5);
      expect(first).toEqual(addRewards(tier.firstClear, farm));
    }
  });

  it("clamps an out-of-range difficulty to a real tier", () => {
    expect(getBossTier(0).difficulty).toBe(1);
    expect(getBossTier(99).difficulty).toBe(MAX_WORLD_LEVEL);
  });

  it("keys a clear per tier so one clear can't unlock another", () => {
    expect(tierKey("molvarr", 1)).toBe("molvarr@1");
    expect(tierKey("molvarr", 4)).toBe("molvarr@4");
    expect(tierKey("molvarr", 1)).not.toBe(tierKey("molvarr", 4));
  });

  it("only offers tiers the account's world level allows", () => {
    expect(attemptableTiers(1).map((t) => t.difficulty)).toEqual([1]);
    expect(attemptableTiers(3).map((t) => t.difficulty)).toEqual([1, 2, 3]);
    expect(attemptableTiers(99)).toHaveLength(MAX_WORLD_LEVEL);
  });
});

import { describe, expect, it } from "vitest";
import {
  BASE_CORRODED_SEAWEED,
  BASE_SEA_MONSTER_EYE,
  rollWorldBossRewards,
} from "@/lib/game/worldBossRewards";
import { ASCENSION_COSTS } from "@/lib/game/ascension";

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

  it("grants training_manual minimum (3) when rng is 0", () => {
    const result = rollWorldBossRewards(() => 0);
    expect(result.training_manual).toBe(3);
  });

  it("grants training_manual maximum (6) when rng is just under 1", () => {
    const result = rollWorldBossRewards(() => 0.999999);
    expect(result.training_manual).toBe(6);
  });

  it("grants coin minimum (2000) when rng is 0", () => {
    const result = rollWorldBossRewards(() => 0);
    expect(result.coin).toBe(2000);
  });

  it("grants coin maximum (10000) when rng is just under 1", () => {
    const result = rollWorldBossRewards(() => 0.999999);
    expect(result.coin).toBe(10000);
  });

  it("grants gems minimum (20) when rng is 0", () => {
    const result = rollWorldBossRewards(() => 0);
    expect(result.gems).toBe(20);
  });

  it("grants gems maximum (50) when rng is just under 1", () => {
    const result = rollWorldBossRewards(() => 0.999999);
    expect(result.gems).toBe(50);
  });

  it("grants permanentTicket minimum (1) when rng is 0", () => {
    const result = rollWorldBossRewards(() => 0);
    expect(result.permanentTicket).toBe(1);
  });

  it("grants permanentTicket maximum (3) when rng is just under 1", () => {
    const result = rollWorldBossRewards(() => 0.999999);
    expect(result.permanentTicket).toBe(3);
  });
});

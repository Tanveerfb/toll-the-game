import { describe, expect, it } from "vitest";
import { rollWorldBossRewards } from "@/lib/game/worldBossRewards";

describe("rollWorldBossRewards", () => {
  it("grants the base amounts with no bonus when the rng always misses the 10% roll", () => {
    const result = rollWorldBossRewards(() => 0.99);
    expect(result.sea_monster_eye).toBe(1);
    expect(result.corroded_seaweed).toBe(2);
  });

  it("grants the +1 bonus on both rolls when the rng always hits the 10% threshold", () => {
    const result = rollWorldBossRewards(() => 0);
    expect(result.sea_monster_eye).toBe(2);
    expect(result.corroded_seaweed).toBe(3);
  });

  it("does not grant bonus at exactly the 10% threshold (uses < not <=)", () => {
    const result = rollWorldBossRewards(() => 0.1);
    expect(result.sea_monster_eye).toBe(1);
    expect(result.corroded_seaweed).toBe(2);
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

import { describe, expect, it } from "vitest";
import { getCurrentStamina, spendStamina, STAMINA_CAP, STAMINA_REGEN_MS } from "@/lib/game/stamina";

describe("getCurrentStamina", () => {
  it("returns the stored value unchanged when no time has passed", () => {
    const now = 1_000_000;
    expect(getCurrentStamina({ current: 50, updatedAt: now }, now)).toBe(50);
  });

  it("regenerates +1 per full 5-minute tick elapsed", () => {
    const now = 1_000_000;
    const updatedAt = now - STAMINA_REGEN_MS * 3 - 1000; // 3 full ticks + partial
    expect(getCurrentStamina({ current: 50, updatedAt }, now)).toBe(53);
  });

  it("does not round up a partial tick", () => {
    const now = 1_000_000;
    const updatedAt = now - STAMINA_REGEN_MS + 1000; // just under one tick
    expect(getCurrentStamina({ current: 50, updatedAt }, now)).toBe(50);
  });

  it("clamps at the cap even after a long offline period", () => {
    const now = 1_000_000;
    const updatedAt = now - STAMINA_REGEN_MS * 1000;
    expect(getCurrentStamina({ current: 100, updatedAt }, now)).toBe(STAMINA_CAP);
  });

  it("clamps to 0 when clock skew makes result negative", () => {
    const now = 1_000_000;
    const updatedAt = now + STAMINA_REGEN_MS * 10; // clock went backwards by 10 ticks
    // stored.current (1) - 10 ticks of regen = 1 - 10 = -9, clamped to 0
    expect(getCurrentStamina({ current: 1, updatedAt }, now)).toBe(0);
  });
});

describe("spendStamina", () => {
  it("succeeds and deducts when enough stamina is available", () => {
    const now = 1_000_000;
    const result = spendStamina({ current: 50, updatedAt: now }, 40, now);
    expect(result).toEqual({ ok: true, next: { current: 10, updatedAt: now } });
  });

  it("accounts for regen before checking affordability", () => {
    const now = 1_000_000;
    const updatedAt = now - STAMINA_REGEN_MS * 5; // +5 stamina regenerated
    const result = spendStamina({ current: 36, updatedAt }, 40, now);
    expect(result).toEqual({ ok: true, next: { current: 1, updatedAt: now } });
  });

  it("refuses when stamina (after regen) is below the amount", () => {
    const now = 1_000_000;
    const result = spendStamina({ current: 10, updatedAt: now }, 40, now);
    expect(result).toEqual({ ok: false });
  });

  it("succeeds on an exact-amount spend, leaving 0", () => {
    const now = 1_000_000;
    const result = spendStamina({ current: 40, updatedAt: now }, 40, now);
    expect(result).toEqual({ ok: true, next: { current: 0, updatedAt: now } });
  });

  it("refuses when amount is zero or negative", () => {
    const now = 1_000_000;
    const result0 = spendStamina({ current: 100, updatedAt: now }, 0, now);
    const resultNeg = spendStamina({ current: 100, updatedAt: now }, -5, now);
    expect(result0).toEqual({ ok: false });
    expect(resultNeg).toEqual({ ok: false });
  });
});

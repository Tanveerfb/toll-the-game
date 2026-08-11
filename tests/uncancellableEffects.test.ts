import { describe, expect, it } from "vitest";
import { categorizeEffects } from "@/components/game/battle/EffectsList";
import { useSettingsStore } from "@/store/settingsStore";
import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";

/**
 * Grey "effect" entries are the uncancellable ones (ruling #30). Nothing about
 * them is actionable, and they crowded out the buffs and debuffs that inform a
 * decision — so they're hidden until asked for (Tanveer, 2026-08-11).
 */

const effect = (over: Partial<StatusEffect>): StatusEffect =>
  ({ type: "buff", ...over }) as StatusEffect;

function unitWith(
  buffs: StatusEffect[],
  debuffs: StatusEffect[],
): BattleCharacter {
  return { buffs, debuffs } as BattleCharacter;
}

/** What the detail panel and the itemized list both apply. */
const visible = (unit: BattleCharacter) =>
  categorizeEffects(unit).filter((r) => r.category !== "effect");

describe("uncancellable effects are hidden by default", () => {
  it("defaults the preference to off", () => {
    expect(useSettingsStore.getState().showUncancellableEffects).toBe(false);
  });

  it("keeps buffs and debuffs, drops the uncancellable ones", () => {
    const unit = unitWith(
      [effect({ type: "buff" }), effect({ type: "taunt", uncancellable: true })],
      [
        effect({ type: "stun" }),
        effect({ type: "corrosion", uncancellable: true }),
      ],
    );
    expect(categorizeEffects(unit)).toHaveLength(4);
    expect(visible(unit).map((r) => r.effect.type)).toEqual(["buff", "stun"]);
  });

  it("hides an uncancellable entry regardless of which list it sits in", () => {
    // Ruling #30: the grey category is defined by `uncancellable`, not by
    // whether the entry lives in buffs or debuffs.
    const unit = unitWith(
      [effect({ type: "buff", uncancellable: true })],
      [effect({ type: "seal", uncancellable: true })],
    );
    expect(visible(unit)).toEqual([]);
  });

  it("leaves a unit with only cancellable effects untouched", () => {
    const unit = unitWith([effect({ type: "buff" })], [effect({ type: "stun" })]);
    expect(visible(unit)).toHaveLength(2);
  });

  it("reports how many were hidden, so the panel can offer the reveal", () => {
    const unit = unitWith(
      [effect({ type: "buff" })],
      [
        effect({ type: "corrosion", uncancellable: true }),
        effect({ type: "decay", uncancellable: true }),
      ],
    );
    const all = categorizeEffects(unit);
    expect(all.length - visible(unit).length).toBe(2);
  });
});

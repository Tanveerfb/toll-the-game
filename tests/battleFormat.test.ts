import { describe, expect, it } from "vitest";
import { applyFieldCap, fieldCount, FIELD_CAP, TEAM_CAP } from "@/lib/game/format";
import { ensureFieldUnit } from "@/lib/game/sub";

/**
 * "All battles are meant to be 3 + 1 sub vs enemy, not 4 vs enemy like we have
 * been playing" (Tanveer, 2026-08-11), confirmed to constrain BOTH sides by
 * default.
 *
 * The rule previously lived inside the practice sandbox component, so story
 * and world-boss battles — which never went through it — fielded four. These
 * tests pin it at the layer that can't be bypassed.
 */
/** Shaped like a real `TeamPick`, `isSub` included — a fixture without it is a
 *  weak type and won't satisfy the helpers' constraint. */
const picks = (n: number): Array<{ id: string; isSub?: boolean }> =>
  Array.from({ length: n }, (_, i) => ({ id: `u${i + 1}` }));

describe("applyFieldCap", () => {
  it("benches the fourth unit of a full team", () => {
    const capped = applyFieldCap(picks(TEAM_CAP));
    expect(capped.map((p) => p.isSub === true)).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it("leaves a team at or under the cap entirely on the field", () => {
    for (const n of [1, 2, FIELD_CAP]) {
      expect(fieldCount(picks(n))).toBe(n);
    }
  });

  it("caps the enemy side identically — the half that changed", () => {
    // Solo encounters (Molvarr, NPC Lyra) are unaffected; a 4-enemy fight is.
    expect(fieldCount(picks(4))).toBe(FIELD_CAP);
  });

  it("preserves order, so slot four is the bench", () => {
    const capped = applyFieldCap(picks(4));
    expect(capped.map((p) => p.id)).toEqual(["u1", "u2", "u3", "u4"]);
    expect(capped[3].isSub).toBe(true);
  });

  it("honours a pick that already declared itself a sub", () => {
    // An authored encounter that deliberately benches its second unit is not
    // overruled by position.
    const authored = [
      { id: "a" },
      { id: "b", isSub: true },
      { id: "c" },
      { id: "d" },
    ];
    const capped = applyFieldCap(authored);
    expect(capped.map((p) => p.isSub === true)).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(fieldCount(authored)).toBe(3);
  });

  it("accepts an explicit override for the practice bench", () => {
    expect(fieldCount(picks(4), 4)).toBe(4);
    expect(fieldCount(picks(4), 1)).toBe(1);
  });

  it("never caps below one unit, whatever it is handed", () => {
    expect(fieldCount(picks(4), 0)).toBe(1);
    expect(fieldCount(picks(4), -3)).toBe(1);
  });

  it("returns an empty team untouched", () => {
    expect(applyFieldCap([])).toEqual([]);
  });
});

describe("applyFieldCap composed with ensureFieldUnit", () => {
  it("still guarantees somebody stands on the field", () => {
    // The two run back to back at battle start; an all-sub team must not
    // survive the pair with nobody able to act.
    const allBenched = [
      { id: "a", isSub: true },
      { id: "b", isSub: true },
    ];
    const result = ensureFieldUnit(applyFieldCap(allBenched));
    expect(result.filter((p) => p.isSub !== true)).toHaveLength(1);
  });

  it("leaves a normal four-unit team with three up and one benched", () => {
    const result = ensureFieldUnit(applyFieldCap(picks(4)));
    expect(result.filter((p) => p.isSub !== true)).toHaveLength(3);
    expect(result.filter((p) => p.isSub === true)).toHaveLength(1);
  });
});

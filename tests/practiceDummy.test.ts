import { describe, expect, it } from "vitest";
import {
  buildPracticeDummy,
  PRACTICE_DUMMY_HP,
  PRACTICE_DUMMY_ID,
} from "@/lib/game/damagePreview";

describe("buildPracticeDummy", () => {
  it("has a stable id matching PRACTICE_DUMMY_ID", () => {
    const dummy = buildPracticeDummy();
    expect(dummy.id).toBe(PRACTICE_DUMMY_ID);
  });

  it("carries exactly 2 skill cards, like every playable character", () => {
    const dummy = buildPracticeDummy();
    expect(dummy.skills).toHaveLength(2);
  });

  it("is hidden from the playable roster (storyOnly)", () => {
    const dummy = buildPracticeDummy();
    expect(dummy.storyOnly).toBe(true);
  });

  it("has an absurd HP pool so a Preview session never ends early", () => {
    const dummy = buildPracticeDummy();
    // Preview exists to try a kit's full rank ladder and ultimate; a dummy
    // that dies cuts that short. Must stay far above the biggest single hit
    // in the roster (well under 10k), with headroom for future kits.
    expect(dummy.hp).toBe(PRACTICE_DUMMY_HP);
    expect(dummy.hp).toBeGreaterThanOrEqual(100_000);
  });

  it("returns a fresh object each call (no shared mutable state)", () => {
    const a = buildPracticeDummy();
    const b = buildPracticeDummy();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

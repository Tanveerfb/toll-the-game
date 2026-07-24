import { describe, expect, it } from "vitest";
import {
  buildPracticeDummy,
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

  it("has a low HP pool so a Preview battle resolves quickly", () => {
    const dummy = buildPracticeDummy();
    // Well under any real playable character's HP (the roster runs ~1800-2800).
    expect(dummy.hp).toBeLessThan(600);
    expect(dummy.hp).toBeGreaterThan(0);
  });

  it("returns a fresh object each call (no shared mutable state)", () => {
    const a = buildPracticeDummy();
    const b = buildPracticeDummy();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

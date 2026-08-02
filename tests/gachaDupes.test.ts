import { describe, expect, it } from "vitest";
import { resolvePullResult } from "@/lib/gacha/dupes";

describe("resolvePullResult", () => {
  it("a character not in the roster is new, starting at ultLevel 1", () => {
    const result = resolvePullResult("sara", ["duke"], {});
    expect(result).toEqual({ isNew: true, ultLevel: 1 });
  });

  it("a character already in the roster is a dupe, incrementing ultLevel", () => {
    const result = resolvePullResult("duke", ["duke"], { duke: { level: 5, ascension: 1, xp: 0, ultLevel: 2 } });
    expect(result).toEqual({ isNew: false, ultLevel: 3 });
  });

  it("a dupe on a character with no characters[] entry yet defaults from ultLevel 1", () => {
    const result = resolvePullResult("duke", ["duke"], {});
    expect(result).toEqual({ isNew: false, ultLevel: 2 });
  });

  it("caps ultLevel at 6 — a dupe past the cap is a no-op increment", () => {
    const result = resolvePullResult("duke", ["duke"], { duke: { level: 40, ascension: 3, xp: 0, ultLevel: 6 } });
    expect(result).toEqual({ isNew: false, ultLevel: 6 });
  });

  it("increments to exactly the cap on the last valid dupe (5 -> 6)", () => {
    const result = resolvePullResult("duke", ["duke"], { duke: { level: 40, ascension: 3, xp: 0, ultLevel: 5 } });
    expect(result).toEqual({ isNew: false, ultLevel: 6 });
  });
});

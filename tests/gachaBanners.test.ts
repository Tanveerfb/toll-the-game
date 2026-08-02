import { describe, expect, it } from "vitest";
import { getActiveLimitedBanner, getPermanentBanner } from "@/lib/gacha/banners";

describe("getActiveLimitedBanner", () => {
  it("returns the debut banner with 12 featured characters at 5% rate", () => {
    const banner = getActiveLimitedBanner();
    expect(banner.id).toBe("debut-2026-08");
    expect(banner.featured).toHaveLength(12);
    expect(banner.featured).toContain("duke");
    expect(banner.featured).toContain("isolde");
    expect(banner.rate).toBe(0.05);
  });
});

describe("getPermanentBanner", () => {
  it("returns an empty pool when no character has permanentPool set (current real data)", () => {
    const banner = getPermanentBanner();
    expect(banner.id).toBe("permanent");
    expect(Array.isArray(banner.featured)).toBe(true);
    expect(banner.featured).toEqual([]);
  });
});

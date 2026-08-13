import { describe, expect, it } from "vitest";
import { getGemBanner, getTicketBanner } from "@/lib/gacha/banners";

describe("getGemBanner", () => {
  it("returns the debut banner with 12 featured characters at 5% rate", () => {
    const banner = getGemBanner();
    expect(banner.id).toBe("debut-2026-08");
    expect(banner.featured).toHaveLength(12);
    expect(banner.featured).toContain("duke");
    expect(banner.featured).toContain("isolde");
    expect(banner.rate).toBe(0.05);
  });

  it("carries no end date — there are no limited banners", () => {
    // The beta roster shipped with an `endsAt` and advertised itself as
    // "Limited · ends <date>" for weeks. It was always meant to be permanent
    // (Tanveer, 2026-08-13). A reintroduced end date should fail here.
    expect(getGemBanner()).not.toHaveProperty("endsAt");
  });
});

describe("getTicketBanner", () => {
  it("returns an empty pool when no character has permanentPool set (current real data)", () => {
    const banner = getTicketBanner();
    expect(banner.id).toBe("permanent");
    expect(Array.isArray(banner.featured)).toBe(true);
    expect(banner.featured).toEqual([]);
  });
});

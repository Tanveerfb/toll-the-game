import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The ground tabs' hover colour (light text) must never reach the ACTIVE tab,
 * which is paper: on 2026-10-03 the events board's selected tab went white on
 * white while the pointer stayed over it, and a phone keeps hover after a tap.
 * Every screen with tabs uses this one primitive, so the rule is pinned here.
 */
describe("tabs primitive", () => {
  const src = readFileSync("components/ui/tabs.tsx", "utf8");

  it("lightens only inactive ground tabs on hover", () => {
    expect(src).toContain(
      "group-data-[variant=default]/tabs-list:data-[state=inactive]:hover:text-foreground",
    );
    expect(src).not.toMatch(/tabs-list:hover:text-foreground/);
  });
});

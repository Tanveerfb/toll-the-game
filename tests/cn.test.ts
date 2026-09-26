import { describe, expect, it } from "vitest";
import fs from "node:fs";

import { cn } from "@/lib/utils";
import { badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

/**
 * The type scale below `text-xs` is custom (`text-micro`, `text-label`,
 * `text-caption`; ruling #154). tailwind-merge took them for colours, so
 * merging one with a colour class dropped whichever came first. Found
 * 2026-09-26 the same day the scale landed: the secondary button (every nav
 * chip) lost its ink colour, and every badge lost its size.
 */
describe("cn keeps a custom size and a colour side by side", () => {
  it.each(["micro", "label", "caption"])("text-%s is a size", (step) => {
    expect(cn(`text-${step}`, "text-card-foreground")).toBe(
      `text-${step} text-card-foreground`,
    );
    expect(cn("text-card-foreground", `text-${step}`)).toBe(
      `text-card-foreground text-${step}`,
    );
  });

  it("still lets one size replace another", () => {
    expect(cn("text-caption", "text-sm")).toBe("text-sm");
  });

  it("the secondary button keeps its colour at the small sizes", () => {
    for (const size of ["xs", "sm"] as const) {
      const cls = cn(buttonVariants({ variant: "secondary", size }));
      expect(cls).toContain("text-secondary-foreground");
    }
  });

  it("a badge keeps its size under every variant", () => {
    const variants = ["default", "secondary", "destructive"] as const;
    for (const variant of variants) {
      expect(cn(badgeVariants({ variant }))).toContain("text-label");
    }
  });

  it("every custom step in @theme is registered with the merger", () => {
    const css = fs.readFileSync("styles/globals.css", "utf8");
    const steps = [...css.matchAll(/--text-([a-z]+):/g)].map((m) => m[1]);
    const utils = fs.readFileSync("lib/utils.ts", "utf8");
    for (const step of steps) expect(utils).toContain(`"${step}"`);
  });
});

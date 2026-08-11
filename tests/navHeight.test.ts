import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Full-height screens are sized against the nav, and the nav's height is not
 * a constant: it grew a resource row on 2026-08-11 that stands down during
 * battle. Six screens each carried their own copy of the old height as a magic
 * number (`h-[calc(100dvh-2.875rem)]`), so a nav that changed height would
 * have silently cut ~32px off the bottom of every one of them.
 *
 * The contract now: the nav declares its row count, CSS derives `--nav-h` from
 * that, and screens ask for `.screen-below-nav`. These tests hold the three
 * halves together — none of them can evaluate CSS, so they check structure.
 */
describe("nav height is declared once, not repeated", () => {
  const roots = ["app", "components"];

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith(".tsx") ? [full] : [];
    });
  }

  const files = roots
    .flatMap((r) => walk(path.join(process.cwd(), r)))
    .map((f) => path.relative(process.cwd(), f).split(path.sep).join("/"));

  it("no screen hardcodes the nav height any more", () => {
    // The exact string that used to appear six times. A new screen copying it
    // from an old one is the regression this catches.
    const offenders = files.filter((rel) =>
      /100dvh\s*-\s*[\d.]+rem/.test(fs.readFileSync(rel, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("the screens that fill the viewport use the shared class", () => {
    // If this drops to zero the class was renamed away and every full-height
    // screen is silently sizing itself to something else.
    const users = files.filter((rel) =>
      fs.readFileSync(rel, "utf8").includes("screen-below-nav"),
    );
    expect(users.length).toBeGreaterThanOrEqual(3);
  });

  it("globals.css defines the variable and the class that reads it", () => {
    const css = fs.readFileSync("styles/globals.css", "utf8");
    expect(css).toContain("--nav-h");
    expect(css).toContain(".screen-below-nav");
    expect(css).toContain("calc(100dvh - var(--nav-h))");
    // The two-row value has to be keyed off what the nav actually rendered,
    // or the variable and the markup drift apart.
    expect(css).toMatch(/:has\(\[data-nav-rows="2"\]\)/);
  });

  it("the nav publishes its row count for that selector to read", () => {
    const nav = fs.readFileSync("components/ui/TopNav.tsx", "utf8");
    expect(nav).toContain("data-nav-rows");
  });
});

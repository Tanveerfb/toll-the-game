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

  /**
   * A comment naming the class that was removed is not the class. `StoryStage`
   * explains at the usage site why it is *not* `min-h-dvh`, which a raw-text
   * scan reads as a violation.
   */
  function source(rel: string): string {
    return fs
      .readFileSync(rel, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  it("no screen hardcodes the nav height any more", () => {
    // The exact string that used to appear six times. A new screen copying it
    // from an old one is the regression this catches.
    const offenders = files.filter((rel) =>
      /100dvh\s*-\s*[\d.]+rem/.test(source(rel)),
    );
    expect(offenders).toEqual([]);
  });

  it("the screens that fill the viewport use the shared class", () => {
    // If this drops to zero the class was renamed away and every full-height
    // screen is silently sizing itself to something else.
    const users = files.filter((rel) =>
      source(rel).includes("screen-below-nav"),
    );
    // 2, not 3, since 2026-09-26: the error page moved onto `Screen`, which is
    // the point of `Screen`, so the direct users are `Screen` itself and the
    // login page's full-bleed column. Zero is still the failure this catches.
    expect(users.length).toBeGreaterThanOrEqual(2);
  });

  it("globals.css defines the variable and the class that reads it", () => {
    const css = fs.readFileSync("styles/globals.css", "utf8");
    expect(css).toContain("--nav-h");
    expect(css).toContain(".screen-below-nav");
    // Both bars, in one expression. `--tabbar-h` joined it on 2026-09-01 when
    // navigation moved to a bottom tab bar below `sm`; it is 0rem wherever
    // that bar does not render, so this is the same sum at every width.
    expect(css).toContain("calc(100dvh - var(--nav-h) - var(--tabbar-h))");
    expect(css).toContain("--tabbar-h");
    // The two-row value has to be keyed off what the nav actually rendered,
    // or the variable and the markup drift apart.
    expect(css).toMatch(/:has\(\[data-nav-rows="2"\]\)/);
  });

  /**
   * `min-h-dvh` on a `<main>` is the same magic number in a different costume.
   * That element starts at `--nav-h` and `body` pads `--tabbar-h` beneath it,
   * so a `100dvh` *floor* guarantees the document is both bars taller than the
   * viewport. Measured in a browser at 393x751 on 2026-09-01: eleven screens
   * scrolled 96px, every pixel of it empty.
   */
  it("no screen floors itself at a full viewport below the nav", () => {
    const offenders = files.filter((rel) =>
      /\bmin-h-(dvh|screen)\b/.test(source(rel)),
    );
    expect(offenders).toEqual([]);
  });

  /**
   * **Anchored on the owner, not on a file count, since 2026-09-26.** This
   * asserted `>= 8` files carried `min-screen-below-nav`, which was right while
   * every screen typed its own shell. Finishing the `Screen` migration took the
   * real count to 3 and failed it — for doing exactly what the layout system
   * exists to do. The same thing happened to `viewportUnits.test.ts`.
   *
   * A count cannot express the intent any more. The intent is *"the ban above
   * is not passing because nothing sizes to the viewport"*, and post-migration
   * the thing that must size to the viewport is **`Screen`**. Asserting that
   * directly is strictly stronger than a floor: deleting the class from the one
   * file that matters now fails, where a count of 8 could be satisfied by any
   * eight files and stay green while `Screen` itself was gutted.
   */
  it("the shell primitive uses the shared min-height class", () => {
    expect(source("components/ui/Screen.tsx")).toContain(
      "min-screen-below-nav",
    );
    const css = fs.readFileSync("styles/globals.css", "utf8");
    expect(css).toContain(".min-screen-below-nav");
    expect(css).toContain(
      "min-height: calc(100dvh - var(--nav-h) - var(--tabbar-h))",
    );
  });

  it("the nav publishes its row count for that selector to read", () => {
    const nav = fs.readFileSync("components/ui/TopNav.tsx", "utf8");
    expect(nav).toContain("data-nav-rows");
  });
});

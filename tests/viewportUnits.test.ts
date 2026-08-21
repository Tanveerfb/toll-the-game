import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Ruling #107: `dvh`, never `vh`.
 *
 * Verified against the installed toolchain on 2026-08-19 rather than taken on
 * trust — Tailwind 4.3.2 compiles `min-h-screen` to `min-height: 100vh` and
 * `h-screen` to `height: 100vh`, while `min-h-dvh` gives `100dvh`. `100vh` is
 * the *largest* viewport, so on a phone with browser chrome showing, a
 * `min-h-screen` page shell is taller than what the player can see. The body
 * already sets `min-height: 100dvh` (`styles/globals.css`), so every such
 * screen carried a dead scroll exactly the height of the browser chrome.
 *
 * Fifteen occurrences across eleven files were swapped to `min-h-dvh` the day
 * this test was written. It exists so the next screen can't reintroduce one by
 * copying an older file — which is how all fifteen got there.
 */
describe("viewport units are dynamic (ruling #107)", () => {
  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")
        ? [full]
        : [];
    });
  }

  const files = ["app", "components", "hooks"]
    .flatMap((r) => walk(path.join(process.cwd(), r)))
    .map((f) => path.relative(process.cwd(), f).split(path.sep).join("/"));

  /**
   * Comments are stripped first: `StoryStage.tsx` explains this very rule in
   * prose, and a test that punished a file for documenting the rule it obeys
   * would teach the wrong lesson.
   */
  function code(rel: string): string {
    return fs
      .readFileSync(rel, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
  }

  it("no component sizes itself with the static viewport", () => {
    const offenders = files.filter((rel) =>
      /\b(min-)?h-screen\b|\b100vh\b/.test(code(rel)),
    );
    expect(offenders).toEqual([]);
  });

  /**
   * The check above only ever matched `100vh` and `h-screen`, and that is
   * exactly how `ModalShell`'s `max-h-[80vh]` and `DetailOverlay`'s
   * `max-h-[85vh]` survived the 2026-08-19 sweep — a static viewport unit
   * inside an arbitrary-value class, in the two shells that sit behind every
   * modal and every battle detail panel. Any `vh` in a *height* is the bug;
   * `vw` and `vmin` are untouched, and a width like `max-w-[92vw]` is fine.
   */
  it("no height is measured in static vh, in any form", () => {
    const offenders = files
      .map((rel) => [rel, code(rel)] as const)
      .filter(([, src]) => /\b(min-|max-)?h-\[[^\]]*\d(?:\.\d+)?vh\b/.test(src))
      .map(([rel]) => rel);
    expect(offenders).toEqual([]);
  });

  it("the dynamic units are actually in use, so this isn't passing by absence", () => {
    const users = files.filter((rel) => /\b(min-)?h-dvh\b/.test(code(rel)));
    expect(users.length).toBeGreaterThanOrEqual(10);
  });

  it("globals.css sizes the body dynamically too", () => {
    const css = fs.readFileSync("styles/globals.css", "utf8");
    expect(css).toContain("min-height: 100dvh");
    expect(css).not.toMatch(/min-height:\s*100vh/);
  });
});

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The layout primitives, and a ratchet that stops them being bypassed.
 *
 * Measured 2026-09-17 (`Plans/2026-09-17-layout-system.md`): **eight spellings
 * of three page shells** and **ten content widths with no rule for choosing
 * one**. Two of those eight shells were the *same CSS in a different word
 * order* — nothing catches that by eye, and nothing ever will.
 *
 * `components/ui/Screen.tsx` and `components/ui/Panel.tsx` now own those. The
 * tests below are deliberately of two kinds:
 *
 * - **Absolute** — the tokens exist and the primitives use them. These never
 *   need touching.
 * - **A ratchet** — how many files still hand-type a shell. It may only go
 *   down. A migration lowers the number in the same commit; a new screen that
 *   hand-types one pushes it up and fails.
 */

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

const files = ["app", "components"]
  .flatMap((root) => walk(path.join(process.cwd(), root)))
  .map((f) => path.relative(process.cwd(), f).split(path.sep).join("/"));

const read = (rel: string) => fs.readFileSync(rel, "utf8");

describe("content widths are three named tokens, not ten numbers", () => {
  const css = read("styles/globals.css");

  it("the three tokens are declared", () => {
    // `--container-*` is Tailwind 4's namespace for `max-w-*`, so declaring
    // them here is what makes `max-w-app` a real utility rather than a class
    // that silently resolves to nothing.
    expect(css).toContain("--container-read:");
    expect(css).toContain("--container-app:");
    expect(css).toContain("--container-panel:");
  });

  it("Screen is what maps a content kind onto them", () => {
    const src = read("components/ui/Screen.tsx");
    for (const width of ["max-w-read", "max-w-app", "max-w-panel"]) {
      expect(src).toContain(width);
    }
  });
});

describe("the page shell comes from Screen", () => {
  it("Screen carries all three shapes", () => {
    const src = read("components/ui/Screen.tsx");
    // `screen-below-nav` is an exact height and `min-screen-below-nav` a
    // floor; the battle shape needs the first so the page itself never
    // scrolls. Losing either collapses three shapes into two.
    expect(src).toContain("min-screen-below-nav");
    expect(src).toMatch(/[^-]screen-below-nav/);
  });

  it("uses dvh through the shared classes, never a raw vh", () => {
    // `tests/viewportUnits.test.ts` owns this repo-wide. Restated here only
    // for the primitive every screen will inherit from, because a `vh` that
    // lands in THIS file lands in every screen at once.
    expect(read("components/ui/Screen.tsx")).not.toMatch(/\d+vh\b/);
  });

  /**
   * The ratchet.
   *
   * `terminal-grid` is the marker of a hand-typed page shell. Eleven files
   * carry one: ten unmigrated screens plus `Screen` itself, which is where the
   * class is now allowed to be written down. It started at thirteen; the news
   * index and post layout came off it on 2026-09-17. **This number may only go
   * down, and a migration lowers it in the same commit.**
   *
   * **Falsified before being trusted** (`AGENTS.md`): re-typing the shell back
   * into `app/events/page.tsx` pushes the count to 12 and fails this.
   */
  it("no new screen hand-types the shell", () => {
    expect(files.length).toBeGreaterThan(40);
    const handTyped = files.filter((rel) => read(rel).includes("terminal-grid"));
    const allowed = 11; // 2026-09-17: 10 unmigrated screens + Screen itself.
    expect(
      handTyped.length,
      `Hand-typed page shells: ${handTyped.join(", ")}. ` +
        `Use <Screen variant=… width=…> from components/ui/Screen, or lower ` +
        `this number in the same commit as a migration.`,
    ).toBeLessThanOrEqual(allowed);
  });
});

describe("the events screen is decomposed, not a monolith", () => {
  /**
   * Audit finding M1: `app/events/page.tsx` was **1,289 lines** holding eleven
   * view branches, every store subscription and every piece of markup at once.
   * It is now the state machine only.
   *
   * A line count is a crude proxy, and it is used deliberately: the failure
   * this guards against is the file quietly growing markup back, and that is
   * exactly what a line count notices.
   */
  it("the page stays a state machine", () => {
    const lines = read("app/events/page.tsx").split("\n").length;
    expect(
      lines,
      "app/events/page.tsx is growing markup again — the view branches belong " +
        "in components/game/events/.",
    ).toBeLessThan(600);
  });

  it("reward rows have one implementation", () => {
    // They had two: three builders inside the events page and a separate
    // `RewardRows` in `StageBrief.tsx`, so a new reward type had to be added
    // twice (audit finding C6).
    expect(fs.existsSync("lib/game/worldBossPreview.ts")).toBe(true);
    expect(read("app/events/page.tsx")).not.toContain("function rewardRows");
  });
});

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
   * **The count reached zero on 2026-09-26, and the measure changed with it.**
   *
   * It used to be `read(rel).includes("terminal-grid")`, allowing 11. That
   * over-counted, and finishing the migration is what exposed it: of the four
   * files still matching, **three are not hand-typed shells at all** —
   * `StoryBackdrop` paints `terminal-grid` on a decorative `absolute inset-0`
   * div (the texture, not a shell, and it can never be migrated), while
   * `practice` and `StoryStage` only mention the class in a *comment*. A
   * substring search over the whole file cannot tell a shell from prose about
   * one, so the old allowance of 11 was partly budget for its own noise.
   *
   * The signature of the real defect is narrower: a `className` that pairs the
   * grid texture with a **shell height** — `screen-below-nav` or
   * `min-screen-below-nav`. Nothing but a page shell does that. `Screen` is
   * exempt because it is where the pairing is now allowed to be written down.
   *
   * **Allowed is 0, so this is no longer a ratchet with slack in it** — any
   * screen that hand-types a shell fails immediately.
   *
   * **Falsified before being trusted** (`AGENTS.md`): pasting
   * `<main className="terminal-grid min-screen-below-nav bg-void">` back into
   * `app/archive/page.tsx` fails this with that file named; changing the same
   * file's *comment* to mention `terminal-grid` does not, which is the
   * distinction the old measure could not draw.
   */
  it("no screen hand-types the shell", () => {
    expect(files.length).toBeGreaterThan(40);
    // Per *string literal*, not per file. A class list is one literal, so both
    // markers landing inside the same one is the shell; prose about the shell
    // lives in comments, which are not string literals, and the decorative use
    // is a literal carrying only `terminal-grid`. A ternary that picks between
    // two shell strings is caught because each branch is its own literal.
    const LITERAL = /"[^"\n]*"/g;
    const handTyped = files.filter((rel) => {
      if (rel === "components/ui/Screen.tsx") return false;
      // Either ground: Combat Terminal's grid, or Shōnen Ink's halftone
      // (ruling #154). Checking only the old one would have gone blind the
      // day `Screen` switched, which is exactly when a copy is likeliest.
      return (read(rel).match(LITERAL) ?? []).some(
        (s) =>
          (s.includes("terminal-grid") || s.includes("ground-halftone")) &&
          s.includes("screen-below-nav"),
      );
    });
    expect(
      handTyped.length,
      `Hand-typed page shells: ${handTyped.join(", ")}. ` +
        `Use <Screen variant=… width=…> from components/ui/Screen.`,
    ).toBe(0);
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

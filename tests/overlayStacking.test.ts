import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * `position: fixed` is only viewport-relative while no ancestor establishes a
 * containing block for it. `position: sticky` always creates a stacking
 * context, and transforms, filters, `backdrop-filter` and `will-change` all
 * create containing blocks — so a modal that renders in place is one layout
 * change away from being trapped behind the page.
 *
 * That is exactly what happened: the archive detail page put its identity rail
 * on `lg:sticky`, and the Growth modal — mounted inside that rail — rendered
 * behind the kit document (Tanveer, 2026-08-11). Nothing failed; it just
 * looked broken.
 *
 * These tests can't evaluate CSS, so they enforce the rule structurally: a
 * component that paints a full-viewport overlay either portals out of the tree
 * or is listed below with the reason it's safe where it sits. Adding a new
 * overlay fails here until someone makes that call deliberately.
 */
describe("full-viewport overlays escape their stacking context", () => {
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

  /** A hand-built full-viewport overlay: `fixed inset-0` in a className. */
  const HAND_BUILT = /className=(?:"|\{`)[^"`]*\bfixed inset-0\b/;

  it("the detector still recognises a hand-built overlay", () => {
    // Without this the ban below passes vacuously the day the regex breaks.
    expect(HAND_BUILT.test('<div className="fixed inset-0 z-50 bg-black">')).toBe(true);
    expect(HAND_BUILT.test("<div className={`fixed inset-0 ${x}`}>")).toBe(true);
    expect(HAND_BUILT.test('<div className="absolute inset-0">')).toBe(false);
  });

  /**
   * **Every modal is the shadcn `Dialog` or `Sheet` since 2026-09-27**, and
   * radix portals both to `document.body` — so no screen can trap one again.
   *
   * This test used to count hand-built overlays (8, then 6, then 4) and
   * require each to call `createPortal` or be listed as safe where it sat. The
   * Shōnen Ink pass (ruling #154) moved them onto the primitives one screen at
   * a time; the battle's (#156: the unit panel, the log drawer, the controls
   * sheet, the result and the confirms) were the last, and `DetailOverlay`
   * was deleted with its last caller. So the rule is now the whole of it: a
   * full-viewport overlay outside `components/ui` is a hand-rolled modal, and
   * #154 says there are none.
   */
  it("no screen hand-builds a full-viewport overlay", () => {
    const offenders = files.filter(
      (rel) =>
        !rel.startsWith("components/ui/") &&
        HAND_BUILT.test(fs.readFileSync(rel, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("the Dialog and Sheet primitives portal", () => {
    // The guarantee every modal now leans on. The battle shake
    // (`battle-shake-strong`) transforms the arena, and a transform is a
    // containing block: an overlay rendered in place would be scoped to the
    // arena for the length of the shake.
    for (const rel of ["components/ui/dialog.tsx", "components/ui/sheet.tsx"]) {
      const src = fs.readFileSync(rel, "utf8");
      expect(src, rel).toMatch(/<(?:Dialog|Sheet)Portal>/);
    }
  });

  it("the battle's panels are built on them", () => {
    // Named, because these are the two the shake would trap, and the two that
    // were hand-built portals until 2026-09-27.
    expect(
      fs.readFileSync("components/game/battle/UnitDetailPanel.tsx", "utf8"),
    ).toContain('from "@/components/ui/dialog"');
    expect(
      fs.readFileSync("components/game/battle/BattleLogDrawer.tsx", "utf8"),
    ).toContain('from "@/components/ui/sheet"');
  });

  /**
   * A second stacking failure, from the other direction: not an overlay trapped
   * *behind* the page, but a page's own pinned action bar buried *under* the
   * bottom tab bar.
   *
   * The tab bar (ruling #123) is `fixed inset-x-0 bottom-0 z-50`. `TeamSelect`
   * pinned START at `bottom-0 z-40` and `StageBrief` its launch bar at
   * `bottom-0 z-20`, so from the day the tab bar shipped both were covered
   * outright — `elementFromPoint` at the centre of "Start battle" returned the
   * Gacha tab, and a tap navigated away instead of starting the fight. Practice
   * and the world boss were unstartable on a phone.
   *
   * Nothing failed and nothing looked broken; the bar was simply not there.
   * So the rule is structural: anything pinned to the bottom edge clears the
   * bar by composing through `--tabbar-h`, which is `0rem` wherever the bar
   * does not render. Found in a browser 2026-09-01.
   */
  it("nothing pins itself under the bottom tab bar", () => {
    const offenders: string[] = [];
    for (const rel of files) {
      const src = fs.readFileSync(rel, "utf8");
      for (const match of src.matchAll(/className="[^"]*\bfixed\b[^"]*"/g)) {
        const cls = match[0];
        if (!/\bbottom-0\b/.test(cls)) continue;
        // The tab bar itself is the thing being cleared.
        if (cls.includes("app-tabbar")) continue;
        // A full-viewport overlay pins all four edges; it is not a bottom bar,
        // and it sits above the tab bar by z-index on purpose.
        if (/\binset-0\b/.test(cls)) continue;
        const line = src.slice(0, match.index).split("\n").length;
        offenders.push(rel + ":" + line);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the bar that was buried now composes through the variable", () => {
    // Named explicitly: a generic scan passes just as well when a file is
    // deleted. There were two; `StageBrief` went with story mode on
    // 2026-09-26.
    for (const rel of ["components/game/TeamSelect.tsx"]) {
      const src = fs.readFileSync(rel, "utf8");
      expect(src, rel).toContain("bottom-[var(--tabbar-h)]");
    }
  });

  it("keeps the archive detail rail sticky, the layout that exposed this", () => {
    const src = fs.readFileSync("app/archive/character/[cardNumber]/page.tsx", "utf8");
    expect(src).toContain("lg:sticky");
    expect(src).toContain("CharacterProgressionPanel");
  });
});

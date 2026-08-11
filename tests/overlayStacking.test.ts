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

  /** Overlays that legitimately render in place, and why. */
  const ROOTED: Record<string, string> = {
    "components/gacha/ModalShell.tsx":
      "Mounted at the gacha page root — no sticky/transformed ancestor.",
    "components/gacha/PullReveal.tsx":
      "Mounted at the gacha page root — no sticky/transformed ancestor.",
    "components/game/battle/BattleLogDrawer.tsx":
      "Child of BattleArena, which deliberately carries no z-index on its wrapper. NOTE: the arena does take a transform while `battle-shake-strong` runs, which scopes this drawer to the arena for ~0.4s. Harmless today because the arena is near-viewport-sized; portal it if that stops being true.",
    "components/game/BattleArena.tsx":
      "The arena's own result/confirm modals; the arena wrapper is plain `relative`.",
  };

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

  const overlays = files.filter((rel) =>
    /className=(?:"|\{`)[^"`]*\bfixed inset-0\b/.test(
      fs.readFileSync(rel, "utf8"),
    ),
  );

  it("finds the overlays it is meant to be guarding", () => {
    // A regex that silently stops matching would make every assertion below
    // vacuously pass.
    // Dropped from 8 to 6 on 2026-08-11 when OwnedTeamSelect was deleted and
    // TeamSelect's hand-rolled roster overlay moved onto DetailOverlay, which
    // portals. A FALL below this floor is the signal worth catching — either
    // the regex broke, or an overlay quietly stopped being one.
    expect(overlays.length).toBeGreaterThanOrEqual(6);
  });

  it("either portals or is a documented root-level overlay", () => {
    const unaccounted = overlays.filter((rel) => {
      if (rel in ROOTED) return false;
      return !fs.readFileSync(rel, "utf8").includes("createPortal");
    });
    expect(unaccounted).toEqual([]);
  });

  it("portals the unit info panel, which the battle shake would otherwise trap", () => {
    // `BattleArena` puts `battle-shake-strong` on its wrapper during heavy
    // hits; an active transform creates a containing block, which would scope
    // this fixed overlay to the arena mid-animation.
    const src = fs.readFileSync(
      "components/game/battle/UnitDetailPanel.tsx",
      "utf8",
    );
    expect(src).toContain("createPortal");
    expect(src).toContain("document.body");
  });

  it("portals the shared DetailOverlay into document.body", () => {
    // The one overlay with no fixed home in the tree — callers mount it
    // wherever the feature lives, so it can never rely on its surroundings.
    const src = fs.readFileSync("components/game/DetailOverlay.tsx", "utf8");
    expect(src).toContain("createPortal");
    expect(src).toContain("document.body");
  });

  it("keeps the archive detail rail sticky, the layout that exposed this", () => {
    const src = fs.readFileSync("app/archive/[id]/page.tsx", "utf8");
    expect(src).toContain("lg:sticky");
    expect(src).toContain("CharacterProgressionPanel");
  });
});

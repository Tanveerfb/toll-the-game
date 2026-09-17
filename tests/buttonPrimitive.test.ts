import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * An action button comes from the primitive, not from a className.
 *
 * `components/ui/button.tsx` was rethemed on 2026-08-13 so that its variants
 * **are** the game's look — the comment there says a usage should only need a
 * className "when it wants something the variant genuinely can't know". Screens
 * went on hand-rolling `<button>` anyway: the 2026-09-17 audit found the same
 * primary action written **seven different ways**, disagreeing on opacity
 * (`bg-signal/10` vs `/12`), letter-spacing (`0.14em` vs `0.16em` vs `0.18em`),
 * padding, and **whether hover and disabled states existed at all**. Only 15
 * files used the primitive; 36 hand-rolled.
 *
 * A hand-rolled button with no `disabled:` styling looks enabled while doing
 * nothing, which is a QOL fault as much as a consistency one — and none of it
 * is catchable by eye in review.
 *
 * **What this forbids:** a raw `<button>` dressed as an action — uppercase text
 * with letter-spacing. That is the shape the primitive owns.
 *
 * **What it deliberately allows**, because these are surfaces that happen to be
 * clickable rather than actions, and the primitive's padding and inline-flex
 * would fight them: cards, unit tiles, portraits, icon-only controls. 71 of the
 * 99 buttons audited were these.
 */

const ROOTS = [join(process.cwd(), "app"), join(process.cwd(), "components")];

/**
 * Not yet migrated, and each for a stated reason. This list may shrink; an
 * entry added to it needs a reason in the same commit.
 */
const ALLOWED = new Set<string>([
  // The battle HUD's density is deliberately tuned (`AGENTS.md`: "Arena
  // spacing between team rows is deliberate — don't compact it"), and the
  // primitive's padding would change it. Migrating needs eyes on the screen.
  "components/game/BattleArena.tsx",
  "components/game/battle/BattleCoach.tsx",
  "components/game/battle/BattleLogDrawer.tsx",
  "components/game/battle/EffectsList.tsx",
  // `chamfer` buttons carry their own focus treatment from globals.css, which
  // is unlayered specifically so it beats the primitive's ring. Migrating them
  // means deciding what wins; not a mechanical change.
  "components/game/KitDetails.tsx",
  "components/game/TeamSelect.tsx",
  "components/game/PreviewButton.tsx",
]);

function tsxFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) tsxFiles(path, found);
    else if (entry.endsWith(".tsx")) found.push(path);
  }
  return found;
}

/** `<button …>` openings whose className reads as an action button. */
function handRolledActions(source: string): string[] {
  const hits: string[] = [];
  for (const match of source.matchAll(/<button\b[\s\S]*?>/g)) {
    const tag = match[0];
    const className = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(tag);
    if (!className) continue;
    const classes = `${className[1] ?? ""} ${className[2] ?? ""}`;
    if (classes.includes("uppercase") && classes.includes("tracking-")) {
      hits.push(tag.slice(0, 60).replace(/\s+/g, " "));
    }
  }
  return hits;
}

describe("action buttons come from the primitive", () => {
  const files = ROOTS.flatMap((root) => tsxFiles(root));

  it("finds the component tree at all", () => {
    // Guards the guard — a moved folder must not make this pass vacuously.
    expect(files.length).toBeGreaterThan(50);
  });

  for (const file of files) {
    const relative = file.slice(process.cwd().length + 1).replace(/\\/g, "/");
    if (ALLOWED.has(relative)) continue;
    // The primitive itself is where the look is allowed to be written down.
    if (relative.startsWith("components/ui/")) continue;

    const hits = handRolledActions(readFileSync(file, "utf8"));
    if (hits.length === 0) continue;

    it(`${relative} uses <Button> rather than a hand-rolled action button`, () => {
      expect(
        hits,
        `${relative} hand-rolls ${hits.length} uppercase action button(s). ` +
          `Use <Button variant=… size=…> from components/ui/button, or add the ` +
          `file to ALLOWED with a reason.`,
      ).toEqual([]);
    });
  }
});

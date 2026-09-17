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

  // ---------------------------------------------------------------------
  // Uncovered until 2026-09-17, when the arrow bug above was fixed.
  //
  // This guard had been flagging **nothing, repo-wide**, because its pattern
  // stopped at the `>` inside `onClick={() => ...}`. Fixing that surfaced 15
  // hand-rolled action buttons across these 12 files at once. They are listed
  // rather than migrated in the same commit because migrating them is real
  // work with visual consequences on screens Tanveer judges by eye — several
  // are `chamfer`, and two are in battle, whose density is explicitly his.
  //
  // **This block is debt and must shrink.** Nothing new belongs in it: a
  // button written today has no excuse, because the guard now sees it.
  "app/login/page.tsx",
  "components/gacha/BannerScreen.tsx",
  "components/gacha/MilestonePicker.tsx",
  "components/game/AccountModal.tsx",
  "components/game/CharacterBrowser.tsx",
  "components/game/CharacterProgressionPanel.tsx",
  "components/game/Deck.tsx",
  "components/game/KitPhases.tsx",
  "components/game/OrdersBoard.tsx",
  "components/game/SoundSettings.tsx",
  "components/game/SubstatDrawer.tsx",
  "components/game/battle/UnitDetailPanel.tsx",
]);

/**
 * The guard's OTHER blind spot, still open.
 *
 * It reads the className written at the tag. A file that puts its classes in a
 * constant - `const CHIP = "... uppercase tracking-label"`, then
 * ``className={`${CHIP} ${on ? A : B}`}`` - shows the scanner a className with
 * no literal classes in it, so the button is invisible however it is styled.
 *
 * `components/news/NewsFeed.tsx` does exactly that for its filter and
 * pagination chips, which is why it is absent from the list above despite
 * hand-rolling five buttons. Catching that needs the constants resolved, not a
 * wider regex, so it is recorded here rather than bodged.
 */

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
  // Arrows first. The pattern below is non-greedy, so it stops at the
  // FIRST `>` - and `onClick={() => ...}` puts one before the className on
  // most buttons in this codebase. The className was therefore never
  // reached and **this guard flagged nothing at all, repo-wide**. It caught
  // the events breadcrumb on 2026-09-17 only because that one passed
  // `onClick={onBack}` with no arrow. Stripping arrows first takes the
  // repo-wide count from 0 to 15.
  //
  // `tests/touchTargets.test.ts` documents this exact trap and strips them
  // in its own walk-back; this sibling never did (found 2026-09-17).
  const scanned = source.replace(/=>/g, "  ");
  for (const match of scanned.matchAll(/<button\b[\s\S]*?>/g)) {
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

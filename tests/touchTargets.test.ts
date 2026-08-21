import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { buttonVariants } from "@/components/ui/button";

/**
 * Ruling #107: a phone is the primary target, so nothing a thumb has to hit is
 * under 44px.
 *
 * The audit on 2026-08-21 found the violations were mostly **inherited, not
 * authored**. `components/ui/button.tsx` shipped nine sizes and five of them
 * sat under the floor — `default` worst of all at 36px, which 20 of the 51
 * `<Button>` call sites take without naming a size. That is why fixing screens
 * one at a time never held: `components/game/story/`, built mobile-first as
 * the calibration set for this very rule, still shipped two 36px buttons
 * because it asked for the default and the default was wrong.
 *
 * So the floor lives in the primitives, and these tests hold it there. They
 * check the class string rather than a rendered box, which means they can be
 * fooled by a call site passing `min-h-0` — that is deliberate and there is
 * exactly one such opt-out today (the merge button inside a hand card, which
 * is smaller than 44px itself and is waiting on the hand rework).
 */

/** `min-h-11` → 44, `size-11` → 44, `min-h-12` → 48. Tailwind's scale is
 *  0.25rem per step and the root font size is untouched. */
const FLOOR_CLASS = /\b(min-h|size)-(1[1-9]|[2-9]\d)\b/;

/** For assertions about what a file *doesn't* contain — a comment naming the
 *  thing that was removed is not the thing being removed. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("the button scale is touch-sized", () => {
  const sizes = [
    "xs",
    "sm",
    "default",
    "lg",
    "xl",
    "icon",
  ] as const;

  it.each(sizes)("size %s carries a 44px floor", (size) => {
    expect(buttonVariants({ size })).toMatch(FLOOR_CLASS);
  });

  it("declares no size below the floor", () => {
    // Catches a size added later that never appears in the list above.
    const source = fs.readFileSync("components/ui/button.tsx", "utf8");
    const sizeBlock = source.slice(
      source.indexOf("size: {"),
      source.indexOf("},", source.indexOf("size: {")),
    );
    const declared = [...sizeBlock.matchAll(/^\s*"?([\w-]+)"?:\s*"/gm)].map(
      (m) => m[1],
    );
    expect(declared.sort()).toEqual([...sizes].sort());
  });
});

describe("the other interactive primitives are touch-sized", () => {
  const read = (rel: string) => fs.readFileSync(rel, "utf8");

  it("a text field is at least 44px tall", () => {
    expect(read("components/ui/input.tsx")).toMatch(/\bh-11\b/);
  });

  it("a select trigger and its options are at least 44px tall", () => {
    const src = read("components/ui/select.tsx");
    expect(src).toContain("data-[size=default]:h-11");
    expect(src).toContain("data-[size=sm]:h-11");
    expect(src).toMatch(/min-h-11/);
  });

  it("a slider has a 44px grab band over its hairline track", () => {
    const src = read("components/ui/slider.tsx");
    // The root is what radix listens on, so it — not the 4px track — is what
    // has to be tall enough to land a thumb in.
    expect(src).toContain("data-horizontal:min-h-11");
    // And the thumb's own hit area is the `after` pseudo-element, kept apart
    // from its 12px visible size on purpose.
    expect(src).toContain("after:-inset-4");
  });
});

describe("the battle screen is operable by thumb", () => {
  const read = (rel: string) => fs.readFileSync(rel, "utf8");

  /**
   * A hand card was `flex-1 min-w-0` inside an `overflow-x-auto` row. The hand
   * caps at eight cards (`lib/game/deck.ts`), so at 390px eight of them split
   * the row into **43px slivers** — and because nothing ever exceeded the
   * container's width, the container never scrolled. The floor is what makes
   * the scroll it always had actually happen.
   */
  it("a hand card cannot shrink below a hittable width", () => {
    const src = read("components/game/battle/Hand.tsx");
    expect(src).toMatch(/min-w-14/);
    expect(src).not.toMatch(/min-w-0 max-w-24 flex-1/);
  });

  /**
   * The controls were a 56px vertical rail — 14% of a 390px screen, held
   * permanently, taken from the play area, and out of thumb reach (ruling
   * #118). They live in a sheet now.
   */
  it("the controls are not a fixed side rail", () => {
    const src = read("components/game/BattleArena.tsx");
    expect(src).not.toMatch(/<aside[^>]*w-14/);
    expect(src).toContain("isControlsOpen");
  });

  /**
   * The hand row scrolls horizontally, and it only started genuinely
   * overflowing once cards got a width floor. `touch-none` blocks *every*
   * touch gesture including that pan — it was harmless while nothing
   * overflowed and would strand the player the moment something did, with the
   * off-screen cards unreachable by any input a phone has.
   */
  it("the hand can still be swiped", () => {
    // Comments stripped first: the line that made this change explains what it
    // replaced, and a test that punishes a file for documenting itself teaches
    // the wrong lesson (`viewportUnits.test.ts` learned this first).
    const src = stripComments(read("components/game/battle/Hand.tsx"));
    expect(src).toMatch(/touch-pan-x/);
    expect(src).not.toMatch(/touch-none/);
  });
});

/**
 * Press-and-hold a card and a ring fills; the details open only when it
 * completes (Tanveer, 2026-08-21). Three outcomes hang off one gesture and the
 * dangerous one is the middle: an *abandoned* hold must do nothing, because
 * falling through to "play the card" would spend an action at the exact moment
 * the player decided against something.
 */
describe("the hold-to-open gesture", () => {
  const src = fs.readFileSync("components/game/battle/Hand.tsx", "utf8");

  it("keeps the ring's duration tied to the hold's", () => {
    // The ring is a promise about how long the press must last. If its
    // animation and the timer that opens the modal are written down
    // separately, they drift and the ring starts lying.
    expect(src).toContain("HOLD_DETAIL_MS - TAP_MAX_MS");
    expect(src).toMatch(/--hold-duration/);
  });

  it("distinguishes a tap from an abandoned hold", () => {
    expect(src).toMatch(/Date\.now\(\) - live\.startedAt >= TAP_MAX_MS/);
  });

  it("cancels the hold when the press becomes a drag", () => {
    const move = src.slice(src.indexOf("live.active = true;"));
    expect(move).toMatch(/clearTimeout\(live\.detailTimer\)/);
  });

  it("suppresses the OS long-press callout on the card", () => {
    // iOS shows its own menu well before three seconds are up, on top of the
    // ring the player is being asked to watch.
    expect(src).toContain("no-callout");
    expect(src).toContain("onContextMenu");
    expect(fs.readFileSync("styles/globals.css", "utf8")).toContain(
      "-webkit-touch-callout: none",
    );
  });
});

describe("explanations are reachable without a pointer", () => {
  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith(".tsx") ? [full] : [];
    });
  }

  const files = ["app", "components"]
    .flatMap((r) => walk(path.join(process.cwd(), r)))
    .map((f) => path.relative(process.cwd(), f).split(path.sep).join("/"))
    // The primitive itself is allowed to mention its own name.
    .filter((rel) => rel !== "components/ui/tooltip.tsx");

  /**
   * A radix `Tooltip` opens on hover and on focus. A phone offers neither to a
   * `<span>`, and every explanatory tooltip in this game was a `<span>` — so
   * the whole mechanic glossary, the nav's resource labels and the progression
   * panel's "why is this disabled" message were invisible on the device most
   * players use. `Hint` (`components/ui/Hint.tsx`) is a `Popover` with a real
   * button trigger, which works by tapping and keeps hover on top for mice.
   */
  it("nothing explanatory is behind a hover-only tooltip", () => {
    const offenders = files.filter((rel) =>
      /TooltipTrigger/.test(fs.readFileSync(rel, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

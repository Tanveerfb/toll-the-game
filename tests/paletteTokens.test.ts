import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The palette is the token layer, not Tailwind's stock ramps (2026-08-13).
 *
 * `styles/globals.css` declares the Combat Terminal tokens — surfaces, lines,
 * readout text, `signal` chrome, five element hues — and the screens migrated
 * to them over 2026-08-11. Eight files never did, and the two that mattered
 * were **shared components** rather than pages: `AudioControl` sat in the nav
 * on every screen still wearing `amber-300`, and `KitDetails` rendered inside
 * an already-migrated battle screen.
 *
 * That's why "which page is left?" was the wrong question and the docs
 * answered it wrongly for two days. This asks the right one, of every file.
 */

const ROOTS = ["app", "components"];

/** Stock Tailwind ramps that the token layer replaces. Deliberately not a
 *  blanket colour ban — `bg-white`, `text-black` and one-off rgba shadows are
 *  still legitimate. */
const STOCK_RAMPS = "zinc|slate|neutral|gray|stone|amber";

/**
 * Only utilities that actually paint. Written as a prefix list because a bare
 * ramp-name search matches `translate-x-1/2` — "trans**late**" contains
 * "slate", which is how the first count of this came out inflated.
 */
const OFFENDER = new RegExp(
  `(?:^|[\\s"'\`])(?:(?:hover|focus|focus-visible|active|disabled|group-hover|peer-focus|dark|md|lg|sm):)*` +
    `(?:bg|text|border|ring|from|via|to|accent|fill|stroke|divide|placeholder|outline|shadow|decoration)-` +
    `(?:${STOCK_RAMPS})-\\d+`,
  "g",
);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("no screen is left on the pre-token palette", () => {
  it("uses design tokens rather than Tailwind's stock colour ramps", () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      if (!fs.existsSync(root)) continue;
      for (const file of walk(root)) {
        const source = fs.readFileSync(file, "utf8");
        const matches = source.match(OFFENDER);
        if (matches) {
          offenders.push(`${file}: ${[...new Set(matches)].join(", ").trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("detects an offender when one exists", () => {
    // Without this, a regex that quietly stops matching makes the test above
    // vacuously pass — the same guard `overlayStacking` carries.
    expect('<div className="bg-zinc-900">'.match(OFFENDER)).not.toBeNull();
    expect('className="hover:text-amber-300"'.match(OFFENDER)).not.toBeNull();
  });

  it("does not fire on layout utilities that merely contain a ramp name", () => {
    // `translate` contains "slate"; `to-` prefixes appear inside words.
    expect('className="-translate-x-1/2"'.match(OFFENDER)).toBeNull();
    expect('className="bg-panel text-readout-dim"'.match(OFFENDER)).toBeNull();
  });
});

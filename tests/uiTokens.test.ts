import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Ruling #154 (2026-09-26): the motif is Shōnen Ink, and every control is a
 * customised shadcn primitive painting from shadcn's semantic tokens
 * (`--primary`, `--card`, `--border`…), so a motif is one token set.
 *
 * Combat Terminal's tokens stay defined until the last screen migrates
 * (Plans/2026-09-26-shonen-ink-foundation.md, phase 5). Until then this holds
 * the line at `components/ui/`: a primitive that has moved over never slides
 * back, and a new primitive has to be classified, the same way a new
 * player-store field has to be (`tests/cloudSave.test.ts`).
 */

const UI_DIR = "components/ui";

/** Paint only from semantic tokens. Guarded below. */
const MIGRATED = [
  "alert.tsx",
  "AudioControl.tsx",
  "badge.tsx",
  "button.tsx",
  "dialog.tsx",
  "DuelToggle.tsx",
  "Hint.tsx",
  "input.tsx",
  "KeyworkHighlighter.tsx",
  "MountedDialog.tsx",
  "Panel.tsx",
  "popover.tsx",
  "progress.tsx",
  "prose.tsx",
  "Screen.tsx",
  "SectionHeader.tsx",
  "select.tsx",
  "sheet.tsx",
  "slider.tsx",
  "switch.tsx",
  "table.tsx",
  "tabs.tsx",
  "toggle-group.tsx",
  "toggle.tsx",
  "TopNav.tsx",
];

/**
 * Still Combat Terminal, and why they wait. Empty since 2026-09-27: `Panel`
 * moved over with the battle (#156) and `card.tsx` was deleted with its last
 * consumer. A primitive added here must say why it waits.
 */
const PENDING: string[] = [];

/** Every Combat Terminal colour name, as a Tailwind colour utility, plus its
 *  two shape classes. */
const LEGACY =
  /\b(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|from|to|via|fill|stroke|outline|shadow|divide|placeholder|caret|accent|decoration)-(?:void|panel-raised|panel|inset|gridline|hairline|edge-strong|edge|readout-strong|readout-dim|readout-muted|readout|signal-dim|signal)\b|\bterminal-grid\b|\bchamfer(?:-lg)?\b/;

/** A comment naming the retired thing is not the retired thing. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const read = (file: string) =>
  stripComments(fs.readFileSync(path.join(UI_DIR, file), "utf8"));

describe("the shadcn primitives paint Shōnen Ink (#154)", () => {
  it("every file in components/ui is classified", () => {
    const onDisk = fs
      .readdirSync(UI_DIR)
      .filter((f) => f.endsWith(".tsx"))
      .sort();
    expect(onDisk).toEqual([...MIGRATED, ...PENDING].sort());
  });

  it.each(MIGRATED)("%s uses no Combat Terminal token", (file) => {
    expect(read(file)).not.toMatch(LEGACY);
  });

  it.each(MIGRATED)("%s uses the type scale, not a pixel size", (file) => {
    expect(read(file)).not.toMatch(/\btext-\[\d+(?:\.\d+)?px\]/);
  });

  it("every pending file is still pending (move it to MIGRATED when it is not)", () => {
    // Keeps the list honest: a pending file that no longer needs migrating
    // should say so rather than sit here unguarded. A loop rather than
    // `it.each`, which has nothing to run over an empty list.
    for (const file of PENDING) expect(read(file), file).toMatch(LEGACY);
  });

  it("the stray `cn` package is not a dependency", () => {
    // `npx shadcn add` installed it on every run on 2026-09-26 (tabs,
    // dialog…, then alert) to satisfy the bad import below. Remove it with
    // `npm uninstall cn` after any `shadcn add`.
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    expect(pkg.dependencies?.cn).toBeUndefined();
    expect(pkg.devDependencies?.cn).toBeUndefined();
  });

  it("no file imports `cn` from the stray `cn` package", () => {
    // The shadcn CLI wrote `import { cn } from "cn"` into seven new
    // primitives on 2026-09-26 and added an unrelated npm package to satisfy
    // it. The helper lives at `@/lib/utils`.
    for (const file of [...MIGRATED, ...PENDING]) {
      expect(read(file), file).not.toMatch(/from ["']cn["']/);
    }
  });
});

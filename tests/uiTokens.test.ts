import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Ruling #154 (2026-09-26): the motif is Shōnen Ink, and every control is a
 * customised shadcn primitive painting from shadcn's semantic tokens
 * (`--primary`, `--card`, `--border`…), so a motif is one token set.
 *
 * **Combat Terminal is gone, and this keeps it gone** (phase 5 of
 * `Plans/2026-09-26-shonen-ink-foundation.md`, 2026-09-27). Until then the
 * file held the line at `components/ui/` only, with a MIGRATED / PENDING list
 * that tracked the move; the last pending primitive went with the battle
 * (#156), and the tokens themselves were deleted from `styles/globals.css`.
 * The guards below cover the whole source tree instead.
 *
 * Each one carries a check that its pattern still matches a planted offender:
 * a regex that quietly stops matching makes a guard pass forever, which is
 * how three checks in `kitDescriptionRules` went unnoticed for weeks.
 */

/** Everywhere a class name or a token can be written. */
const SOURCE_ROOTS = ["app", "components", "hooks", "lib", "content", "styles"];
/** Where project-rules §12 forbids a raw colour: the things that render. */
const COMPONENT_ROOTS = ["app", "components"];

const SOURCE_EXT = /\.(?:tsx?|css|mdx)$/;

/** Every Combat Terminal colour name, as a Tailwind colour utility or a CSS
 *  variable, plus its two shape classes. */
const LEGACY_NAMES =
  "void|panel-raised|panel|inset|gridline|hairline|edge-strong|edge|readout-strong|readout-dim|readout-muted|readout|signal-dim|signal";
const LEGACY = new RegExp(
  `\\b(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|from|to|via|fill|stroke|outline|shadow|divide|placeholder|caret|accent|decoration)-(?:${LEGACY_NAMES})\\b` +
    `|--color-(?:${LEGACY_NAMES})\\b|\\bterminal-grid\\b|\\bchamfer(?:-lg)?\\b`,
);

/** A pixel, rem or em font size written at the usage instead of the scale
 *  (`text-micro`, `text-label`, `text-caption`, then Tailwind's own steps). */
const ARBITRARY_FONT_SIZE = /\btext-\[\d+(?:\.\d+)?(?:px|rem|em)\]/;

/**
 * A hex colour written as a value. Two shapes, because `#107` is a ruling
 * number in a sentence as often as it is a colour:
 * - directly inside a string (`"#fff"`, `` `#ffffffcc` ``), any length;
 * - after a space, bracket or comma (inside a gradient), only where it cannot
 *   be a ruling: six or eight digits, or one containing a letter.
 */
const RAW_HEX =
  /["'`]#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|[\s(,]#(?:[0-9a-f]{8}|[0-9a-f]{6}|(?=[0-9]*[a-f])[0-9a-f]{3,4})\b/i;

/**
 * Raw colours that are right where they are, and why. Keep this short: every
 * entry is a colour the design system cannot change.
 */
const RAW_HEX_ALLOWED: Record<string, string> = {
  // Google's four-colour "G". Its brand guidelines fix the colours, and it
  // is Google's mark, not ours.
  "app/login/page.tsx": "the Google sign-in logo",
  // Read by the OS before any CSS loads; the test below keeps it equal to
  // `--background`.
  "app/manifest.ts": "the install splash and status bar",
};

/** A comment naming the retired thing is not the retired thing. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

const posix = (file: string) => file.split(path.sep).join("/");

function offenders(roots: string[], pattern: RegExp, skip: Record<string, string> = {}): string[] {
  const found: string[] = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      if (posix(file) in skip) continue;
      const lines = stripComments(fs.readFileSync(file, "utf8")).split("\n");
      lines.forEach((line, i) => {
        const hit = line.match(pattern);
        if (hit) found.push(`${posix(file)}:${i + 1}: ${hit[0].trim()}`);
      });
    }
  }
  return found;
}

describe("Combat Terminal stays retired (#154, phase 5)", () => {
  it("no source file uses a Combat Terminal token or shape class", () => {
    expect(offenders(SOURCE_ROOTS, LEGACY)).toEqual([]);
  });

  it("the pattern catches every kind of legacy use", () => {
    for (const sample of [
      'className="bg-panel"',
      'className="hover:text-readout-dim"',
      'className="border-b-edge-strong"',
      "color: var(--color-signal);",
      "--color-void: #06090c;",
      'className="chamfer-lg"',
      'className="terminal-grid"',
    ]) {
      expect(sample, sample).toMatch(LEGACY);
    }
    // The Shōnen Ink names that share a stem with a retired one.
    expect('className="bg-card text-muted-foreground border-rule"').not.toMatch(LEGACY);
    expect('className="inset-0 ring-ring"').not.toMatch(LEGACY);
  });
});

describe("the type scale is the only font size (#154)", () => {
  it("no source file writes a font size by hand", () => {
    expect(offenders(SOURCE_ROOTS, ARBITRARY_FONT_SIZE)).toEqual([]);
  });

  it("the pattern catches a hand-written size", () => {
    expect('className="text-[10px]"').toMatch(ARBITRARY_FONT_SIZE);
    expect('className="text-[12.5px]"').toMatch(ARBITRARY_FONT_SIZE);
    expect('className="text-[0.7rem]"').toMatch(ARBITRARY_FONT_SIZE);
    expect('className="text-label text-caption"').not.toMatch(ARBITRARY_FONT_SIZE);
  });
});

describe("no raw colour in a component (project-rules §12)", () => {
  it("app and components paint from tokens", () => {
    expect(offenders(COMPONENT_ROOTS, RAW_HEX, RAW_HEX_ALLOWED)).toEqual([]);
  });

  it("the pattern catches a colour and not a ruling number", () => {
    for (const sample of [
      'background: "#ffffff",',
      "fill='#4285F4'",
      "linear-gradient(90deg, transparent 45%, #ffffffcc 50%)",
      'color: "#111",',
    ]) {
      expect(sample, sample).toMatch(RAW_HEX);
    }
    for (const sample of ["ruling #107 makes it", "(#156)", "picked C, #144, then"]) {
      expect(sample, sample).not.toMatch(RAW_HEX);
    }
  });

  it("every allowed file still needs its exemption", () => {
    // An exemption that no longer covers anything is an exemption waiting
    // for an unrelated colour to slip in under it.
    for (const file of Object.keys(RAW_HEX_ALLOWED)) {
      expect(stripComments(fs.readFileSync(file, "utf8")), file).toMatch(RAW_HEX);
    }
  });

  it("the manifest's colours are the ground's", () => {
    const css = fs.readFileSync("styles/globals.css", "utf8");
    const ground = css.match(/--background:\s*(#[0-9a-f]{6})/i)?.[1];
    const manifest = fs.readFileSync("app/manifest.ts", "utf8");
    expect(ground).toBeDefined();
    expect(manifest).toContain(`background_color: "${ground}"`);
    expect(manifest).toContain(`theme_color: "${ground}"`);
  });
});

describe("the shadcn CLI's stray `cn`", () => {
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
    expect(offenders(SOURCE_ROOTS, /from ["']cn["']/)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Letter-spacing comes from one of three tokens, never a number.
 *
 * Measured 2026-09-17: **364 usages across 18 distinct values**, of which the
 * top six — `0.18em` ×53, `0.16em` ×48, `0.14em` ×46, `0.1em` ×34, `0.12em`
 * ×34, `0.22em` ×32 — were all doing the same job, the uppercase micro-label.
 * That is drift, not a scale, and no reviewer will ever catch a `0.16em` that
 * should have been `0.14em`.
 *
 * Three steps now, approved by Tanveer: `tracking-title` (0.08em) for
 * heading-font display text, `tracking-label` (0.14em) for uppercase
 * micro-labels, `tracking-eyebrow` (0.22em) for the rare eyebrow above a page
 * title.
 *
 * **Why `eyebrow` and not `wide`:** the first attempt defined `--tracking-wide`,
 * which is a name Tailwind's own scale already owns (0.025em). Defining it
 * re-spaced the four places already using `tracking-wide` by **9×**, silently,
 * with nothing in the diff to suggest it. A token that shadows a framework
 * default is a trap; this one is named for its job instead.
 */

const ROOTS = [join(process.cwd(), "app"), join(process.cwd(), "components")];

const ALLOWED = new Set([
  "tracking-title",
  "tracking-label",
  "tracking-eyebrow",
]);

/** Tailwind's own scale. Using one of these reintroduces a fourth value, and
 *  `tracking-wide` additionally collides with a token name. */
const FRAMEWORK_DEFAULTS = [
  "tracking-tighter",
  "tracking-tight",
  "tracking-normal",
  "tracking-wide",
  "tracking-wider",
  "tracking-widest",
];

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) found.push(path);
  }
  return found;
}

describe("letter-spacing is a scale, not a number", () => {
  const files = ROOTS.flatMap((root) => sourceFiles(root));

  it("finds the source tree at all", () => {
    // Guards the guard: a moved folder must not make this file pass vacuously.
    expect(files.length).toBeGreaterThan(50);
  });

  it("uses no arbitrary tracking values anywhere", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/tracking-\[[^\]]+\]/g)) {
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(
          `${file.slice(process.cwd().length + 1).replace(/\\/g, "/")}:${line} ${match[0]}`,
        );
      }
    }
    expect(
      offenders,
      `Use tracking-title / tracking-label / tracking-eyebrow instead of an ` +
        `arbitrary value. Adding a fourth step means changing the scale in ` +
        `styles/globals.css, deliberately.`,
    ).toEqual([]);
  });

  it("uses none of Tailwind's own tracking steps", () => {
    // Not stylistic: `tracking-wide` is the name the project token nearly took,
    // and reintroducing it would make two different spacings share one word.
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const name of FRAMEWORK_DEFAULTS) {
        const hits = source.match(new RegExp(`\\b${name}\\b`, "g"));
        if (hits) {
          offenders.push(
            `${file.slice(process.cwd().length + 1).replace(/\\/g, "/")} ${name} ×${hits.length}`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the scale at exactly three steps", () => {
    // The whole point. A fourth token added without a conversation is how
    // eighteen values happened the first time.
    const css = readFileSync(join(process.cwd(), "styles/globals.css"), "utf8");
    const declared = [...css.matchAll(/--tracking-([a-z-]+)\s*:/g)].map(
      (m) => `tracking-${m[1]}`,
    );
    expect(new Set(declared)).toEqual(ALLOWED);
  });
});

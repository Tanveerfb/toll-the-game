import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * No tracked source file contains a stray control character.
 *
 * Written 2026-09-16, after finding that three of the four guards in
 * `tests/kitDescriptionRules.test.ts` had never run. `/\braises\b|\blowers\b/`
 * had been authored through a heredoc that turned each `\b` into a literal
 * `0x08`, so the regex matched nothing, the loop never executed, and the test
 * passed green from the day it was written. `docs/HANDOFF.md` carried the same
 * damage — in the sentence describing the hazard.
 *
 * Nothing catches this by reading: a `0x08` is invisible in an editor, in a
 * diff, and in `git log`. It does not throw, it does not fail to compile, and
 * a regex holding one simply never matches. One byte-level check is the whole
 * defence.
 *
 * Tabs, newline and carriage return are legal. Everything else in the C0 range
 * is not, and neither is a lone `0x7f`.
 */

const REPO = path.resolve(__dirname, "..");

const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|css|json|md|mdx|ya?ml|html|txt)$/i;

const LEGAL = new Set([0x09, 0x0a, 0x0d]);

function trackedTextFiles(): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return out
    .split("\0")
    .filter((f) => f && TEXT.test(f))
    .filter((f) => {
      try {
        // A lockfile or a generated bundle is not hand-authored; skip anything
        // implausibly large rather than reading it byte by byte.
        return statSync(path.join(REPO, f)).size < 4 * 1024 * 1024;
      } catch {
        return false;
      }
    });
}

describe("no stray control characters in tracked source", () => {
  it("finds files to check at all", () => {
    // Without this, a broken `git ls-files` would make the test below pass by
    // checking nothing — the exact failure mode it exists to prevent.
    expect(trackedTextFiles().length).toBeGreaterThan(100);
  });

  it("no file carries a control character that isn't tab or newline", () => {
    const offenders: string[] = [];
    for (const file of trackedTextFiles()) {
      const data = readFileSync(path.join(REPO, file));
      for (let i = 0; i < data.length; i++) {
        const b = data[i];
        if ((b < 0x20 && !LEGAL.has(b)) || b === 0x7f) {
          const line = data.subarray(0, i).toString("utf8").split("\n").length;
          offenders.push(
            `${file}:${line} — 0x${b.toString(16).padStart(2, "0")}`,
          );
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

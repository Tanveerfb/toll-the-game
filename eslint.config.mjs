import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  /**
   * The **full** jsx-a11y ruleset (2026-08-21).
   *
   * `eslint-config-next/core-web-vitals` turns on six of these rules — the ones
   * about malformed ARIA. It does not turn on the ones about *behaviour*, and
   * behaviour is where this codebase actually broke: the entire mechanic
   * glossary shipped as a radix `Tooltip` wrapped around a bare `<span>`, which
   * is unreachable by tap and by keyboard alike, and nothing complained.
   *
   * `no-static-element-interactions`, `click-events-have-key-events` and
   * `interactive-supports-focus` are the three that describe that bug. Turning
   * the set on is how "a span that behaves like a button" stops being something
   * a reviewer has to notice.
   *
   * Only the *rules* are spread, not the flat config: `eslint-config-next`
   * already registers the `jsx-a11y` plugin, and registering it twice is a
   * hard config error.
   */
  {
    files: ["**/*.tsx"],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // The rule looks for a native control inside the label. `Input` is this
      // project's shadcn wrapper around `<input>`, so without naming it a
      // correctly-labelled field reads as unlabelled.
      "jsx-a11y/label-has-associated-control": [
        "error",
        { controlComponents: ["Input"] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Verification builds run with NEXT_DIST_DIR=.next-verify so they don't
    // clobber the dev server's .next — that output is generated, not source.
    ".next-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignore author notes that are stored as markdown content rather than linted source.
    "author_notes.md",
    // Scratch files written by the `remember` plugin — not project source.
    ".remember/**",
  ]),
  // Additional overrides: disable rules that cause many false positives in this repo.
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;

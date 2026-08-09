import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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

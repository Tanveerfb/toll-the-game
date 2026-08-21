import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import path from "node:path";

/**
 * Two suites, deliberately separated.
 *
 * **unit** — everything under `tests/*.test.ts`. Pure engine, stores and
 * source-scanning guards, run in Node. This is the whole history of the
 * project's testing: 104 files and not one of them rendered a component.
 *
 * **browser** — `tests/*.browser.test.tsx`, run in real Chromium via
 * Playwright. Added 2026-08-21 because the mobile pass shipped a set of
 * behaviours that a simulated DOM cannot judge: a popover that must open on
 * *tap* and not only on hover, and a press-and-hold whose whole contract is
 * timing. Those were pinned by grepping the source for class names, which
 * proves a string is present, not that a gesture works.
 *
 * Browser tests are opt-in by filename. `npm run test` runs unit only — a
 * Chromium launch per run is not what you want in a tight loop — and
 * `npm run test:browser` runs the other half.
 */
const alias = {
  "@": path.resolve(__dirname),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        resolve: {
          alias: {
            ...alias,
            // `next/image` needs the Next build pipeline for its loader and
            // does not run standalone. Components under test use it purely to
            // put a portrait on screen, which no behaviour here depends on, so
            // it resolves to a plain <img>.
            "next/image": path.resolve(__dirname, "tests/stubs/next-image.tsx"),
          },
        },
        test: {
          name: "browser",
          include: ["tests/**/*.browser.test.tsx"],
          // The real stylesheet, or a size assertion passes on an unstyled
          // block element and proves nothing. See the setup file.
          setupFiles: ["tests/stubs/browser-setup.ts"],
          browser: {
            enabled: true,
            // Vitest 4.1 takes a provider factory, not the `"playwright"`
            // string most guides still show.
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});

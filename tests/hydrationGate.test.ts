import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A route that reads persisted player state must wait for it to arrive.
 *
 * `store/playerStore.ts` states the rule on the field itself: *"True once
 * zustand-persist has rehydrated from localStorage — **gate any first-paint
 * read of roster/inventory on this** to avoid a flash of the default starter
 * state ahead of the real persisted data (SSR/CSR mismatch risk)."*
 *
 * Eleven components honoured that. The two route pages reading the most player
 * state did not (audit 2026-09-17, finding Q3): `app/events/page.tsx` read it in
 * twenty places while deciding **event visibility**, **lock reasons**, the
 * **difficulty ladder** and the **stamina check** — every one of which is
 * computed against rank 1 and a default stamina bar before the save lands. A
 * cleared trial could flash as locked on the screen where that matters most.
 *
 * This is the class-level fix rather than the instance-level one: two pages were
 * patched, and this stops the third from shipping without a gate.
 */

const APP = join(process.cwd(), "app");

function routePages(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) routePages(path, found);
    else if (entry === "page.tsx") found.push(path);
  }
  return found;
}

/** Store hooks whose state is persisted and therefore arrives late. */
const PERSISTED_STORES = ["usePlayerStore", "useStoryStore"] as const;

/**
 * Reads that cannot flash, because they are not state.
 *
 * `usePlayerStore.getState()` inside a callback runs long after hydration —
 * the player had to click something to reach it. Only the reactive selector
 * form paints.
 */
function reactiveReads(source: string, store: string): number {
  const selector = new RegExp(`${store}\\(\\(`, "g");
  return (source.match(selector) ?? []).length;
}

describe("route pages wait for persisted state", () => {
  const pages = routePages(APP);

  it("finds the route pages at all", () => {
    // Guards the guard: a refactor that moves pages would otherwise make this
    // whole file pass by testing nothing.
    expect(pages.length).toBeGreaterThan(5);
  });

  for (const page of routePages(APP)) {
    const relative = page.slice(process.cwd().length + 1).replace(/\\/g, "/");
    const source = readFileSync(page, "utf8");

    for (const store of PERSISTED_STORES) {
      const reads = reactiveReads(source, store);
      if (reads === 0) continue;

      it(`${relative} gates its ${store} reads on hasHydrated`, () => {
        expect(
          source.includes("hasHydrated"),
          `${relative} reads ${store} ${reads}x but never mentions hasHydrated`,
        ).toBe(true);

        // Two shapes are valid, and the repo uses both deliberately.
        //
        //  1. An early return — `if (!hasHydrated) return <shell />`. Right for
        //     a page whose whole body is derived from the save, like the events
        //     board, where every row's lock state depends on account rank.
        //  2. A readiness flag — `const ready = hasHydrated && …`, then render
        //     a placeholder for the unready values. Right for a page with real
        //     chrome around the data, which is what `TopNav` and `/profile` do:
        //     the layout paints immediately and the numbers fill in as dashes.
        //
        // Requiring only (1) failed `/profile` on its first run for doing (2)
        // correctly, so both are accepted. What is NOT accepted is mentioning
        // the field and rendering anyway, which is the actual bug.
        const earlyReturn =
          /if \(![A-Za-z]*[Hh]ydrated[^)]*\)\s*\{?\s*\n?\s*return/.test(source);
        const readyFlag =
          /(?:const|let)\s+\w*[Rr]eady\w*\s*=[^;]*[Hh]ydrated/.test(source);

        expect(
          earlyReturn || readyFlag,
          `${relative} mentions hasHydrated but neither returns early on it ` +
            `nor derives a readiness flag from it`,
        ).toBe(true);
      });
    }
  }
});

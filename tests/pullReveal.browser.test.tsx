import { describe, expect, it } from "vitest";
import { page } from "@vitest/browser/context";
import { render } from "vitest-browser-react";

import PullReveal from "@/components/gacha/PullReveal";
import type { ResolvedPullOutcome } from "@/store/playerStore";

/**
 * `PullReveal` — the results screen's play-in, and the gate it holds.
 *
 * The reveal is a timed sequence (units pop in one by one, then the materials
 * fade), and `revealing` stays true until it has finished: Draw again, Escape
 * and the close all wait on it. That contract is pure timing, which a
 * simulated DOM cannot judge — the sequence is framer-motion's imperative
 * `animate()` (GSAP left on 2026-10-13), and only a real browser runs it to
 * completion and resolves its promise. These tests pin the gate at both ends:
 * closed while the sequence plays, open when it is done, and open at once on
 * Skip.
 */
const results: ResolvedPullOutcome[] = [
  { kind: "character", characterId: "duke", isNew: true, coinId: null },
  { kind: "character", characterId: "lyra", isNew: false, coinId: "coin" },
  { kind: "coin", amount: 2000 },
];

const DRAW_LABEL = "Draw ×1 · ◆ 5";

function renderReveal() {
  return render(
    <PullReveal
      results={results}
      bannerName="Test banner"
      drawLabel={DRAW_LABEL}
      canDrawAgain
      onDrawAgain={() => {}}
      onClose={() => {}}
    />,
  );
}

/** The materials section waits at opacity 0 until every unit has landed, so
 *  reading 0 there is proof the sequence is running, not merely pending. */
function materialsOpacity(): string {
  const rest = document.querySelector("[data-reveal='rest']");
  return rest ? getComputedStyle(rest).opacity : "missing";
}

describe("PullReveal", () => {
  it("holds Draw again while the results play in, then releases it", async () => {
    renderReveal();

    const drawAgain = page.getByRole("button", { name: DRAW_LABEL });
    await expect.element(drawAgain).toBeDisabled();
    await expect.element(page.getByRole("button", { name: "Skip ▸▸" })).toBeInTheDocument();
    await expect.poll(materialsOpacity).toBe("0");

    // Two units at 0.28s staggered 0.09s, then a 0.2s fade: well under a
    // second, so the default retry window would do, but the point is that it
    // ends, not how fast.
    await expect.element(drawAgain, { timeout: 3000 }).toBeEnabled();
    expect(materialsOpacity()).toBe("1");
    await expect
      .element(page.getByRole("button", { name: "Skip ▸▸" }))
      .not.toBeInTheDocument();
  });

  it("releases it at once on Skip, with everything in its final state", async () => {
    renderReveal();

    const drawAgain = page.getByRole("button", { name: DRAW_LABEL });
    await expect.element(drawAgain).toBeDisabled();
    await expect.poll(materialsOpacity).toBe("0");

    await page.getByRole("button", { name: "Skip ▸▸" }).click();

    // No retry window: the click handler flips the flag synchronously, and a
    // skip that only *eventually* enables the button is the sequence ending
    // on its own. The materials are already at full opacity for the same
    // reason: Skip completes the sequence rather than abandoning it.
    expect(drawAgain.element()).toBeEnabled();
    expect(materialsOpacity()).toBe("1");
  });
});

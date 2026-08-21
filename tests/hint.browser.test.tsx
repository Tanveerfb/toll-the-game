import { describe, expect, it } from "vitest";
import { page, userEvent } from "@vitest/browser/context";
import { render } from "vitest-browser-react";

import Hint from "@/components/ui/Hint";

/**
 * `Hint` — the component that replaced every explanatory `Tooltip` in the game
 * (ruling #120).
 *
 * These are the first tests in this project that render anything. They exist
 * because the bug `Hint` fixes is invisible to every other kind of test: a
 * radix `Tooltip` on a `<span>` renders perfectly, holds the right text in the
 * tree, and passes any snapshot you like — while doing nothing when tapped.
 * The only way to catch that is to actually tap it, somewhere with a real
 * pointer and real event dispatch.
 *
 * A source-scanning test can prove `TooltipTrigger` is gone. It cannot prove
 * that what replaced it works.
 */
describe("Hint", () => {
  it("is a real button, not a span pretending", async () => {
    // The load-bearing half of the fix. A `<span>` takes neither tap nor focus,
    // which is exactly how the mechanic glossary became unreachable on a phone.
    render(<Hint content="Deals damage over three turns.">Ignite</Hint>);
    await expect
      .element(page.getByRole("button", { name: "Ignite" }))
      .toBeInTheDocument();
  });

  it("opens on tap", async () => {
    render(<Hint content="Deals damage over three turns.">Ignite</Hint>);

    await expect
      .element(page.getByText("Deals damage over three turns."))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: "Ignite" }).click();

    await expect
      .element(page.getByText("Deals damage over three turns."))
      .toBeInTheDocument();
  });

  it("closes again on a second tap", async () => {
    render(<Hint content="Pierces 50% of DEF.">Pierce</Hint>);

    await page.getByRole("button", { name: "Pierce" }).click();
    await expect
      .element(page.getByText("Pierces 50% of DEF."))
      .toBeInTheDocument();

    await page.getByRole("button", { name: "Pierce" }).click();
    await expect
      .element(page.getByText("Pierces 50% of DEF."))
      .not.toBeInTheDocument();
  });

  it("carries an accessible name when its face is a glyph", async () => {
    // The nav's counters show a number and keep the meaning in the hint, so
    // without this the control announces as its own value.
    render(
      <Hint ariaLabel="Stamina" content="Spent entering World Boss runs">
        120
      </Hint>,
    );
    await expect
      .element(page.getByRole("button", { name: "Stamina" }))
      .toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<Hint content="Ignores evasion.">Sure Hit</Hint>);

    await page.getByRole("button", { name: "Sure Hit" }).click();
    await expect.element(page.getByText("Ignores evasion.")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await expect
      .element(page.getByText("Ignores evasion."))
      .not.toBeInTheDocument();
  });

  it("opens by keyboard, so it is not a pointer-only affordance either", async () => {
    // The rule this whole component exists to satisfy cuts both ways: the old
    // tooltip was unreachable by touch, and a tap-only replacement would be
    // unreachable by keyboard.
    render(<Hint content="Recovers HP each turn.">Regeneration</Hint>);

    await userEvent.keyboard("{Tab}");
    await expect
      .element(page.getByText("Recovers HP each turn."))
      .toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import Hand from "@/components/game/battle/Hand";
import { getCharacterById } from "@/lib/game/characterCatalog";
import type { ActionCard } from "@/types/action";
import type { BattleCharacter } from "@/types/character";

/**
 * The hand's press-and-hold gesture (ruling #118).
 *
 * This is the case that a simulated DOM cannot judge and a source grep cannot
 * even approach. The contract is entirely about *time and pointers*: one press
 * has three possible endings, and which one you get depends on how long you
 * held and whether you moved. `min-w-14` being present in the file says
 * nothing about any of that.
 *
 *   released quickly        → the card is played
 *   released mid-hold       → nothing at all happens
 *   held until the ring fills → the details open
 *
 * The middle case is the one worth the trouble: falling through to "play the
 * card" there would spend an action at the exact moment the player decided
 * against something.
 */

function unit(id: string): BattleCharacter {
  const raw = getCharacterById(id);
  if (!raw) throw new Error(`Unknown character: ${id}`);
  return {
    ...(raw as unknown as BattleCharacter),
    instanceId: `p1_${id}`,
    currentAttack: raw.atk,
    currentDefense: raw.def,
    currentHP: raw.hp,
    ultGauge: 0,
    ultLevel: 1,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team: "player",
    isSub: false,
  };
}

function cardsFor(character: BattleCharacter, count: number): ActionCard[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `card-${i}`,
    sourceInstanceId: character.instanceId,
    // Distinct skills so nothing is a merge partner by accident — merging has
    // its own affordance and would confuse these assertions.
    skill: character.skills[i % character.skills.length],
    rank: 1 as const,
  }));
}

async function renderHand(
  overrides: Partial<React.ComponentProps<typeof Hand>> = {},
) {
  const duke = unit("duke");
  const handlers = {
    onSelect: vi.fn(),
    onMerge: vi.fn(),
    onReorder: vi.fn(),
    onPreviewStart: vi.fn(),
    onPreviewEnd: vi.fn(),
    onDetail: vi.fn(),
  };
  render(
    <Hand
      cards={cardsFor(duke, 3)}
      playerTeam={[duke]}
      interactive
      queueFull={false}
      reducedMotion
      canUseMergeButton={() => false}
      {...handlers}
      {...overrides}
    />,
  );
  // React commits asynchronously; every query below is a direct DOM read
  // rather than a retrying locator, so wait for the first paint once here.
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  return handlers;
}

/** The card's DOM node — the hand tags each one with `data-card-id`. */
function cardElement(id = "card-0"): HTMLElement {
  const node = document.querySelector(`[data-card-id="${id}"]`);
  if (!node) throw new Error(`No card ${id} rendered`);
  return node as HTMLElement;
}

/** A press held for `ms`, then released, without moving. */
async function pressFor(element: HTMLElement, ms: number): Promise<void> {
  const box = element.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;

  element.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: y,
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, ms));
  window.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: y,
    }),
  );
  // Let React flush the resulting state.
  await new Promise((resolve) => setTimeout(resolve, 30));
}

describe("the hand's press-and-hold", () => {
  it("plays the card on a quick tap", async () => {
    const handlers = await renderHand();
    await pressFor(cardElement(), 40);

    expect(handlers.onSelect).toHaveBeenCalledWith("card-0");
    expect(handlers.onDetail).not.toHaveBeenCalled();
  });

  it("does nothing when a hold is abandoned part-way", async () => {
    // The expensive mistake this guards: releasing a hold you thought better
    // of must not cost you an action.
    const handlers = await renderHand();
    await pressFor(cardElement(), 600);

    expect(handlers.onSelect).not.toHaveBeenCalled();
    expect(handlers.onDetail).not.toHaveBeenCalled();
  });

  it("opens the details once the hold completes", async () => {
    const handlers = await renderHand();
    // Comfortably past HOLD_DETAIL_MS (1500).
    await pressFor(cardElement(), 1800);

    expect(handlers.onDetail).toHaveBeenCalledTimes(1);
    expect(handlers.onSelect).not.toHaveBeenCalled();
  });

  it("shows a progress ring while the hold is running, and not before", async () => {
    await renderHand();
    const card = cardElement();
    const box = card.getBoundingClientRect();

    card.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerId: 1,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
      }),
    );

    // Nothing during the tap window, or every tap would flash a ring.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(document.querySelector(".hold-ring-sweep")).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(document.querySelector(".hold-ring-sweep")).not.toBeNull();

    window.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(document.querySelector(".hold-ring-sweep")).toBeNull();
  });

  it("keeps a full hand hittable at 390px, which is where it broke", async () => {
    // The original bug, reproduced: eight cards (the cap at four field units)
    // in a 390px-wide row. They were `flex-1 min-w-0`, so they divided the
    // width into 43px slivers — and because nothing overflowed, the row that
    // was always `overflow-x-auto` never scrolled either.
    //
    // Rendered inside a fixed 390px box on purpose. Measuring one card at the
    // test runner's own width would pass at any size and prove nothing.
    const duke = unit("duke");
    render(
      <div style={{ width: 390 }}>
        <Hand
          cards={cardsFor(duke, 8)}
          playerTeam={[duke]}
          interactive
          queueFull={false}
          reducedMotion
          canUseMergeButton={() => false}
          onSelect={vi.fn()}
          onMerge={vi.fn()}
          onReorder={vi.fn()}
          onPreviewStart={vi.fn()}
          onPreviewEnd={vi.fn()}
          onDetail={vi.fn()}
        />
      </div>,
    );
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const cards = [...document.querySelectorAll("[data-card-id]")];
    expect(cards).toHaveLength(8);
    for (const card of cards) {
      expect(card.getBoundingClientRect().width).toBeGreaterThanOrEqual(56);
    }
  });

  it("lets the row be swiped rather than blocking touch outright", async () => {
    await renderHand();
    const row = cardElement().parentElement as HTMLElement;
    // `touch-none` here would leave the off-screen cards unreachable on a
    // phone, since the hand overflows once cards stop shrinking.
    expect(getComputedStyle(row).touchAction).toBe("pan-x");
  });
});

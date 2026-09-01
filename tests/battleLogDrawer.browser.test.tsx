import { afterEach, describe, expect, it } from "vitest";
import { page } from "@vitest/browser/context";
import { cleanup, render } from "vitest-browser-react";

import BattleLogDrawer from "@/components/game/battle/BattleLogDrawer";
import MotionProvider from "@/components/providers/MotionProvider";
import type { SequencedBattleEvent } from "@/store/gameStore";

/**
 * The battle log's status chips (Open Issue #22, closed 2026-09-01).
 *
 * Three things here that no unit test can reach, in ascending order of how
 * badly they would have shipped unnoticed:
 *
 * 1. **Whether the row fits a phone.** The chips are a wrapping flex run
 *    inside a `pl-4` row inside a fixed drawer. `flex-wrap` being in the file
 *    proves nothing about whether four chips and a long name at 390px wrap or
 *    push the drawer sideways — only layout does, and only a real one.
 * 2. **Whether an expiry-only tick renders at all.** A stun running out moves
 *    no HP, so its event carries `targets: []`. Everything upstream of the
 *    drawer was written when a tick always had targets.
 * 3. **Whether a loss reads as a loss.** `line-through` is a computed style;
 *    a class name in the source says only that someone typed it.
 *
 * `mobilecheck`'s own boundary applies: this proves behaviour and geometry,
 * not that the result looks right. The visual pass is Tanveer's.
 */

const PHONE = { width: 390, height: 844 };

// The drawer portals to <body>, which `render`'s own teardown does not reach —
// without this every test measures the previous one's leftovers too, and the
// geometry assertions below quietly become nonsense.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function actionEvent(
  overrides: Partial<Extract<SequencedBattleEvent, { kind: "action" }>> = {},
): SequencedBattleEvent {
  return {
    kind: "action",
    id: 1,
    turn: 0,
    phase: "OnPlayerTurnStart",
    sourceInstanceId: "p1_duke",
    sourceName: "Duke",
    sourceTeam: "player",
    sourceColor: "red",
    sourceCharacterId: "duke",
    skillName: "Flowing Ruin",
    skillType: "attack",
    isUlt: false,
    rank: 3,
    targets: [
      {
        instanceId: "e1",
        name: "Toll Collector",
        damage: 2140,
        hpBefore: 4000,
        hpAfter: 1860,
      },
    ],
    counters: [],
    ...overrides,
  } as SequencedBattleEvent;
}

function tickEvent(
  overrides: Partial<Extract<SequencedBattleEvent, { kind: "tick" }>> = {},
): SequencedBattleEvent {
  return {
    kind: "tick",
    id: 2,
    turn: 0,
    phase: "OnEnemyTurnEnd",
    label: "DoT",
    targets: [],
    ...overrides,
  } as SequencedBattleEvent;
}

async function renderDrawer(events: SequencedBattleEvent[]) {
  await page.viewport(PHONE.width, PHONE.height);
  // `MotionProvider` is not optional scaffolding here. The panel is an `m.div`
  // entering from `x: "100%"`, and `m` without `LazyMotion` renders the
  // element with its `initial` style and never animates it away — the drawer
  // then sits ~380px off the right edge of a 390px viewport and every
  // geometry assertion below measures a panel the player would never see.
  render(
    <MotionProvider>
      <BattleLogDrawer open events={events} rawLog={[]} onClose={() => {}} />
    </MotionProvider>,
  );
  // Let the enter animation finish before anything is measured.
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  await new Promise((resolve) => setTimeout(resolve, 500));
}

describe("battle log status chips", () => {
  it("shows an applied debuff on the action that caused it", async () => {
    await renderDrawer([
      actionEvent({
        effects: [
          {
            instanceId: "e1",
            name: "Toll Collector",
            applied: [
              {
                slot: "debuff",
                type: "debuff",
                stat: "atk",
                valuePercent: 20,
                duration: 2,
              },
            ],
            removed: [],
          },
        ],
      }),
    ]);

    await expect.element(page.getByText("ATK −20% · 2t")).toBeInTheDocument();
  });

  it("names a character who was never a target", async () => {
    // The reason `effects` is keyed by character rather than nested under
    // `targets`: a self buff belongs to nobody the action hit.
    await renderDrawer([
      actionEvent({
        effects: [
          {
            instanceId: "p1_duke",
            name: "Duke",
            applied: [
              {
                slot: "buff",
                type: "buff",
                stat: "atk",
                valuePercent: 25,
                duration: 3,
              },
            ],
            removed: [],
          },
        ],
      }),
    ]);

    await expect.element(page.getByText("ATK +25% · 3t")).toBeInTheDocument();
    // Twice: once as the action's source, once as the character the status
    // landed on. The second is the row that would not exist if `effects` were
    // nested under `targets`.
    expect(await page.getByText("Duke", { exact: true }).all()).toHaveLength(2);
  });

  it("renders an expiry-only tick, which carries no HP change at all", async () => {
    await renderDrawer([
      tickEvent({
        label: "DoT",
        targets: [],
        effects: [
          {
            instanceId: "e1",
            name: "Toll Collector",
            applied: [],
            removed: [{ slot: "debuff", type: "stun" }],
          },
        ],
      }),
    ]);

    await expect.element(page.getByText("Stunned")).toBeVisible();
  });

  it("strikes a lost effect through, so it cannot read as a gain", async () => {
    await renderDrawer([
      actionEvent({
        effects: [
          {
            instanceId: "e1",
            name: "Toll Collector",
            applied: [],
            removed: [
              { slot: "buff", type: "buff", stat: "def", valuePercent: 30 },
            ],
          },
        ],
      }),
    ]);

    const chip = document.evaluate(
      "//span[text()='DEF +30%']",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    ).singleNodeValue as HTMLElement | null;

    expect(chip).not.toBeNull();
    expect(getComputedStyle(chip!).textDecorationLine).toContain("line-through");
  });

  it("wraps a crowded row instead of scrolling the drawer sideways", async () => {
    // Four chips plus a long name at 390px is the realistic worst case: an
    // ultimate that buffs its user and debuffs everything it touched.
    await renderDrawer([
      actionEvent({
        effects: [
          {
            instanceId: "e1",
            name: "Checkpoint Enforcer",
            applied: [
              { slot: "debuff", type: "debuff", stat: "atk", valuePercent: 30, duration: 2 },
              { slot: "debuff", type: "debuff", stat: "def", valuePercent: 30, duration: 2 },
              {
                slot: "debuff",
                type: "damageOverTime",
                name: "Shock",
                value: 642,
                duration: 4,
              },
              { slot: "debuff", type: "stun", duration: 1 },
            ],
            removed: [
              { slot: "buff", type: "stance", name: "Iron Wall", valuePercent: 50 },
            ],
          },
        ],
      }),
    ]);

    expect(window.innerWidth).toBe(PHONE.width);

    // And the chips genuinely wrapped rather than overflowing their row: more
    // than one distinct top offset among them.
    const chips = [
      ...document.querySelectorAll<HTMLElement>("span.border.px-1"),
    ].filter((el) => el.textContent && el.textContent.includes("·"));
    expect(chips.length).toBeGreaterThan(1);
    const tops = new Set(chips.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(tops.size).toBeGreaterThan(1);

    const rightmost = Math.max(
      ...chips.map((el) => el.getBoundingClientRect().right),
    );
    expect(rightmost).toBeLessThanOrEqual(PHONE.width);
  });
});

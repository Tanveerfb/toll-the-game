import { describe, expect, it } from "vitest";
import {
  pickActiveStep,
  stepApplies,
  tutorialComplete,
  TUTORIAL_STEPS,
  type TutorialContext,
} from "@/lib/tutorial/steps";

/**
 * The first battle's coach marks (2026-08-12).
 *
 * The dangerous failure here isn't a wrong tooltip, it's a tutorial that
 * won't go away — a step that can never be satisfied sits on the screen every
 * turn forever, and one that fires at the wrong moment tells a player to do
 * something the hand can't do.
 */

const IDLE: TutorialContext = {
  playerActing: false,
  handSize: 0,
  mergeAvailable: false,
  queuedActions: 0,
  actionCap: 3,
  hasBench: false,
};

const FIRST_TURN: TutorialContext = {
  ...IDLE,
  playerActing: true,
  handSize: 5,
};

describe("when the coach speaks at all", () => {
  it("says nothing outside the player's turn", () => {
    expect(pickActiveStep({ ...FIRST_TURN, playerActing: false }, {}, false)).toBeNull();
  });

  it("says nothing once dismissed", () => {
    expect(pickActiveStep(FIRST_TURN, {}, true)).toBeNull();
  });

  it("says nothing once every step is seen", () => {
    const seen = Object.fromEntries(TUTORIAL_STEPS.map((s) => [s.id, true]));
    expect(pickActiveStep({ ...FIRST_TURN, mergeAvailable: true, hasBench: true }, seen, false)).toBeNull();
    expect(tutorialComplete(seen)).toBe(true);
  });

  it("shows one step at a time, never two", () => {
    // Three triggers true at once: an untouched hand with a pair in it and a
    // bench unit behind. ("More than one move" needs an action already
    // queued, which is mutually exclusive with the opening step.)
    const busy: TutorialContext = {
      playerActing: true,
      handSize: 6,
      mergeAvailable: true,
      queuedActions: 0,
      actionCap: 3,
      hasBench: true,
    };
    // Authored order wins, so the earliest unseen matching step is the one.
    expect(pickActiveStep(busy, {}, false)?.id).toBe("play-card");
    // The next only arrives once this one is seen — that's what makes it one
    // at a time rather than three cards stacked on the same screen.
    expect(pickActiveStep(busy, { "play-card": true }, false)?.id).toBe(
      "merge",
    );
  });
});

describe("the steps themselves", () => {
  it("opens on the hand", () => {
    expect(pickActiveStep(FIRST_TURN, {}, false)?.id).toBe("play-card");
  });

  it("never tells you to merge a hand that can't merge", () => {
    // The hand is dealt at random; a merge hint on a hand with no pair is
    // an instruction the player cannot follow.
    const seen = { "play-card": true };
    const noPair = { ...FIRST_TURN, queuedActions: 1, mergeAvailable: false };
    expect(pickActiveStep(noPair, seen, false)?.id).not.toBe("merge");
    expect(
      pickActiveStep({ ...noPair, mergeAvailable: true }, seen, false)?.id,
    ).toBe("merge");
  });

  it("explains extra actions only when there are extra actions", () => {
    const seen = { "play-card": true, merge: true };
    const oneAction = {
      ...FIRST_TURN,
      queuedActions: 1,
      actionCap: 1,
    };
    expect(pickActiveStep(oneAction, seen, false)?.id).not.toBe(
      "three-actions",
    );
    expect(
      pickActiveStep({ ...oneAction, actionCap: 3 }, seen, false)?.id,
    ).toBe("three-actions");
  });

  it("mentions the bench only when there is one", () => {
    const seen = { "play-card": true, merge: true, "three-actions": true };
    expect(pickActiveStep(FIRST_TURN, seen, false)).toBeNull();
    expect(
      pickActiveStep({ ...FIRST_TURN, hasBench: true }, seen, false)?.id,
    ).toBe("bench");
  });

  it("points every step at an anchor the battle screen provides", () => {
    // `hand`, `actions` and `team` are `data-tutorial` attributes in
    // Deck.tsx and BattleArena.tsx. A step with any other anchor renders
    // nothing at all, silently.
    const anchors = new Set(["hand", "actions", "team"]);
    for (const step of TUTORIAL_STEPS) {
      expect(anchors.has(step.anchor)).toBe(true);
    }
  });

  it("gives every step a unique id", () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the identity trap that caused an infinite render loop", () => {
  it("returns a NEW object each call, so callers must memoise", () => {
    // 2026-08-13: this was called bare in `BattleCoach`, so `step` changed
    // identity every render, which re-ran the measuring effect, which set
    // state, which rendered again — "Maximum update depth exceeded", in a
    // live battle. The function is fine; the caller has to hold it still.
    const a = pickActiveStep(FIRST_TURN, {}, false);
    const b = pickActiveStep(FIRST_TURN, {}, false);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("is deterministic, which is what makes memoising it safe", () => {
    // If the same inputs could yield different steps, a memo would freeze the
    // wrong one. They can't: selection is a find over a static list.
    const inputs: TutorialContext = {
      ...FIRST_TURN,
      mergeAvailable: true,
      hasBench: true,
    };
    const seen = { "play-card": true };
    const results = Array.from({ length: 5 }, () =>
      pickActiveStep(inputs, seen, false),
    );
    for (const result of results) expect(result).toEqual(results[0]);
  });
});

describe("finishing a step by doing it", () => {
  it("stops applying once a card is queued", () => {
    // This is what marks "Your hand" learned — not the Got it button.
    expect(stepApplies("play-card", FIRST_TURN)).toBe(true);
    expect(stepApplies("play-card", { ...FIRST_TURN, queuedActions: 1 })).toBe(
      false,
    );
  });

  it("stops applying once the pair is merged away", () => {
    const withPair = { ...FIRST_TURN, mergeAvailable: true };
    expect(stepApplies("merge", withPair)).toBe(true);
    expect(stepApplies("merge", { ...withPair, mergeAvailable: false })).toBe(
      false,
    );
  });

  it("stops applying once every action slot is filled", () => {
    const midTurn = { ...FIRST_TURN, queuedActions: 1, actionCap: 3 };
    expect(stepApplies("three-actions", midTurn)).toBe(true);
    expect(stepApplies("three-actions", { ...midTurn, queuedActions: 3 })).toBe(
      false,
    );
  });

  it("returns false for an id that doesn't exist", () => {
    expect(stepApplies("nonsense", FIRST_TURN)).toBe(false);
  });
});

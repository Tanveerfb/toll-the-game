/**
 * The four things a first battle has to explain.
 *
 * A new player reaches their first fight and meets a random-refill hand,
 * adjacent-card merging, three actions from any unit in any order, and an
 * untargetable bench unit — none of it stated anywhere (`docs/STATUS.md`, the
 * FTUE plan). These are the minimum set that can't be learned by poking.
 *
 * **Nothing here gates input.** A step appears when the situation it describes
 * is true and leaves when the player does the thing or dismisses it. A
 * tutorial that blocks input in a game with a randomly dealt hand is a
 * tutorial that softlocks: the pair it wants you to merge might not be there.
 *
 * Pure and data-only so the sequencing is testable without a battle.
 */

/** What the coach can point at. Each value is a `data-tutorial` attribute
 *  somewhere in the battle screen; a step whose anchor is missing is skipped
 *  rather than rendered floating. */
export type TutorialAnchor = "hand" | "actions" | "team";

export interface TutorialStep {
  id: string;
  anchor: TutorialAnchor;
  title: string;
  body: string;
}

/** Everything a step's trigger can read. Flat on purpose — it is assembled
 *  from the battle store once per render and passed in. */
export interface TutorialContext {
  /** The player can act right now. Every step is gated on this. */
  playerActing: boolean;
  handSize: number;
  /** At least one pair in hand could merge. */
  mergeAvailable: boolean;
  queuedActions: number;
  actionCap: number;
  /** A living bench unit exists on the player's side. */
  hasBench: boolean;
}

interface StepDefinition extends TutorialStep {
  /** When this step is worth showing. */
  when: (context: TutorialContext) => boolean;
}

export const TUTORIAL_STEPS: readonly StepDefinition[] = [
  {
    id: "play-card",
    anchor: "hand",
    title: "Your hand",
    body: "Tap a card to queue it. Press and hold one to read what it does before you commit.",
    when: (c) => c.handSize > 0 && c.queuedActions === 0,
  },
  {
    id: "merge",
    anchor: "hand",
    title: "Two of a kind",
    body: "Drag one card onto its match to merge them. The result hits harder — and every merge feeds that character's ultimate gauge.",
    // Only when a pair is actually there. Telling someone to merge a hand
    // that can't merge is worse than saying nothing.
    when: (c) => c.mergeAvailable,
  },
  {
    id: "three-actions",
    anchor: "actions",
    title: "More than one move",
    body: "You get several actions a turn, and they can come from any character in any order — not one each.",
    when: (c) => c.actionCap > 1 && c.queuedActions > 0 && c.queuedActions < c.actionCap,
  },
  {
    id: "bench",
    anchor: "team",
    title: "Someone's on the bench",
    body: "Your fourth unit isn't on the field. Its passive still works, it can't be hit, and it steps in when a teammate falls.",
    when: (c) => c.hasBench,
  },
];

export function getTutorialStep(id: string): TutorialStep | undefined {
  return TUTORIAL_STEPS.find((step) => step.id === id);
}

/**
 * Whether a step's situation still holds.
 *
 * This is how a step is *completed by doing it*: "Your hand" stops applying
 * the moment a card is queued, and that — not the Got it button — is what
 * marks it learned. Without this the player would queue a card, watch the
 * hint vanish, and meet it again next turn.
 */
export function stepApplies(id: string, context: TutorialContext): boolean {
  const step = TUTORIAL_STEPS.find((candidate) => candidate.id === id);
  return step ? step.when(context) : false;
}

/**
 * The one step to show right now, or null.
 *
 * At most one at a time, in authored order: a screen with two coach marks on
 * it is a screen you close rather than read. A step that has been seen never
 * returns, so this converges on null and the tutorial ends by itself.
 */
export function pickActiveStep(
  context: TutorialContext,
  seen: Record<string, boolean>,
  dismissed: boolean,
): TutorialStep | null {
  if (dismissed || !context.playerActing) return null;
  const step = TUTORIAL_STEPS.find(
    (candidate) => seen[candidate.id] !== true && candidate.when(context),
  );
  if (!step) return null;
  // Returned without its trigger: a step's `when` is the catalogue's business,
  // and handing a predicate to the component invites it to be re-evaluated
  // somewhere the context isn't the real one.
  return {
    id: step.id,
    anchor: step.anchor,
    title: step.title,
    body: step.body,
  };
}

/** True once every step has been seen — used to stop doing any of this work. */
export function tutorialComplete(seen: Record<string, boolean>): boolean {
  return TUTORIAL_STEPS.every((step) => seen[step.id] === true);
}

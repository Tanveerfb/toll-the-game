import type { ActionCard } from "@/types/action";

/**
 * Turning a deal's frames into a schedule.
 *
 * `refillHand` hands back the hand after every draw and every merge
 * (`RefillResult.steps`). This decides how long each of those frames stays on
 * screen, and it is deliberately pure so the pacing is testable without a DOM,
 * a clock, or React — the same split the battle sequencer uses.
 *
 * Timings were chosen against the mockup Tanveer signed off on 2026-08-12
 * ("smooth but crisp"): draws land fast on top of each other, but a card that
 * is about to merge gets a beat alone first, because the collision is the
 * thing worth seeing.
 */

/** Gap between two cards arriving. */
export const DEAL_STAGGER_MS = 55;

/** How long a card that is about to merge sits alone first. Without this the
 *  collision starts before the eye has registered the card that caused it. */
export const MERGE_BEAT_MS = 140;

/** Fly-in plus the receiving card's punch — how long a collision owns the
 *  screen before the next frame may start. */
export const MERGE_SETTLE_MS = 320;

export type DealFrameKind = "draw" | "merge";

export interface DealFrame {
  kind: DealFrameKind;
  hand: ActionCard[];
  /** Wait this long after showing this frame before showing the next one. */
  holdMs: number;
}

export interface DealTimelineOptions {
  /** The battle-speed multiplier. Higher is faster. */
  speed?: number;
  /** `prefers-reduced-motion`, or the player turning animation off. */
  reduced?: boolean;
  /**
   * How many cards were in the hand before the deal began. Only the first
   * frame's classification depends on it, and a deal always opens on a draw,
   * so the default is "one fewer than the first frame".
   */
  startLength?: number;
}

/**
 * A frame is a merge when the hand got shorter — cards only ever leave a hand
 * mid-deal by being consumed into their twin.
 */
function frameKind(hand: ActionCard[], previousLength: number): DealFrameKind {
  return hand.length < previousLength ? "merge" : "draw";
}

/**
 * Schedule the frames of one deal.
 *
 * Reduced motion collapses to a single frame — the settled hand — so the
 * player still ends up looking at the truth, just without the journey.
 * An empty `steps` yields an empty timeline, which the caller reads as
 * "nothing to play".
 */
export function buildDealTimeline(
  steps: ActionCard[][],
  options: DealTimelineOptions = {},
): DealFrame[] {
  if (steps.length === 0) return [];

  const {
    speed = 1,
    reduced = false,
    startLength = steps[0].length - 1,
  } = options;
  if (reduced) {
    return [{ kind: "draw", hand: steps[steps.length - 1], holdMs: 0 }];
  }

  const scale = speed > 0 ? 1 / speed : 1;
  const kinds = steps.map((hand, index) =>
    frameKind(hand, index === 0 ? startLength : steps[index - 1].length),
  );

  return steps.map((hand, index) => {
    const isLast = index === steps.length - 1;
    const nextIsMerge = !isLast && kinds[index + 1] === "merge";

    let holdMs: number;
    if (isLast) {
      holdMs = 0;
    } else if (kinds[index] === "merge") {
      holdMs = MERGE_SETTLE_MS;
    } else {
      holdMs = nextIsMerge ? MERGE_BEAT_MS : DEAL_STAGGER_MS;
    }

    return { kind: kinds[index], hand, holdMs: Math.round(holdMs * scale) };
  });
}

/** Total wall time of a timeline — used by tests and by anything that needs to
 *  know when the hand becomes interactive. */
export function dealDurationMs(timeline: DealFrame[]): number {
  return timeline.reduce((total, frame) => total + frame.holdMs, 0);
}

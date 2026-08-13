import type { ActionCard } from "@/types/action";
import { canCardsAutoMerge } from "@/lib/game/deck";

/**
 * Why a card left the hand.
 *
 * The hand animates a departure differently depending on the reason — a merged
 * card flies into the twin that ate it, a played card leaves upward toward the
 * action queue — and the DOM alone can't tell them apart: both are just an id
 * that stopped being rendered.
 *
 * Kept pure and out of the component so the rule is testable without a
 * browser, and so the animation can never disagree with the engine about what
 * happened.
 */

export type CardExit =
  | { kind: "merged"; intoCardId: string }
  | { kind: "left" };

/**
 * A merge is the only way a card leaves while another card *gains* a rank.
 * The survivor keeps its id (both `applyAdjacentMerges` and `mergeDeckCard`
 * spread the base card), so the test is: same owner, same skill, and one rank
 * higher than that very card was a moment ago.
 */
export function classifyExit(
  removed: ActionCard,
  before: ActionCard[],
  after: ActionCard[],
): CardExit {
  const rankBefore = new Map(before.map((c) => [c.id, c.rank]));

  const survivor = after.find((candidate) => {
    const previousRank = rankBefore.get(candidate.id);
    if (previousRank === undefined) return false;
    if (candidate.rank !== previousRank + 1) return false;
    return (
      candidate.sourceInstanceId === removed.sourceInstanceId &&
      candidate.skill.skillName === removed.skill.skillName
    );
  });

  return survivor ? { kind: "merged", intoCardId: survivor.id } : { kind: "left" };
}

/** Ids present before and gone after. Order follows `before`, so a cascade
 *  animates left to right the way it resolved. */
export function removedCardIds(
  before: ActionCard[],
  after: ActionCard[],
): string[] {
  const surviving = new Set(after.map((c) => c.id));
  return before.filter((c) => !surviving.has(c.id)).map((c) => c.id);
}

/**
 * Every card in the hand that `card` could merge with right now.
 *
 * Deliberately delegates to `canCardsAutoMerge` rather than restating the
 * rule: the highlight a player sees while holding a card has to mean exactly
 * what the engine will do, including the equal-rank requirement that the old
 * always-on merge ring quietly ignored.
 */
export function mergePartnerIds(card: ActionCard, hand: ActionCard[]): string[] {
  return hand
    .filter((other) => other.id !== card.id && canCardsAutoMerge(card, other))
    .map((other) => other.id);
}

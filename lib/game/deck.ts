import type { ActionCard } from "@/types/action";
import type { BattleCharacter } from "@/types/character";
import { ultGaugeMax } from "@/lib/game/ultGauge";

// Shared deck logic for BOTH sides (7DS GC rules). The player hand lives in
// gameStore and the enemy hand is driven by the battle loop, but the merge and
// RNG-refill behavior is identical — extracted here so there's one source of
// truth and the enemy deck is provably "fair like the player deck".

export function canCardsAutoMerge(left: ActionCard, right: ActionCard): boolean {
  return (
    left.rank < 3 &&
    right.rank < 3 &&
    left.sourceInstanceId === right.sourceInstanceId &&
    left.skill.skillName === right.skill.skillName &&
    left.rank === right.rank
  );
}

export interface MergeResult {
  deck: ActionCard[];
  mergeCount: number;
  mergeSourceIds: string[];
  notices: string[];
  /**
   * The hand after each individual merge, oldest first — the frames the UI
   * needs to show a merge actually happening.
   *
   * Merges resolve in a single pass here, so without this the caller only ever
   * receives the settled hand and the cards that collided were never on screen
   * to collide (Tanveer, 2026-08-12: "cards auto merging too" should animate).
   * Empty when nothing merged, so a caller that ignores it pays nothing.
   */
  steps: ActionCard[][];
}

/** Walk the hand left-to-right, merging adjacent identical cards up a rank
 * (cap R3). Each merge grants its source unit +1 ult gauge (mergeSourceIds). */
export function applyAdjacentMerges(cards: ActionCard[]): MergeResult {
  const next = [...cards];
  const mergeSourceIds: string[] = [];
  const notices: string[] = [];
  const steps: ActionCard[][] = [];
  let mergeCount = 0;

  let index = 0;
  while (index < next.length - 1) {
    const current = next[index];
    const neighbor = next[index + 1];

    if (!canCardsAutoMerge(current, neighbor)) {
      index += 1;
      continue;
    }

    const newRank = Math.min(3, current.rank + 1) as 1 | 2 | 3;
    next[index] = { ...current, rank: newRank };
    next.splice(index + 1, 1);

    mergeCount += 1;
    mergeSourceIds.push(current.sourceInstanceId);
    notices.push(`${current.skill.skillName} auto-merged to R${newRank}.`);
    steps.push([...next]);

    if (index > 0) index -= 1;
  }

  return { deck: next, mergeCount, mergeSourceIds, notices, steps };
}

/**
 * Take back ultimate cards whose owner is no longer fully charged.
 *
 * An ultimate is dealt only at a full gauge (`refillHand`), but nothing used to
 * reconsider that once the card was in hand — so draining a gauge with
 * `lowerUltGauge` (Mustafa) left the ultimate sitting there, playable at 4/5
 * (Tanveer, 2026-08-13). An ultimate cannot be used below a full gauge, so the
 * card leaves.
 *
 * It isn't lost: the next refill deals it again the moment the gauge fills,
 * which is exactly what `ultEligible` already does.
 *
 * Returns the original array when nothing was dropped, so callers can skip a
 * pointless commit.
 */
export function dropUnchargedUltimates(
  cards: ActionCard[],
  units: BattleCharacter[],
): ActionCard[] {
  const charged = new Map(
    units.map((unit) => [unit.instanceId, unit.ultGauge >= ultGaugeMax(unit)]),
  );
  const kept = cards.filter((card) => {
    if (card.skill.type !== "ultimate") return true;
    // An owner missing from `units` (dead and already cleared, say) is left
    // alone here — removing that card is `removeDeadCharacterCards`' job, and
    // guessing at it from an absent unit would be the wrong reason.
    return charged.get(card.sourceInstanceId) !== false;
  });
  return kept.length === cards.length ? cards : kept;
}

/**
 * Move one card to another card's slot.
 *
 * Lives here rather than in the store because the hand needs the *same*
 * function to preview a drag before it is dropped — a preview computed by a
 * second implementation is a preview that can lie about where the card lands
 * (2026-08-12).
 *
 * Returns the original array when the move is a no-op, so callers can use
 * identity to detect "nothing happened".
 */
export function moveCardById(
  cards: ActionCard[],
  draggedCardId: string,
  targetCardId: string,
): ActionCard[] {
  if (draggedCardId === targetCardId) return cards;

  const fromIndex = cards.findIndex((c) => c.id === draggedCardId);
  const toIndex = cards.findIndex((c) => c.id === targetCardId);
  if (fromIndex === -1 || toIndex === -1) return cards;

  const reordered = [...cards];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

// Hand capacity by living field-unit count: 1/2/3/4 units -> 4/5/7/8 cards.
const MAX_CAPACITY_MAP = [0, 4, 5, 7, 8];

export function maxHandCapacity(fieldCount: number): number {
  return MAX_CAPACITY_MAP[fieldCount] ?? 8;
}

function newCardId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/** One card per skill of each living field unit, all at rank 1. */
export function initialCardsFor(livingUnits: BattleCharacter[]): ActionCard[] {
  const cards: ActionCard[] = [];
  livingUnits.forEach((unit) => {
    unit.skills.forEach((skill) => {
      cards.push({
        id: newCardId(),
        sourceInstanceId: unit.instanceId,
        skill,
        rank: 1,
      });
    });
  });
  return cards;
}

/**
 * Player-facing Preview hand (spec §7): a deterministic, hardcoded deck that
 * exposes EVERY skill at EVERY rank (R1/R2/R3) plus the ultimate, all at once,
 * so the player can preview any ability/rank without grinding merges or waiting
 * on the ult gauge. Unlike a normal battle hand this is never RNG-refilled —
 * drawCards() no-ops in preview mode so the full set stays put.
 */
export function previewCardsFor(livingUnits: BattleCharacter[]): ActionCard[] {
  const cards: ActionCard[] = [];
  livingUnits.forEach((unit) => {
    unit.skills.forEach((skill) => {
      ([1, 2, 3] as const).forEach((rank) => {
        cards.push({
          id: newCardId(),
          sourceInstanceId: unit.instanceId,
          skill,
          rank,
        });
      });
    });
    if (unit.ultimate) {
      cards.push({
        id: newCardId(),
        sourceInstanceId: unit.instanceId,
        skill: unit.ultimate,
        rank: 1,
      });
    }
  });
  return cards;
}

/** Per-source ult-gauge gains from a set of merges. */
export function gaugeGainsFromMerges(mergeSourceIds: string[]): Record<string, number> {
  const gains: Record<string, number> = {};
  mergeSourceIds.forEach((id) => {
    gains[id] = (gains[id] ?? 0) + 1;
  });
  return gains;
}

export interface RefillResult {
  deck: ActionCard[];
  gaugeGains: Record<string, number>;
  notices: string[];
  mergeCount: number;
  /**
   * The hand after every draw and every merge, in the order they happened —
   * the deal, frame by frame.
   *
   * The refill loop draws and merges in one pass, so a card that merged on
   * landing was never in a hand the UI could render. Handing back the
   * intermediate hands lets the deal play out instead of appearing finished
   * (the same shape as the battle sequencer's event playback). The last step
   * always equals `deck`; a caller that ignores this — the enemy side does —
   * behaves exactly as before.
   */
  steps: ActionCard[][];
}

/**
 * Fill a hand to capacity by drawing one card at a time, purely at random from
 * the living field units' skill pools, auto-merging adjacent identical cards as
 * they land (7DS GC). A unit whose ult gauge was full BEFORE this refill (and
 * which has no ult card already reserved) is guaranteed one ultimate card this
 * refill. Returns the filled hand + per-unit gauge gains from merges.
 */
export function refillHand(params: {
  hand: ActionCard[];
  livingUnits: BattleCharacter[];
  maxCapacity: number;
  reservedCards: ActionCard[];
}): RefillResult {
  const { hand, livingUnits, maxCapacity, reservedCards } = params;

  let currentDeck = [...hand];
  const gaugeGains: Record<string, number> = {};
  const notices: string[] = [];
  const steps: ActionCard[][] = [];
  let mergeCount = 0;

  const pool = livingUnits.flatMap((unit) =>
    unit.skills.map((skill) => ({ unitId: unit.instanceId, skill })),
  );
  if (pool.length === 0 || currentDeck.length >= maxCapacity) {
    return { deck: currentDeck, gaugeGains, notices, mergeCount, steps };
  }

  // Ult eligibility snapshotted BEFORE the refill: a gauge filled by merges
  // during this refill guarantees the ult on the NEXT refill, never this one.
  const ultEligible = new Set(
    livingUnits
      .filter(
        (unit) =>
          unit.ultGauge >= ultGaugeMax(unit) &&
          unit.ultimate &&
          !reservedCards.some(
            (card) =>
              card.sourceInstanceId === unit.instanceId &&
              card.skill.type === "ultimate",
          ),
      )
      .map((unit) => unit.instanceId),
  );

  const nextCard = (): ActionCard => {
    const ultReadyId = livingUnits.find((u) => ultEligible.has(u.instanceId))
      ?.instanceId;
    if (ultReadyId) {
      ultEligible.delete(ultReadyId);
      const owner = livingUnits.find((u) => u.instanceId === ultReadyId)!;
      return {
        id: newCardId(),
        sourceInstanceId: owner.instanceId,
        skill: owner.ultimate!,
        rank: 1,
      };
    }
    const picked = pool[Math.floor(Math.random() * pool.length)];
    return {
      id: newCardId(),
      sourceInstanceId: picked.unitId,
      skill: picked.skill,
      rank: 1,
    };
  };

  while (currentDeck.length < maxCapacity) {
    currentDeck.push(nextCard());
    // The card lands as its own frame before any merge is applied, so the UI
    // can show it arriving and only then colliding.
    steps.push([...currentDeck]);
    const merged = applyAdjacentMerges(currentDeck);
    currentDeck = merged.deck;
    if (merged.mergeCount > 0) {
      mergeCount += merged.mergeCount;
      notices.push(...merged.notices);
      steps.push(...merged.steps);
      merged.mergeSourceIds.forEach((id) => {
        gaugeGains[id] = (gaugeGains[id] ?? 0) + 1;
      });
    }
  }

  return { deck: currentDeck, gaugeGains, notices, mergeCount, steps };
}

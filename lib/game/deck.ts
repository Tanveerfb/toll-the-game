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
}

/** Walk the hand left-to-right, merging adjacent identical cards up a rank
 * (cap R3). Each merge grants its source unit +1 ult gauge (mergeSourceIds). */
export function applyAdjacentMerges(cards: ActionCard[]): MergeResult {
  const next = [...cards];
  const mergeSourceIds: string[] = [];
  const notices: string[] = [];
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

    if (index > 0) index -= 1;
  }

  return { deck: next, mergeCount, mergeSourceIds, notices };
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
  let mergeCount = 0;

  const pool = livingUnits.flatMap((unit) =>
    unit.skills.map((skill) => ({ unitId: unit.instanceId, skill })),
  );
  if (pool.length === 0 || currentDeck.length >= maxCapacity) {
    return { deck: currentDeck, gaugeGains, notices, mergeCount };
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
    const merged = applyAdjacentMerges(currentDeck);
    currentDeck = merged.deck;
    if (merged.mergeCount > 0) {
      mergeCount += merged.mergeCount;
      notices.push(...merged.notices);
      merged.mergeSourceIds.forEach((id) => {
        gaugeGains[id] = (gaugeGains[id] ?? 0) + 1;
      });
    }
  }

  return { deck: currentDeck, gaugeGains, notices, mergeCount };
}

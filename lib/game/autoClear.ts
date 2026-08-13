import { STAMINA_CAP } from "@/lib/game/stamina";
import { tierKey } from "@/lib/game/worldBossRewards";

/**
 * Auto Clear — skipping a fight you have already won.
 *
 * Tanveer rejected auto-battle because it needs a player-side AI, which has to
 * handle 27 kits, ally targeting, ult timing and merges, and would be judged
 * against how he plays. Auto Clear answers the same problem without simulating
 * anything: it pays the cost of a fight and grants its reward.
 *
 * The load-bearing rule, in his words — auto clear *"would still use same
 * amount of sta it needs for each instance of fights it's skipping"*. Stamina
 * stays the only throughput gate, so a ticket buys **time, never resources**:
 * it cannot produce a single material the player could not have farmed by
 * sitting through the fights. That is what makes full rewards safe.
 *
 * Design: `docs/superpowers/specs/2026-08-13-auto-clear-design.md`.
 */

/** Granted per account rank gained. Per RANK, not per XP grant — see
 *  `grantAccountXpAction`, where one call can cross several ranks. */
export const AUTO_CLEAR_TICKETS_PER_RANK = 5;

/**
 * An auto-cleared run is **never** a first clear.
 *
 * Guaranteed by the unlock gate rather than asserted: Auto Clear requires a
 * manual clear of that event first, so by the time a ticket can be spent the
 * first clear has already been paid. Named as a constant so the reward call
 * reads as a rule instead of a bare `false` (Tanveer, 2026-08-13 — gems are a
 * first-clear reward and must never be grindable).
 */
export const AUTO_CLEAR_IS_NEVER_FIRST_CLEAR = false;

export interface AutoClearAvailability {
  /** The event allows Auto Clear at all (`autoClearEligible` in the registry). */
  eligible: boolean;
  /** The player has beaten THIS DIFFICULTY manually at least once. */
  unlocked: boolean;
  tickets: number;
  stamina: number;
  staminaCost: number;
  /** Runs the player can actually pay for right now. */
  affordable: number;
  /** Why `affordable` is 0, for the UI to say out loud. Null when it isn't. */
  blocker: "ineligible" | "locked" | "no-tickets" | "no-stamina" | null;
}

export interface AutoClearInput {
  eligible: boolean;
  clearedEvents: readonly string[];
  eventId: string;
  /**
   * Which tier is being auto-cleared. The unlock is **per difficulty**
   * (Tanveer, 2026-08-13) — clearing Molvarr at world level 1 must not let you
   * farm the world-level-4 fight, whose table is strictly better. This is what
   * keeps difficulty honest now that it pays through content rather than a
   * multiplier.
   */
  difficulty: number;
  tickets: number;
  stamina: number;
  staminaCost: number;
}

/**
 * What the player can do with this event right now.
 *
 * Reports a single blocker rather than a list: a screen that says "you need
 * tickets and stamina and you haven't cleared it" is noise. The order below is
 * the order the player can act on them — an ineligible event can never be
 * auto-cleared, an unbeaten one needs a fight, and only then do resources
 * matter.
 */
export function autoClearAvailability({
  eligible,
  clearedEvents,
  eventId,
  difficulty,
  tickets,
  stamina,
  staminaCost,
}: AutoClearInput): AutoClearAvailability {
  const unlocked = clearedEvents.includes(tierKey(eventId, difficulty));
  const base = { eligible, unlocked, tickets, stamina, staminaCost };

  if (!eligible) {
    return { ...base, affordable: 0, blocker: "ineligible" };
  }
  if (!unlocked) {
    return { ...base, affordable: 0, blocker: "locked" };
  }
  if (tickets < 1) {
    return { ...base, affordable: 0, blocker: "no-tickets" };
  }

  const affordable = runsAffordable(tickets, stamina, staminaCost);
  return {
    ...base,
    affordable,
    blocker: affordable === 0 ? "no-stamina" : null,
  };
}

/**
 * How many runs the player can pay for, limited by whichever runs out first.
 *
 * A zero or negative stamina cost would divide badly and, more importantly,
 * would mean an event with no gate — the ticket count alone would cap it.
 */
export function runsAffordable(
  tickets: number,
  stamina: number,
  staminaCost: number,
): number {
  if (tickets < 1) return 0;
  if (staminaCost <= 0) return Math.max(0, Math.floor(tickets));
  return Math.max(0, Math.min(Math.floor(tickets), Math.floor(stamina / staminaCost)));
}

/**
 * The most runs worth offering in one batch.
 *
 * Capped at a full bar's worth even when the player holds more tickets: a
 * rank-up mid-batch refills stamina, so an unbounded batch could silently run
 * far longer than the player agreed to. They can always start another.
 */
export function maxBatchSize(staminaCost: number): number {
  if (staminaCost <= 0) return 1;
  return Math.max(1, Math.floor(STAMINA_CAP / staminaCost));
}

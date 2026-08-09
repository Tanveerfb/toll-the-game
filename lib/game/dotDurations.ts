import type { Mechanic } from "@/types/mechanic";

/**
 * House defaults for damage-over-time durations (Tanveer, 2026-08-09):
 * every Ignite lasts 3 turns and every Bleed 2, unless the kit says otherwise.
 *
 * These were previously inline magic numbers at the point of application in
 * `combat.ts` — ignite defaulted to 3 there, bleed to 1 — and nothing outside
 * combat could see them, so a skill description had no way to state a duration
 * the kit hadn't spelled out.
 */
export const DEFAULT_IGNITE_TURNS = 3;
export const DEFAULT_BLEED_TURNS = 2;

export type DotType = "ignite" | "bleed";

export function defaultDotTurns(type: DotType): number {
  return type === "ignite" ? DEFAULT_IGNITE_TURNS : DEFAULT_BLEED_TURNS;
}

/**
 * The duration a DoT mechanic actually applies for at `rankIndex`.
 *
 * Precedence: an explicit per-rank `durationRanked` entry, then a flat
 * `duration`, then the house default. `durationRanked` is checked first
 * because a kit that bothers to scale duration by rank means it (Leorio's
 * Bleed is [1, 1, 2]).
 */
export function resolveDotDuration(
  // Accepts the loose `Record<string, unknown>` shape the description
  // translator carries as well as a typed Mechanic — both call sites are real.
  mechanic: Mechanic | Record<string, unknown>,
  rankIndex = 0,
): number {
  const m = mechanic as {
    type: string;
    duration?: number;
    durationRanked?: number[];
  };
  const ranked = m.durationRanked?.[rankIndex];
  if (typeof ranked === "number") return ranked;
  if (typeof m.duration === "number") return m.duration;
  return defaultDotTurns(m.type === "ignite" ? "ignite" : "bleed");
}

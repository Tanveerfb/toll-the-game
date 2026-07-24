import type { Color } from "@/types/color";

/**
 * Reveal escalation tiers (2026-07-24 battle UI overhaul, spec §2). Animation
 * intensity scales by the played card's significance — a pure mapping from
 * (rank, ultimate flag, and whether this is an automatic secondary hit like a
 * counter) to a reveal-tier descriptor the sequencer/overlay render from.
 *
 * "Basic" has no dedicated card type in the engine today (every played card
 * is a ranked skill or an ultimate) — it's driven by `isBasic`, used for
 * automatic secondary hits (counters) that already "fire constantly, stay
 * cheap" the same way the spec's basic-attack row describes.
 */

export type RevealTier = "basic" | "r1" | "r2" | "r3" | "ultimate";

export interface RevealDescriptor {
  tier: RevealTier;
  /** Element color driving every effect's tint — passed through untouched. */
  color: Color;
  /** Relative size of the projectile/burst visuals for this tier. */
  projectile: "tiny" | "small" | "medium" | "large" | "mega";
  /** Whether the impact burst ring uses the bigger/brighter "strong" style. */
  burstStrong: boolean;
  /** Per-target tile shake. */
  shake: "none" | "light" | "heavy";
  /** Stage-wide flash treatment. */
  flash: "none" | "pulse" | "brief" | "white";
  /** Caster wind-up beat before the attack flies out (R3+). */
  windUp: boolean;
  /** Beam-style sweep from caster to target(s), not just an AoE streak (R3+). */
  beamSweep: boolean;
  /** Full cutscene moment: dim -> slam-in + name banner -> restore. Ultimate only. */
  cutscene: boolean;
}

const BASIC: Omit<RevealDescriptor, "color"> = {
  tier: "basic",
  projectile: "tiny",
  burstStrong: false,
  shake: "none",
  flash: "none",
  windUp: false,
  beamSweep: false,
  cutscene: false,
};

const R1: Omit<RevealDescriptor, "color"> = {
  tier: "r1",
  projectile: "small",
  burstStrong: false,
  shake: "none",
  flash: "none",
  windUp: false,
  beamSweep: false,
  cutscene: false,
};

const R2: Omit<RevealDescriptor, "color"> = {
  tier: "r2",
  projectile: "medium",
  burstStrong: true,
  shake: "light",
  flash: "pulse",
  windUp: false,
  beamSweep: false,
  cutscene: false,
};

const R3: Omit<RevealDescriptor, "color"> = {
  tier: "r3",
  projectile: "large",
  burstStrong: true,
  shake: "heavy",
  flash: "brief",
  windUp: true,
  beamSweep: true,
  cutscene: false,
};

const ULTIMATE: Omit<RevealDescriptor, "color"> = {
  tier: "ultimate",
  projectile: "mega",
  burstStrong: true,
  shake: "heavy",
  flash: "white",
  windUp: true,
  beamSweep: true,
  cutscene: true,
};

export interface RevealTierInput {
  rank: 1 | 2 | 3;
  isUltimate: boolean;
  /** Automatic secondary hit (e.g. a counter) — forced to the "basic" tier. */
  isBasic?: boolean;
  color: Color;
}

/**
 * Resolve the reveal-tier descriptor for a played action. Ultimate always
 * wins regardless of the rank carried alongside it (an ultimate card isn't
 * "rank 3", it's its own class) — checked before `isBasic`.
 */
export function getRevealTier(input: RevealTierInput): RevealDescriptor {
  if (input.isUltimate) {
    return { ...ULTIMATE, color: input.color };
  }
  if (input.isBasic) {
    return { ...BASIC, color: input.color };
  }
  switch (input.rank) {
    case 1:
      return { ...R1, color: input.color };
    case 2:
      return { ...R2, color: input.color };
    case 3:
    default:
      return { ...R3, color: input.color };
  }
}

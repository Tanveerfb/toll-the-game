/**
 * Card frame styling — "Clean" style (2026-07-24 battle UI overhaul, spec §3).
 * Rank reads at a glance via border color/weight, not text: thin bronze (R1)
 * -> thin silver (R2) -> gold + top accent bar (R3). Ultimate is its own
 * frame class (cyan/frost + accent bar) — not "beyond gold," a separate tier.
 */

export type CardFrameTier = "r1" | "r2" | "r3" | "ultimate";

export interface CardFrameStyle {
  tier: CardFrameTier;
  /** Border width + color classes for the card frame. */
  borderClass: string;
  /** Top accent bar classes (background color). Absent for R1/R2. */
  accentBarClass?: string;
  /** Rank ladder position, 1-3, independent of the ultimate flag. */
  starCount: 1 | 2 | 3;
}

const R1_STYLE: Omit<CardFrameStyle, "starCount"> = {
  tier: "r1",
  borderClass: "border border-amber-700",
};

const R2_STYLE: Omit<CardFrameStyle, "starCount"> = {
  tier: "r2",
  borderClass: "border border-zinc-400",
};

const R3_STYLE: Omit<CardFrameStyle, "starCount"> = {
  tier: "r3",
  borderClass: "border-2 border-yellow-400",
  accentBarClass: "bg-yellow-400",
};

const ULTIMATE_STYLE: Omit<CardFrameStyle, "starCount"> = {
  tier: "ultimate",
  borderClass: "border-2 border-cyan-300",
  accentBarClass: "bg-cyan-300",
};

/**
 * Given a card's rank (1-3) and whether it's an ultimate, return the frame
 * styling to apply. Ultimate is checked first — it's a distinct frame class
 * regardless of the numeric rank carried alongside it.
 */
export function getCardFrameStyle(
  rank: 1 | 2 | 3,
  isUltimate: boolean,
): CardFrameStyle {
  if (isUltimate) {
    return { ...ULTIMATE_STYLE, starCount: rank };
  }
  switch (rank) {
    case 1:
      return { ...R1_STYLE, starCount: 1 };
    case 2:
      return { ...R2_STYLE, starCount: 2 };
    case 3:
    default:
      return { ...R3_STYLE, starCount: 3 };
  }
}

/**
 * Card frame styling — "Clean" style (2026-07-24 battle UI overhaul, spec §3).
 * Rank reads at a glance via border color/weight, not text.
 *
 * Retuned onto the palette tokens 2026-08-11. The ladder was bronze -> silver
 * -> gold with a cyan "frost" frame for ultimates, and both ends had become
 * collisions: cyan is now system chrome (the rail, End Turn, active state),
 * and gold is the ultimate's colour everywhere else on the screen — on the
 * tile's ULT READY flag and on the queue chip. So the merge ladder is one
 * achromatic ramp (dim -> strong -> bright readout) and gold belongs solely
 * to the ultimate, which is a separate tier, not "beyond R3".
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
  borderClass: "border border-edge",
};

const R2_STYLE: Omit<CardFrameStyle, "starCount"> = {
  tier: "r2",
  borderClass: "border border-edge-strong",
};

const R3_STYLE: Omit<CardFrameStyle, "starCount"> = {
  tier: "r3",
  borderClass: "border-2 border-readout",
  accentBarClass: "bg-readout",
};

const ULTIMATE_STYLE: Omit<CardFrameStyle, "starCount"> = {
  tier: "ultimate",
  borderClass: "border-2 border-el-light",
  accentBarClass: "bg-el-light",
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

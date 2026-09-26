import { INK_TONE } from "@/components/ui/inkTone";

/**
 * The growth modal's shared states, drawn for paper (ruling #154).
 *
 * The four growth files (`LevelTab`, `AscendTab`, `UltimateTab`, `StatDelta`)
 * used colour to say the same five things: where you are, what you are about
 * to reach, what you picked, what you are short of, and a note. Under Combat
 * Terminal that was cyan text, green text and red text on a dark panel. On
 * paper a hue does not read as text (docs/design-system.md), so each state is
 * a FILL with ink on it, defined here once rather than retyped per tab.
 *
 * Notes (info, neutral, blocker) are not here: they are the shadcn `Alert`
 * (`components/ui/alert.tsx`), which the event brief uses too.
 */
export const GROWTH = {
  /** The big "where you are" number. */
  big: "font-heading text-2xl tracking-title",
  /** The arrow and the cap beside it. */
  quiet: "font-body text-xs text-muted-foreground",
  /** A number you are about to reach: green fill, ink on it. */
  gain: INK_TONE.gain,
  /** A small uppercase label above a group. */
  label: "font-body text-label font-bold uppercase tracking-label text-muted-foreground",
  /** A line of explanation under a group. */
  hint: "font-body text-caption leading-snug text-muted-foreground",

  /** A ladder tile's shape; pair with one of the three states below. */
  tile: "flex min-h-11 flex-1 shrink-0 flex-col items-center justify-center border-2 px-1.5 py-1",
  /** Where the character is now: the action yellow, as a wash. */
  tileNow: "border-border bg-primary/40",
  /** Bought by this plan, or the next tier: green wash. */
  tileNext: "border-border bg-role-heal/35",
  /** Any other step. */
  tileIdle: "border-rule bg-muted",
  tileLabel: "font-body text-label font-bold uppercase tracking-label",
  tileValue: "font-heading text-base leading-none tracking-title",
} as const;

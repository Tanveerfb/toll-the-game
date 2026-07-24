import type { Color } from "@/types/color";

/** Element crest/dot fill color, shared across battle tiles and hand cards. */
export const ELEMENT_SWATCH: Record<Color, string> = {
  red: "bg-rose-500",
  blue: "bg-sky-500",
  green: "bg-emerald-500",
  dark: "bg-violet-500",
  light: "bg-amber-300",
};

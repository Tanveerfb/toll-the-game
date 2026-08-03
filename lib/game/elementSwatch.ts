import type { Color } from "@/types/color";

/** Element crest/dot fill color, shared across battle tiles and hand cards. */
export const ELEMENT_SWATCH: Record<Color, string> = {
  red: "bg-rose-500",
  blue: "bg-sky-500",
  green: "bg-emerald-500",
  dark: "bg-violet-500",
  light: "bg-amber-300",
};

/**
 * Translucent element tint for battle VFX — impact flashes, stage flashes,
 * burst rings and sweeps. Raw CSS colors rather than Tailwind classes because
 * they're composed into gradients and box-shadows at runtime.
 *
 * Per-character flavors in `lib/game/characterVfx.ts` deliberately pick tints
 * AWAY from these: a flavor landing on the same hue as its owner's element
 * tint is invisible.
 */
export const FLASH_TINTS: Record<Color, string> = {
  red: "rgba(244,63,94,0.55)",
  blue: "rgba(56,189,248,0.55)",
  green: "rgba(52,211,153,0.5)",
  dark: "rgba(167,139,250,0.55)",
  light: "rgba(252,211,77,0.55)",
};

/** Tile border color per element. */
export function getUnitBorderClass(color: Color): string {
  switch (color) {
    case "red":
      return "border-rose-400/80";
    case "blue":
      return "border-sky-400/80";
    case "green":
      return "border-emerald-400/80";
    case "dark":
      return "border-violet-400/80";
    case "light":
    default:
      return "border-amber-300/80";
  }
}

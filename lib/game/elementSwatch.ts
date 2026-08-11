import type { Color } from "@/types/color";

/**
 * Element crest/dot fill color, shared across battle tiles and hand cards.
 *
 * On the `--color-el-*` tokens since 2026-08-11. These were the last place
 * still returning Tailwind `rose/sky/emerald/violet/amber`, which meant the
 * five element hues rendered at one set of values in the archive and a
 * slightly different set in battle.
 */
export const ELEMENT_SWATCH: Record<Color, string> = {
  red: "bg-el-red",
  blue: "bg-el-blue",
  green: "bg-el-green",
  dark: "bg-el-dark",
  light: "bg-el-light",
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
  red: "rgba(255,90,78,0.55)",
  blue: "rgba(55,166,255,0.55)",
  green: "rgba(53,212,139,0.5)",
  dark: "rgba(168,116,255,0.55)",
  light: "rgba(232,209,116,0.55)",
};

/** Tile border color per element. */
export function getUnitBorderClass(color: Color): string {
  switch (color) {
    case "red":
      return "border-el-red/80";
    case "blue":
      return "border-el-blue/80";
    case "green":
      return "border-el-green/80";
    case "dark":
      return "border-el-dark/80";
    case "light":
    default:
      return "border-el-light/80";
  }
}

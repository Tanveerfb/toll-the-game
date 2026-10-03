/**
 * How an element looks wherever a unit is shown: one hue per element, and a
 * three-letter code for corners too small for the word. Nothing else in the UI
 * is allowed to use these hues - system chrome is the action yellow (ruling
 * #154). Shared by the archive, the team picker, the detail page and the
 * summon banner, which each kept a private copy until 2026-10-03.
 */

export type ElementColor = "light" | "red" | "blue" | "green" | "dark";

export const EL_HUE: Record<ElementColor, string> = {
  light: "var(--color-el-light)",
  red: "var(--color-el-red)",
  blue: "var(--color-el-blue)",
  green: "var(--color-el-green)",
  dark: "var(--color-el-dark)",
};

export const EL_CODE: Record<ElementColor, string> = {
  light: "LGT",
  red: "RED",
  blue: "BLU",
  green: "GRN",
  dark: "DRK",
};

function isElement(color: string): color is ElementColor {
  return color in EL_HUE;
}

/** The element's hue, falling back to light for an unknown colour string. */
export function elementHue(color: string): string {
  return isElement(color) ? EL_HUE[color] : EL_HUE.light;
}

/** The element's three-letter code, or the raw string for an unknown colour. */
export function elementCode(color: string): string {
  return isElement(color) ? EL_CODE[color] : color;
}

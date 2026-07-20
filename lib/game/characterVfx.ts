import type { CSSProperties } from "react";

// Per-character elemental VFX flavor (Tanveer 2026-07-20): battle impact
// bursts/sweeps read the source's Color by default (5-value palette), but a
// few named characters get a distinct tint + shape so their hits read as
// "water", "ink", "flame", etc. instead of generic team-color pulses. CSS/
// motion only — no new asset pipeline. Extend this registry as more flavors
// get called out; characters absent here fall back to their base Color.

export type VfxShape = "ring" | "ripple" | "shard" | "flicker" | "blot";

export interface CharacterVfx {
  /** CSS color (any valid color string) for the burst ring / sweep streak. */
  tint: string;
  shape: VfxShape;
}

// Tints are deliberately picked AWAY from the character's own element Color
// (checked against FLASH_TINTS in BattleArena.tsx) — a flavor that lands on
// the same hue as the default team-color ring is invisible. Duke and Lyra
// are both element "blue"/"red", the same hue their original water/Red-Ice
// tints used, so the flavor never read as distinct (Tanveer 2026-07-21).
const CHARACTER_VFX: Record<string, CharacterVfx> = {
  duke: { tint: "rgba(45,212,191,0.8)", shape: "ripple" }, // water — teal, away from his blue element
  lyra: { tint: "rgba(232,65,199,0.8)", shape: "shard" }, // Red Ice — magenta, away from her red element
  lyra_npc: { tint: "rgba(232,65,199,0.8)", shape: "shard" },
  batra: { tint: "rgba(251,146,60,0.75)", shape: "flicker" }, // flame
  gabrist: { tint: "rgba(167,139,250,0.75)", shape: "blot" }, // ink
};

/** Resolved tint for a burst/sweep: the character's flavor, else the base Color. */
export function getVfxTint(
  characterId: string | undefined,
  fallback: string,
): string {
  if (!characterId) return fallback;
  return CHARACTER_VFX[characterId]?.tint ?? fallback;
}

export function getVfxShape(characterId: string | undefined): VfxShape {
  if (!characterId) return "ring";
  return CHARACTER_VFX[characterId]?.shape ?? "ring";
}

/** Inline style additions for a burst ring's shape (merged over the base). */
export function vfxShapeStyle(shape: VfxShape): CSSProperties {
  switch (shape) {
    case "shard":
      return {
        borderRadius: 0,
        clipPath:
          "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
      };
    case "blot":
      return { borderRadius: "63% 37% 54% 46% / 43% 41% 59% 57%" };
    default:
      return { borderRadius: "9999px" };
  }
}

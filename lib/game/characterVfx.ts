import type { CSSProperties } from "react";

// Per-character elemental VFX flavor (Tanveer 2026-07-20, extended to the
// whole roster 2026-08-04): battle impact bursts/sweeps read the source's
// Color by default (5-value palette), but a named character gets a distinct
// tint + shape so their hits read as "water", "ink", "flame", "lightning"
// rather than a generic team-color pulse. CSS/motion only — no new asset
// pipeline. Characters absent here fall back to their base Color.

export type VfxShape =
  | "ring"
  | "ripple"
  | "shard"
  | "flicker"
  | "blot"
  | "bolt"
  | "slash"
  | "bloom"
  | "paw"
  | "quake";

export interface CharacterVfx {
  /** CSS color (any valid color string) for the burst ring / sweep streak. */
  tint: string;
  shape: VfxShape;
}

// Tints are deliberately picked AWAY from the character's own element Color
// (checked against FLASH_TINTS in lib/game/elementSwatch.ts) — a flavor that
// lands on the same hue as the default team-color ring is invisible. Duke and
// Lyra are both element "blue"/"red", the same hue their original water/Red-Ice
// tints used, so the flavor never read as distinct (Tanveer 2026-07-21).
//
// Power themes follow each character's design sheet + kit, per the per-character
// table in docs/design/SKILL_ART_PLAN.md — so a character's VFX flavor and their
// generated skill art describe the same power.
const CHARACTER_VFX: Record<string, CharacterVfx> = {
  // --- Original five (unchanged) ---
  duke: { tint: "rgba(45,212,191,0.8)", shape: "ripple" }, // water — teal, away from his blue element
  lyra: { tint: "rgba(232,65,199,0.8)", shape: "shard" }, // Red Ice — magenta, away from her red element
  lyra_npc: { tint: "rgba(232,65,199,0.8)", shape: "shard" },
  batra: { tint: "rgba(251,146,60,0.75)", shape: "flicker" }, // golden-lion flame — orange, away from blue
  gabrist: { tint: "rgba(167,139,250,0.75)", shape: "blot" }, // ink — violet, away from blue

  // --- Playable roster ---
  ban: { tint: "rgba(250,204,21,0.75)", shape: "blot" }, // soul wisps — amber, away from green
  chiara: { tint: "rgba(244,114,182,0.78)", shape: "bloom" }, // away from dark
  diane: { tint: "rgba(214,161,109,0.8)", shape: "quake" }, // earth/rock — sand, away from blue
  gon: { tint: "rgba(250,204,21,0.78)", shape: "slash" }, // nen streaks — amber, away from green
  isolde: { tint: "rgba(56,189,248,0.78)", shape: "bloom" }, // away from light
  killua: { tint: "rgba(224,242,254,0.9)", shape: "bolt" }, // blue-white lightning — near-white, away from blue
  leorio: { tint: "rgba(250,204,21,0.8)", shape: "slash" }, // yellow nen fist, away from red
  master_tao: { tint: "rgba(249,115,22,0.8)", shape: "flicker" }, // fire — orange, away from green
  meliodas: { tint: "rgba(147,51,234,0.8)", shape: "blot" }, // demonic aura — purple, away from red
  mustafa: { tint: "rgba(180,142,96,0.82)", shape: "quake" }, // stone — earth brown, away from green
  sara: { tint: "rgba(217,180,255,0.8)", shape: "paw" }, // spectral beast glyphs — pale violet, away from red
  seras: { tint: "rgba(191,219,254,0.9)", shape: "bolt" }, // lightning — pale blue, away from her light element
  siddiq: { tint: "rgba(74,222,128,0.8)", shape: "bloom" }, // vines/petals — green, away from red
  yalina: { tint: "rgba(251,191,36,0.8)", shape: "slash" }, // energy fist — amber, away from green

  // --- Boss / story-only ---
  molvarr: { tint: "rgba(132,204,22,0.82)", shape: "ripple" }, // corrosive sea-rot — sickly lime, away from dark
  frost: { tint: "rgba(224,242,254,0.85)", shape: "shard" },
  gale: { tint: "rgba(165,243,252,0.8)", shape: "slash" },
  iron: { tint: "rgba(203,213,225,0.85)", shape: "quake" },
  prism: { tint: "rgba(240,171,252,0.8)", shape: "shard" },
  raider: { tint: "rgba(251,146,60,0.75)", shape: "slash" },
  road_bandit: { tint: "rgba(248,113,113,0.75)", shape: "slash" },
  wild_beast: { tint: "rgba(253,186,116,0.8)", shape: "paw" },
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
        clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
      };
    case "blot":
      return { borderRadius: "63% 37% 54% 46% / 43% 41% 59% 57%" };
    case "bolt":
      return {
        borderRadius: 0,
        clipPath:
          "polygon(42% 0%, 74% 0%, 56% 38%, 88% 34%, 34% 100%, 46% 56%, 18% 60%)",
      };
    case "slash":
      return {
        borderRadius: "50% 8% 50% 8%",
        transform: "rotate(-28deg)",
      };
    case "bloom":
      return {
        borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
        clipPath:
          "polygon(50% 0%, 68% 26%, 100% 32%, 78% 58%, 84% 92%, 50% 74%, 16% 92%, 22% 58%, 0% 32%, 32% 26%)",
      };
    case "paw":
      return {
        borderRadius: "46% 46% 52% 52% / 58% 58% 42% 42%",
      };
    case "quake":
      return {
        borderRadius: 0,
        clipPath:
          "polygon(0% 46%, 22% 30%, 40% 52%, 58% 24%, 78% 50%, 100% 34%, 100% 66%, 76% 84%, 54% 62%, 34% 88%, 14% 66%)",
      };
    default:
      return { borderRadius: "9999px" };
  }
}

/**
 * Secondary flourish played alongside the main burst ring, keyed by shape.
 * `ripple` gets a delayed second ring, `flicker` an inner pop that dies fast,
 * `bolt` a hard bright core, `bloom` a slow expanding petal ring, `quake` a
 * flattened ground-wave. Everything else renders the ring alone.
 */
export type VfxAccent = "none" | "second-ring" | "inner-pop" | "core" | "wave";

export function getVfxAccent(shape: VfxShape): VfxAccent {
  switch (shape) {
    case "ripple":
      return "second-ring";
    case "flicker":
      return "inner-pop";
    case "bolt":
      return "core";
    case "bloom":
      return "second-ring";
    case "quake":
      return "wave";
    default:
      return "none";
  }
}

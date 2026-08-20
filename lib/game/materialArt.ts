// Inventory art (AI-generated, same Dokkan × 7DSGC style as the character set).
// Files live in public/items/<id>.webp at 512×512, RGBA. WebP with lossy RGB but
// lossless alpha (2026-08-20): 18.4MB of PNG became 2.2MB, and the lossless alpha
// matters because these render down to 24px, where a soft cutout edge reads as a halo.
// Regeneration pipeline: docs/ART_PIPELINE.md; the brief is Category C of
// docs/ART_REQUESTS.md.
//
// Deliberately the same shape as characterArt.ts — an id→path map returning
// null for anything without art — so every consumer keeps the text label from
// `materialLabel()` as its fallback and art can land one icon at a time.

// Bump when any file in public/items/ is replaced in place. Same reason as
// characterArt.ts: the URL doesn't change, so the optimizer and the browser
// keep serving the old pixels without it.
const ART_VERSION = 1;

const MATERIALS_WITH_ART = new Set([
  // Currencies (C1) — the most-seen art in the game, nav-wide
  "gems",
  "coin",
  "permanent_ticket",
  "auto_clear_ticket",
  "stamina",
  // Ascension, world-boss exclusive (C2)
  "sea_monster_eye",
  "corroded_seaweed",
  // Levelling fuel, a tier ladder generated as one set (C3)
  "training_manual",
  "training_manual_advanced",
  "training_manual_premium",
  // Local specialties, granted by the gacha miss-table (C4)
  "riverstone_fragment",
  "scorched_ember",
  "bramble_thorn",
  "prism_dust",
]);

/**
 * Icon for a material id, or null if none is generated yet.
 *
 * Character coins return null on purpose — they are not a single image. One
 * coin exists per playable character (18 today, more with every character
 * added), so instead of an icon each they render as a colour frame with the
 * character's portrait behind it. See `getCoinFrameArt`.
 */
export function getMaterialArt(id: string): string | null {
  if (!MATERIALS_WITH_ART.has(id)) return null;
  return `/items/${id}.webp?v=${ART_VERSION}`;
}

/** The five element colours a coin frame exists for. */
const COIN_FRAME_COLORS = new Set(["blue", "red", "green", "light", "dark"]);

/**
 * The empty struck-metal ring a character coin is drawn with — transparent in
 * the middle so the character portrait shows through, and transparent outside
 * so the coin sits on any panel.
 *
 * Five frames cover every coin id there will ever be, which is the whole point:
 * a per-character coin icon would need a new asset with every character drafted
 * and would guarantee a missing one.
 *
 * A caller renders a coin as `getCharacterArt(id)` clipped to a circle with
 * this frame on top — the character comes from `characterIdFromCoin()` in
 * lib/game/materials.ts.
 */
export function getCoinFrameArt(color: string): string | null {
  if (!COIN_FRAME_COLORS.has(color)) return null;
  return `/items/coin_frame_${color}.webp?v=${ART_VERSION}`;
}

// Character card art (AI-generated, Dokkan × 7DSGC style).
// Files live in public/characters/<id>.png at 1024×1024.
// Regeneration pipeline: docs/ART_PIPELINE.md

// Bump when any art file is replaced in place — busts the Next.js image
// optimizer cache and browser cache, which otherwise keep serving the old
// pixels for the unchanged URL.
const ART_VERSION = 6;

const CHARACTERS_WITH_ART = new Set([
  "ban",
  "diane",
  "gon",
  "killua",
  "leorio",
  "meliodas",
  "duke",
  "lyra",
  "master_tao",
  "mustafa",
  "siddiq",
  "batra",
  "gabrist",
  "sara",
  "yalina",
  "seras",
  // story-only examiners/officials (art locked, kit pending)
  "chiara",
  "isolde",
]);

// NPC/enemy art lives in public/npc/ instead of public/characters/.
// Includes AI-invented generic enemies and boss copies of playable chars.
const NPC_ART = new Set([
  "raider",
  "road_bandit",
  "wild_beast",
  // unrevealed Phase-1 qualifiers used as story enemies
  "gale",
  "frost",
  "iron",
  "prism",
  // Ch8/9 lake boss (art only; premium kit pending - 2nd main boss)
  "sea_monster",
  // NPC boss copy of a playable char (reuses lyra art, tweaked stats)
  "lyra_npc",
]);

export function getCharacterArt(id: string): string | null {
  if (NPC_ART.has(id)) return `/npc/${id}.png?v=${ART_VERSION}`;
  if (CHARACTERS_WITH_ART.has(id)) return `/characters/${id}.png?v=${ART_VERSION}`;
  return null;
}

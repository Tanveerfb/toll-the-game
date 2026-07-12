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
  // story-only NPC/enemy kits
  "raider",
  "road_bandit",
  "wild_beast",
]);

export function getCharacterArt(id: string): string | null {
  return CHARACTERS_WITH_ART.has(id)
    ? `/characters/${id}.png?v=${ART_VERSION}`
    : null;
}

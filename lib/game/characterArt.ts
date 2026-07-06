// Character card art (AI-generated, Dokkan × 7DSGC style).
// Files live in public/characters/<id>.png at 1024×1024.
// Regeneration pipeline: docs/ART_PIPELINE.md

const CHARACTERS_WITH_ART = new Set([
  "duke",
  "lyra",
  "master_tao",
  "mustafa",
  "siddiq",
  "batra",
  "gabrist",
  "sara",
  "yalina",
]);

export function getCharacterArt(id: string): string | null {
  return CHARACTERS_WITH_ART.has(id) ? `/characters/${id}.png` : null;
}

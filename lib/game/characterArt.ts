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
  // Ch8/9 lake boss — Molvarr, the Sunken Warden (kit: data/characters/molvarr.json)
  "sea_monster",
  "molvarr",
  // NPC boss copy of a playable char (reuses lyra art, tweaked stats)
  "lyra_npc",
]);

export function getCharacterArt(id: string): string | null {
  if (NPC_ART.has(id)) return `/npc/${id}.png?v=${ART_VERSION}`;
  if (CHARACTERS_WITH_ART.has(id)) return `/characters/${id}.png?v=${ART_VERSION}`;
  return null;
}

// Per-skill card art (art-forward cards, spec battle-UI overhaul). One art per
// skill/ultimate, keyed `<charId>__<slug>`. Files:
//   playables -> public/characters/skills/<charId>__<slug>.png
//   npc/boss  -> public/npc/skills/<charId>__<slug>.png
// Registered ids are added here as art is generated; callers fall back to the
// character portrait for any skill without its own art yet, so art ships
// incrementally with no broken images. See docs/design/SKILL_ART_PLAN.md.
const SKILLS_WITH_ART = new Set<string>([
  // e.g. "gon__jajanken-rock" — populated as skill art lands
]);

/** Deterministic slug for a skill name (kebab-case, punctuation stripped).
 *  "Jajanken: Rock" -> "jajanken-rock" · "Fist of Flowing Ruin : Slide" ->
 *  "fist-of-flowing-ruin-slide". */
export function skillArtSlug(skillName: string): string {
  return skillName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Skill-specific card art, or null if none is generated yet (caller falls
 *  back to getCharacterArt). */
export function getSkillArt(id: string, skillName: string): string | null {
  const key = `${id}__${skillArtSlug(skillName)}`;
  if (!SKILLS_WITH_ART.has(key)) return null;
  const dir = NPC_ART.has(id) ? "npc" : "characters";
  return `/${dir}/skills/${key}.png?v=${ART_VERSION}`;
}

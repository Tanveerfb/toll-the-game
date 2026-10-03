// Character card art (AI-generated, Dokkan × 7DSGC style).
// One folder per unit, named <element color>_<id> (his call, 2026-09-27:
// "red_lyra yes"), so a future colour variant of a character gets its own:
//   public/characters/red_lyra/portrait.png        1024×1024
//   public/characters/red_lyra/skills/<slug>.png   832×1216
//   public/characters/red_lyra/cards/pose-c4.png   (not wired to a screen yet)
//   public/characters/red_lyra/passive.png         (not wired to a screen yet)
// NPCs and bosses use the same layout under public/npc/. The colour comes from
// the kit (data/characters/<id>.json), so a folder cannot drift from it.
// Regeneration pipeline: docs/ART_PIPELINE.md
import { getCharacterById } from "@/lib/game/characterCatalog";
import { colorQualifiedId } from "@/lib/game/unitKey";

// Bump when any art file is replaced in place — busts the Next.js image
// optimizer cache and browser cache, which otherwise keep serving the old
// pixels for the unchanged URL.
const ART_VERSION = 21;

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
  // Bureau officials, kit landed 2026-07-25 (data/characters/chiara.json,
  // data/characters/isolde.json) — full playable roster, no skill-specific
  // art yet (portrait fallback via getSkillArt)
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
  // Chapter 1 road opposition (2026-08-21). tests/characterArt.test.ts enforces
  // both halves of the contract — every kit registered here, and every
  // registered id pointing at a file that exists — so a kit and its portrait
  // land in the same commit or neither does.
  "ford_bandit",
  "checkpoint_bruiser",
  "checkpoint_enforcer",
  "toll_collector",
]);

/**
 * Ids that render another character's art file. The Part 2 rematch used to
 * need one (`lyra_npc_2`), but that duplicate kit was replaced by a stage
 * effect on 2026-08-10 and deleted; `master_tao_npc` is the live entry.
 */
const ART_ALIAS: Record<string, string> = {
  // The Epic Battles boss Tao renders the playable card's art and skill art:
  // same character, same kit, so no second copy of the files (2026-10-03).
  master_tao_npc: "master_tao",
};

function resolveArtId(id: string): string {
  return ART_ALIAS[id] ?? id;
}

/** The unit's art folder name: `<color>_<id>` from its kit, or the bare id
 *  when it already starts with its colour (`blue_lyra`, not `blue_blue_lyra`
 *  — see `colorQualifiedId`). `sea_monster` has art but no kit (nothing
 *  renders it), so it keeps a bare `<id>` folder. */
export function artFolder(artId: string): string {
  const kit = getCharacterById(artId);
  return kit ? colorQualifiedId(kit) : artId;
}

function artRoot(artId: string): string {
  return `/${NPC_ART.has(artId) ? "npc" : "characters"}/${artFolder(artId)}`;
}

export function getCharacterArt(id: string): string | null {
  const artId = resolveArtId(id);
  if (!NPC_ART.has(artId) && !CHARACTERS_WITH_ART.has(artId)) return null;
  return `${artRoot(artId)}/portrait.png?v=${ART_VERSION}`;
}

/**
 * Archive frame-break art (his pick, 2026-10-03: the "Ink burst" tile). Only
 * units with new-pipeline art and a clean cut-out break out of the frame —
 * older portraits sit flat inside it (his call). The file is a transparent
 * crop: a square window plus headroom above it, made by
 * `scripts/skill_art/make_tile_cutout.py`; the value is its height / width.
 */
const TILE_ART: Record<string, number> = {
  sara: 1.25,
  lyra: 1.225,
};

/** Every unit with tile art, for the test that each file exists. */
export const registeredTileArt: readonly string[] = Object.keys(TILE_ART);

/** The frame-break cut-out and its height ratio, or null for a flat tile. */
export function getTileArt(id: string): { src: string; ratio: number } | null {
  const artId = resolveArtId(id);
  const ratio = TILE_ART[artId];
  if (ratio === undefined) return null;
  return { src: `${artRoot(artId)}/tile.webp?v=${ART_VERSION}`, ratio };
}

// Per-skill card art (art-forward cards, spec battle-UI overhaul). One art per
// skill/ultimate, keyed `<charId>__<slug>`. Files:
//   playables -> public/characters/<color>_<charId>/skills/<slug>.png
//   npc/boss  -> public/npc/<color>_<charId>/skills/<slug>.png
// Registered ids are added here as art is generated; callers fall back to the
// character portrait for any skill without its own art yet, so art ships
// incrementally with no broken images. See docs/design/SKILL_ART_PLAN.md.
const SKILLS_WITH_ART = new Set<string>([
  // Gon proof batch (2026-07-25)
  "gon__jajanken-rock",
  "gon__jajanken-round-2",
  "gon__jajanken-combo",
  // Full roster batch (2026-07-25) — 15 playables x 3 + Molvarr x 8
  "ban__drain",
  "ban__fox-hunt",
  "ban__snatch",
  "batra__khalsa-flame",
  "batra__lion-s-charge",
  "batra__roar-of-spite",
  "diane__ground-gladius",
  "diane__mother-earth-catastrophe",
  "diane__rush-rock",
  "duke__fist-of-flowing-ruin-slide",
  "duke__fist-of-flowing-ruin-water",
  "duke__fist-of-flowing-ruin-weaken",
  "gabrist__erase",
  "gabrist__ink-slash",
  "gabrist__masterpiece-unveiled",
  "killua__lightning-palm",
  "killua__speed-of-lightning",
  "killua__thunderbolt",
  "leorio__member-of-the-zodiac",
  "leorio__remote-punch",
  "leorio__switchblade-attack",
  "lyra__latent-heat",
  "lyra__flash-point",
  "lyra__shatterburn",
  "master_tao__flaming-palm",
  "master_tao__inferno-consumption",
  "master_tao__wrath-of-the-fire-sage",
  "meliodas__evil-spirit",
  "meliodas__full-counter",
  "meliodas__triple-strike",
  "mustafa__earth-shatter",
  "mustafa__earth-stance-fortress",
  "mustafa__tea-time-tremor",
  "sara__adaptation",
  "sara__apex",
  "sara__swarm",
  "seras__chain-tempest",
  "seras__heavenfall-bolt",
  "seras__static-lance",
  "siddiq__cleansing-bloom",
  "siddiq__nature-s-strike",
  "siddiq__wrath-of-the-wild",
  "yalina__attention-drawer",
  "yalina__devastating-blow",
  "yalina__unexpected-strike",
  "molvarr__abyssal-convergence",
  "molvarr__corrosive-surge",
  "molvarr__crushing-maw",
  "molvarr__devour-the-tide",
  "molvarr__devouring-bite",
  "molvarr__iron-carapace",
  "molvarr__sunken-verdict",
  "molvarr__tidal-cataclysm",
]);

/** Every registered `<charId>__<slug>` key; tests check each file exists. */
export const registeredSkillArt: readonly string[] = [...SKILLS_WITH_ART];

/** Deterministic slug for a skill name (kebab-case, punctuation stripped).
 *  "Jajanken: Rock" -> "jajanken-rock" · "Fist of Flowing Ruin : Slide" ->
 *  "fist-of-flowing-ruin-slide". */
export function skillArtSlug(skillName: string): string {
  return skillName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Skill art one unit borrows from another, by `<charId>__<slug>`. A variant
 * whose ultimate is the original's, name included, shows the original's art —
 * his call for both exam-arc variants (2026-09-27/28: blue Lyra "reuses red
 * Lyra's ult art", green Duke's ult "reuses blue Duke's art").
 */
const SKILL_ART_ALIAS: Record<string, string> = {
  "blue_lyra__latent-heat": "lyra__latent-heat",
  "green_duke__fist-of-flowing-ruin-water": "duke__fist-of-flowing-ruin-water",
  // Boss Tao's skill 2 was renamed with its new mechanic; it keeps the
  // playable card's skill-2 art until he asks for its own (2026-10-03).
  "master_tao__examiner-s-judgement": "master_tao__inferno-consumption",
};

/** Every borrowed key, for the test that each points at registered art. */
export const skillArtAliases: Readonly<Record<string, string>> = SKILL_ART_ALIAS;

/** Skill-specific card art, or null if none is generated yet (caller falls
 *  back to getCharacterArt). */
export function getSkillArt(id: string, skillName: string): string | null {
  const key = `${resolveArtId(id)}__${skillArtSlug(skillName)}`;
  const resolved = SKILL_ART_ALIAS[key] ?? key;
  if (!SKILLS_WITH_ART.has(resolved)) return null;
  const [artId, slug] = resolved.split("__");
  return `${artRoot(artId)}/skills/${slug}.png?v=${ART_VERSION}`;
}

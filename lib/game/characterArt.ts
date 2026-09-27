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

// Bump when any art file is replaced in place — busts the Next.js image
// optimizer cache and browser cache, which otherwise keep serving the old
// pixels for the unchanged URL.
const ART_VERSION = 18;

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
 * Ids that render another character's art file. Empty right now — the Part 2
 * rematch used to need one (`lyra_npc_2`), but that duplicate kit was replaced
 * by a stage effect on 2026-08-10 and deleted.
 */
const ART_ALIAS: Record<string, string> = {};

function resolveArtId(id: string): string {
  return ART_ALIAS[id] ?? id;
}

/** The unit's art folder name: `<color>_<id>` from its kit. `sea_monster` has
 *  art but no kit (nothing renders it), so it keeps a bare `<id>` folder. */
export function artFolder(artId: string): string {
  const color = getCharacterById(artId)?.color;
  return color ? `${color}_${artId}` : artId;
}

function artRoot(artId: string): string {
  return `/${NPC_ART.has(artId) ? "npc" : "characters"}/${artFolder(artId)}`;
}

export function getCharacterArt(id: string): string | null {
  const artId = resolveArtId(id);
  if (!NPC_ART.has(artId) && !CHARACTERS_WITH_ART.has(artId)) return null;
  return `${artRoot(artId)}/portrait.png?v=${ART_VERSION}`;
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
  "sara__animal-strike",
  "sara__beast-master-s-fury",
  "sara__stampede-concentrate",
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

/** Skill-specific card art, or null if none is generated yet (caller falls
 *  back to getCharacterArt). */
export function getSkillArt(id: string, skillName: string): string | null {
  const artId = resolveArtId(id);
  const slug = skillArtSlug(skillName);
  if (!SKILLS_WITH_ART.has(`${artId}__${slug}`)) return null;
  return `${artRoot(artId)}/skills/${slug}.png?v=${ART_VERSION}`;
}

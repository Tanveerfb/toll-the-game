import { getCharacterById, type CharacterColor } from "@/lib/game/characterCatalog";

/** The 4 shared local-specialty materials, grouped by each character's
 *  existing `color` tag (already used for type-advantage — no new schema
 *  needed). See "Local specialty matz" in the gacha design spec:
 *  docs/superpowers/specs/2026-08-01-gacha-design.md */
const SPECIALTY_MATERIAL_BY_COLOR: Record<CharacterColor, string> = {
  blue: "riverstone_fragment",
  red: "scorched_ember",
  green: "bramble_thorn",
  light: "prism_dust",
  dark: "prism_dust",
};

const DEFAULT_MATERIAL = "riverstone_fragment";

export function materialForCharacter(characterId: string): string {
  const character = getCharacterById(characterId);
  if (!character) return DEFAULT_MATERIAL;
  return SPECIALTY_MATERIAL_BY_COLOR[character.color] ?? DEFAULT_MATERIAL;
}

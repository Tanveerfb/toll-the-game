/**
 * Canonical registry of every material id the game can put in a player's
 * inventory, with its display label.
 *
 * Material ids used to exist only as string literals scattered across the
 * ascension cost table, the gacha miss-table and one display map inside
 * `app/profile/page.tsx`. Nothing validated them, so a typo in authored data
 * became a silent inventory key that no screen showed and no system spent.
 * Story chapter rewards are authored per chapter in JSON, which makes that
 * failure mode much easier to hit — hence a single list, validated at load by
 * `storySchema.ts`.
 */
export const MATERIAL_LABELS: Record<string, string> = {
  // Ascension — world-boss exclusive by design (story never drops these)
  sea_monster_eye: "Sea Monster's Eye",
  corroded_seaweed: "Corroded Sea Weed",
  // Levelling fuel
  training_manual: "Training Manual",
  training_manual_advanced: "Advanced Training Manual",
  training_manual_premium: "Premium Training Manual",
  // Local specialty materials, granted by the gacha miss-table
  // (`lib/gacha/materials.ts` maps them from a character's color)
  riverstone_fragment: "Riverstone Fragment",
  scorched_ember: "Scorched Ember",
  bramble_thorn: "Bramble Thorn",
  prism_dust: "Prism Dust",
};

export const MATERIAL_IDS: readonly string[] = Object.keys(MATERIAL_LABELS);

export function isKnownMaterial(id: string): boolean {
  return id in MATERIAL_LABELS;
}

/** Falls back to the raw id rather than throwing — an unknown id reaching a
 *  display surface is a data bug to see, not a crash to suffer. */
export function materialLabel(id: string): string {
  return MATERIAL_LABELS[id] ?? id;
}

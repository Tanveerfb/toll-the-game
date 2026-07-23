import { z } from "zod";
import { MECHANIC_TYPES } from "@/types/mechanic";

// Runtime shape-check for data/characters/*.json — kits are hand-edited and
// act as the source of truth, so a typo should fail loudly at load time with
// the character id attached, not mid-battle. Loose objects: mechanics carry
// per-type fields (counterDamagePercentRanked, sealType, …) that stay open,
// but the `type` string itself must be a known mechanic (STATUS #7).

const PASSIVE_TRIGGERS = [
  "onBattleStart",
  "aura",
  "always",
  "beforeSkill",
  "afterSkill",
  "onFirstAction",
  "onAllySkill",
  "onAttackReceived",
  "onLethalDamage",
  "onDamageDealt",
  "onRoundEnd",
  "onNewTurn",
  "onIgniteConsume",
  "OnPlayerTurnStart",
  "OnPlayerTurnEnd",
  "OnEnemyTurnStart",
  "OnEnemyTurnEnd",
] as const;

const mechanicSchema = z.looseObject({
  type: z.enum(MECHANIC_TYPES),
});

const skillSchema = z.looseObject({
  skillName: z.string().min(1),
  characterId: z.string().min(1),
  type: z.string().min(1),
  statMultiplier: z.enum(["atk", "def", "hp"]),
  description: z.string().optional(),
  damageRanked: z.array(z.number()).length(3).optional(),
  damage: z.number().optional(),
  mechanics: z.array(mechanicSchema).optional(),
});

const passiveSchema = z.looseObject({
  name: z.string().min(1),
  description: z.string().min(1),
  trigger: z.enum(PASSIVE_TRIGGERS),
  mechanics: z.array(mechanicSchema).optional(),
});

export const characterSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.enum(["light", "red", "blue", "green", "dark"]),
  atk: z.number().positive(),
  def: z.number().positive(),
  hp: z.number().positive(),
  tags: z.array(z.string()).optional(),
  lore: z.string().optional(),
  storyOnly: z.boolean().optional(),
  tier: z.enum(["elite"]).optional(),
  ultGaugeMax: z.number().positive().optional(),
  ccImmune: z.boolean().optional(),
  boss: z.boolean().optional(),
  /** Crit damage bonus %, base 50 if absent (lib/game/substats.ts). */
  critDamagePercent: z.number().nonnegative().optional(),
  /** Heal-scaling multiplier %, base 100 if absent. */
  recoveryRatePercent: z.number().nonnegative().optional(),
  /** % of damage dealt returned as self-heal on every hit, base 5 if absent. */
  lifestealPercent: z.number().nonnegative().optional(),
  /** Reduces incoming crit chance by this %, base 10 if absent. */
  critResistPercent: z.number().nonnegative().optional(),
  skills: z.array(skillSchema).length(2),
  ultimate: skillSchema.optional(),
  passive: passiveSchema.optional(),
  // Multi-phase boss: each phase is its own stat block + (any-count) skills +
  // (multiple) passives. Only bosses carry this.
  phases: z
    .array(
      z.looseObject({
        hp: z.number().positive(),
        atk: z.number().positive(),
        def: z.number().positive(),
        skills: z.array(skillSchema),
        spSkill: skillSchema.optional(),
        ultimate: skillSchema.optional(),
        passives: z.array(passiveSchema).optional(),
      }),
    )
    .optional(),
});

export function validateCharacters(characters: unknown[]): void {
  const problems: string[] = [];

  for (const character of characters) {
    const result = characterSchema.safeParse(character);
    if (!result.success) {
      const id =
        typeof character === "object" &&
        character !== null &&
        "id" in character
          ? String((character as { id: unknown }).id)
          : "<missing id>";
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
        .join("; ");
      problems.push(`${id} — ${issues}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Malformed character kit(s):\n${problems.join("\n")}`);
  }
}

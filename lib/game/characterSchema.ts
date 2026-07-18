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
  skills: z.array(skillSchema).length(2),
  ultimate: skillSchema.optional(),
  passive: passiveSchema.optional(),
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

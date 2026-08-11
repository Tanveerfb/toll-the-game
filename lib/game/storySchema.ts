import { z } from "zod";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { isKnownMaterial } from "@/lib/game/materials";
import { STAMINA_CAP } from "@/lib/game/stamina";
import type { StoryPart } from "@/types/story";

const sceneSchema = z.object({
  speaker: z.string().optional(),
  portraitId: z.string().optional(),
  side: z.enum(["left", "right"]).optional(),
  text: z.string().min(1),
});

const teamPickSchema = z.object({
  id: z.string().min(1),
  isSub: z.boolean().optional(),
  // Authored progression — raises an enemy's level for a harder encounter.
  // Absent means level 1, the bare catalog statline.
  level: z.number().int().positive().optional(),
  ascension: z.number().int().nonnegative().optional(),
  ultLevel: z.number().int().positive().optional(),
});

const dropRangeSchema = z
  .object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  })
  .refine((range) => range.min <= range.max, {
    message: "drop range min must be <= max",
  });

/** Material ids are validated against the canonical registry — an unvalidated
 *  typo becomes a silent inventory key that nothing displays and nothing
 *  spends. */
const materialAmountsSchema = z
  .record(z.string().min(1), z.number().int().nonnegative())
  .refine((materials) => Object.keys(materials).every(isKnownMaterial), {
    message: "unknown material id",
  });

const materialRangesSchema = z
  .record(z.string().min(1), dropRangeSchema)
  .refine((materials) => Object.keys(materials).every(isKnownMaterial), {
    message: "unknown material id",
  });

const rewardsSchema = z.object({
  firstClear: z.object({
    gems: z.number().int().nonnegative().optional(),
    coin: z.number().int().nonnegative().optional(),
    permanentTicket: z.number().int().nonnegative().optional(),
    materials: materialAmountsSchema.optional(),
    // Account XP. First clears are the only source for now, so this rises as
    // the story goes on rather than staying flat.
    accountXp: z.number().int().nonnegative().optional(),
  }),
  repeat: z.object({
    coin: dropRangeSchema.optional(),
    materials: materialRangesSchema.optional(),
  }),
  // A replay cost the bar can never reach would be an unplayable chapter.
  replayStamina: z.number().int().nonnegative().max(STAMINA_CAP),
});

/**
 * Stage effects — encounter-level modifiers, so a fight can be tuned without
 * editing a character kit (Tanveer, 2026-08-10). Optional everywhere: absent
 * means a standard fight.
 */
const stageEffectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("statBoost"),
    target: z.enum(["player", "enemy", "both"]),
    stat: z.enum(["all", "atk", "def", "hp"]),
    valuePercent: z.number(),
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal("bonusActions"),
    target: z.enum(["player", "enemy", "both"]),
    value: z.number().int().positive(),
    description: z.string().optional(),
  }),
]);

const chapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  intro: z.array(sceneSchema),
  // Absent = a scene-only chapter. Present = it must be a real battle, so a
  // half-filled `battle` key is still a load-time failure.
  battle: z
    .object({
      playerTeam: z.array(teamPickSchema).min(1).max(4),
      enemyTeam: z.array(teamPickSchema).min(1).max(4),
    })
    .optional(),
  outro: z.array(sceneSchema),
  teamMode: z.enum(["canon", "anchored", "free"]),
  stageEffects: z.array(stageEffectSchema).optional(),
  trialLevel: z.number().int().positive().optional(),
  rewards: rewardsSchema,
});

const partSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  title: z.string().min(1),
  tagline: z.string().min(1),
  coverCharacterId: z.string().min(1),
  chapters: z.array(chapterSchema).min(1),
});

/**
 * Validates story part JSON at load — malformed data or a battle that
 * references a character id missing from the catalog fails loudly with the
 * part id and path, same policy as character kits.
 */
export function validateStoryParts(parts: unknown[]): StoryPart[] {
  const validated = parts.map((raw) => {
    const result = partSchema.safeParse(raw);
    if (!result.success) {
      const id =
        typeof raw === "object" && raw !== null && "id" in raw
          ? String((raw as { id: unknown }).id)
          : "<unknown part>";
      const issue = result.error.issues[0];
      throw new Error(
        `Invalid story part: ${id} — ${issue.path.join(".")}: ${issue.message}`,
      );
    }
    return result.data;
  });

  validated.forEach((part) => {
    part.chapters.forEach((chapter) => {
      const picks = chapter.battle
        ? [...chapter.battle.playerTeam, ...chapter.battle.enemyTeam]
        : [];
      picks.forEach(
        (pick) => {
          if (!getCharacterById(pick.id)) {
            throw new Error(
              `Invalid story part: ${part.id} — chapter ${chapter.id} references unknown character "${pick.id}"`,
            );
          }
        },
      );
      chapter.intro.concat(chapter.outro).forEach((scene) => {
        if (scene.portraitId && !getCharacterById(scene.portraitId)) {
          throw new Error(
            `Invalid story part: ${part.id} — chapter ${chapter.id} scene references unknown portrait "${scene.portraitId}"`,
          );
        }
      });
    });
  });

  return validated as StoryPart[];
}

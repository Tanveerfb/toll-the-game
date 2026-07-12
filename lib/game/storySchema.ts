import { z } from "zod";
import { getCharacterById } from "@/lib/game/characterCatalog";
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
});

const chapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  intro: z.array(sceneSchema),
  battle: z.object({
    playerTeam: z.array(teamPickSchema).min(1).max(4),
    enemyTeam: z.array(teamPickSchema).min(1).max(4),
  }),
  outro: z.array(sceneSchema),
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
      [...chapter.battle.playerTeam, ...chapter.battle.enemyTeam].forEach(
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

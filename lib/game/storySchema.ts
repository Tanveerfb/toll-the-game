import { z } from "zod";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { isKnownMaterial } from "@/lib/game/materials";
import { STAMINA_CAP } from "@/lib/game/stamina";
import type { StoryChapter } from "@/types/story";

/**
 * Load-time validation for story chapter JSON — same policy as character kits:
 * fail loudly, with the chapter and stage named, rather than letting a typo
 * become a screen that renders nothing.
 *
 * The rules worth knowing, because they encode design decisions rather than
 * taste:
 *  - **Stage numbers run 1..N with no gaps**, so `1-4` always means the fourth
 *    stage. Count per chapter is deliberately *not* capped — Tanveer, 2026-08-18:
 *    it depends on what the story and the filler need.
 *  - **A `story` stage has no waves and no farm table**; a `battle`/`boss` stage
 *    has 1–3 waves. A scene with a grind table, or a fight with nothing to
 *    fight, is an authoring mistake that would otherwise ship silently.
 *  - **A `boss` stage is the last one**, because clearing it unlocks the next
 *    chapter.
 *  - **At most 3 missions**, ids unique within the chapter (they key persisted
 *    claim state, so a duplicate would make one mission claim another).
 */

const originSchema = z.enum(["canon", "filler"]);

const sceneSchema = z.object({
  speaker: z.string().optional(),
  portraitId: z.string().optional(),
  side: z.enum(["left", "right"]).optional(),
  text: z.string().min(1),
  // Not checked against an asset on disk on purpose: a slug is authored before
  // ComfyUI has drawn it and resolves to the fallback until then.
  backgroundId: z.string().min(1).optional(),
  origin: originSchema,
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

const fixedBundleSchema = z.object({
  gems: z.number().int().nonnegative().optional(),
  coin: z.number().int().nonnegative().optional(),
  permanentTicket: z.number().int().nonnegative().optional(),
  materials: materialAmountsSchema.optional(),
  accountXp: z.number().int().nonnegative().optional(),
});

const farmDropsSchema = z.object({
  coin: dropRangeSchema.optional(),
  materials: materialRangesSchema.optional(),
});

/** Gems and Permanent Tickets are first-clear-only currency (rulings #47, #80),
 *  so the farm table has no shape for them at all — the ban is structural
 *  rather than a test someone has to remember to write. */
const rewardsSchema = z.object({
  firstClear: fixedBundleSchema,
  farm: farmDropsSchema.optional(),
});

/**
 * Stage effects — encounter-level modifiers, so a fight can be tuned without
 * editing a character kit (ruling #69). Absent means a standard fight.
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

const waveSchema = z.object({
  enemies: z.array(teamPickSchema).min(1).max(4),
  stageEffects: z.array(stageEffectSchema).optional(),
  /** Early-out threshold, 1–99. Rejecting 100 on purpose: a wave won at full HP
   *  would end before the first action, and 0 is just "kill them", which is
   *  what leaving this out already means. */
  victoryAtEnemyHpPercent: z.number().int().min(1).max(99).optional(),
});

const missionGoalSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("noLosses") }),
  z.object({ type: z.literal("withinTurns"), turns: z.number().int().positive() }),
  z.object({ type: z.literal("fieldCharacter"), characterId: z.string().min(1) }),
  z.object({
    type: z.literal("fieldTag"),
    tag: z.string().min(1),
    count: z.number().int().positive(),
  }),
  z.object({ type: z.literal("useUltimates"), count: z.number().int().positive() }),
  z.object({ type: z.literal("firstAttempt") }),
  z.object({ type: z.literal("allWaves") }),
]);

const missionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  goal: missionGoalSchema,
  reward: fixedBundleSchema,
});

const stageSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive(),
  name: z.string().min(1),
  kind: z.enum(["story", "battle", "boss"]),
  intro: z.array(sceneSchema),
  outro: z.array(sceneSchema),
  waves: z.array(waveSchema).max(3),
  team: z.array(teamPickSchema).max(4),
  teamMode: z.enum(["canon", "anchored", "free"]),
  missions: z.array(missionSchema).max(3),
  rewards: rewardsSchema,
  // A cost the bar can never reach would be an unplayable stage.
  stamina: z.number().int().nonnegative().max(STAMINA_CAP),
  trialLevel: z.number().int().positive().optional(),
  trialAscension: z.number().int().min(0).max(6).optional(),
  origin: originSchema,
});

const chapterSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  tagline: z.string().min(1),
  coverCharacterId: z.string().min(1),
  localeId: z.string().min(1).optional(),
  stages: z.array(stageSchema).min(1),
});

type ParsedChapter = z.infer<typeof chapterSchema>;

function fail(chapterId: string, message: string): never {
  throw new Error(`Invalid story chapter: ${chapterId} — ${message}`);
}

/** Structural rules Zod can't express per-field, checked with the ids in hand so
 *  the message names the stage an author has to open. */
function checkChapter(chapter: ParsedChapter): void {
  const { id: chapterId, stages } = chapter;

  stages.forEach((stage, index) => {
    if (stage.number !== index + 1) {
      fail(
        chapterId,
        `stage "${stage.id}" is at position ${index + 1} but numbered ${stage.number} — stage numbers must run 1..N in order`,
      );
    }

    const wants = stage.kind === "story" ? 0 : 1;
    if (wants === 0 && stage.waves.length > 0) {
      fail(chapterId, `stage ${stage.number} is a scene stage but authors ${stage.waves.length} wave(s)`);
    }
    if (wants === 1 && stage.waves.length === 0) {
      fail(chapterId, `stage ${stage.number} is a ${stage.kind} stage with no waves`);
    }
    // A fight needs someone to fight it: `canon` and `anchored` read this team as
    // the fixed lineup, and `free` needs it as the fallback for a player who owns
    // nothing.
    if (wants === 1 && stage.team.length === 0) {
      fail(chapterId, `stage ${stage.number} has waves but no authored team`);
    }
    if (wants === 0 && stage.team.length > 0) {
      fail(chapterId, `stage ${stage.number} is a scene stage but authors a team`);
    }
    if (stage.kind === "story" && stage.rewards.farm) {
      fail(
        chapterId,
        `stage ${stage.number} is a scene stage and cannot carry a farm table — there is nothing to grind`,
      );
    }
    if (stage.kind === "boss" && index !== stages.length - 1) {
      fail(
        chapterId,
        `stage ${stage.number} is the boss but is not last — clearing the boss is what unlocks the next chapter`,
      );
    }

    stage.waves.forEach((wave, waveIndex) => {
      wave.enemies.forEach((pick) => {
        if (!getCharacterById(pick.id)) {
          fail(
            chapterId,
            `stage ${stage.number} wave ${waveIndex + 1} references unknown character "${pick.id}"`,
          );
        }
      });
    });

    stage.team.forEach((pick) => {
      if (!getCharacterById(pick.id)) {
        fail(
          chapterId,
          `stage ${stage.number} team references unknown character "${pick.id}"`,
        );
      }
    });

    [...stage.intro, ...stage.outro].forEach((scene) => {
      if (scene.portraitId && !getCharacterById(scene.portraitId)) {
        fail(
          chapterId,
          `stage ${stage.number} scene references unknown portrait "${scene.portraitId}"`,
        );
      }
    });
  });

  // Mission ids key persisted claim state (`c1:s3:m2`), so a duplicate inside a
  // chapter would let one mission claim another's reward.
  const seen = new Set<string>();
  stages.forEach((stage) =>
    stage.missions.forEach((mission) => {
      if (seen.has(mission.id)) {
        fail(chapterId, `duplicate mission id "${mission.id}"`);
      }
      seen.add(mission.id);
    }),
  );

  const ids = new Set(stages.map((stage) => stage.id));
  if (ids.size !== stages.length) fail(chapterId, "duplicate stage id");
}

export function validateStoryChapters(chapters: unknown[]): StoryChapter[] {
  const validated = chapters.map((raw) => {
    const result = chapterSchema.safeParse(raw);
    if (!result.success) {
      const id =
        typeof raw === "object" && raw !== null && "id" in raw
          ? String((raw as { id: unknown }).id)
          : "<unknown chapter>";
      const issue = result.error.issues[0];
      throw new Error(
        `Invalid story chapter: ${id} — ${issue.path.join(".")}: ${issue.message}`,
      );
    }
    return result.data;
  });

  validated.forEach(checkChapter);

  const numbers = validated.map((chapter) => chapter.number);
  if (new Set(numbers).size !== numbers.length) {
    throw new Error("Invalid story catalog: two chapters share a number");
  }

  return validated as StoryChapter[];
}

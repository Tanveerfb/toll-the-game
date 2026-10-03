import { z } from "zod";

import examArc from "@/data/arcs/exam-arc.json";
import type { RunnableEncounter } from "@/lib/game/fightRun";

/**
 * Epic Battles - the model.
 *
 * **Epic Battles** is a collection on the events board; each entry is an
 * **arc** ("Arc 1: Exam Arc"); each arc has ordered **stages**; each stage is
 * one fight against story enemies (Tanveer, 2026-10-03).
 *
 * His rules, which this module and the screens built on it must keep:
 *
 * - **Every stage is always open.** Visible and enterable from rank 1, with no
 *   sequential unlock. There is deliberately no `requiredRank` or `unlocks`
 *   field, so a gate cannot be authored by accident. The only gate is how hard
 *   the fight is - these are endgame fights for strong accounts.
 * - **Repeatable without limit, and zero stamina.**
 * - **No rewards on a clear.** Rewards will arrive later through a separate
 *   missions section ("clear stage 1", "clear stage 1 with a human-only
 *   team"). Missions are not built yet, which is why a clear is recorded
 *   richly (`epicClears.ts`) so they can be evaluated retroactively.
 * - The player brings their own team.
 *
 * **Stage levels are provisional and Tanveer's to tune.** Every enemy in
 * `data/arcs/exam-arc.json` is authored at level 20, the level the First
 * Ascension Trial uses for Lyra, as a starting point and nothing more: they
 * have not been measured against a real player band (JSON cannot carry this
 * comment, so it lives here).
 *
 * Authored in `data/arcs/*.json` and parsed through the schema at module load,
 * so a bad file throws at load (tested) instead of mid-fight.
 */

/** The collection every arc belongs to. Declared once; the schema pins it. */
export const EPIC_BATTLES_COLLECTION = "Epic Battles";

const teamPickSchema = z.object({
  id: z.string().min(1),
  isSub: z.boolean().optional(),
  level: z.number().int().min(1).optional(),
  ascension: z.number().int().min(0).optional(),
  ultLevel: z.number().int().min(1).optional(),
});

const stageEffectTargetSchema = z.enum(["player", "enemy", "both"]);

const stageEffectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("statBoost"),
    target: stageEffectTargetSchema,
    description: z.string().optional(),
    stat: z.enum(["all", "atk", "def", "hp"]),
    valuePercent: z.number(),
  }),
  z.object({
    type: z.literal("bonusActions"),
    target: stageEffectTargetSchema,
    description: z.string().optional(),
    value: z.number(),
  }),
]);

/**
 * The encounter, in the shape `fightRun.ts` already fights. Not a second
 * type: the assignment below fails to compile if this schema ever stops
 * satisfying `RunnableEncounter`.
 */
const encounterSchema = z.object({
  id: z.string().min(1),
  fights: z
    .array(
      z.object({
        enemies: z.array(teamPickSchema).min(1),
        stageEffects: z.array(stageEffectSchema).optional(),
        victoryAtEnemyHpPercent: z.number().min(1).max(100).optional(),
      }),
    )
    .min(1),
});
const _encounterIsRunnable = (
  encounter: z.infer<typeof encounterSchema>,
): RunnableEncounter => encounter;
void _encounterIsRunnable;

/** Ids are used in keys joined with "/", so they cannot contain one. */
const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "an id is lowercase words joined by hyphens");

/** The key a stage is recorded under: `"<arcId>/<stageId>"`. */
export function stageKey(arcId: string, stageId: string): string {
  return `${arcId}/${stageId}`;
}

export const stageSchema = z.object({
  id: idSchema,
  order: z.number().int().min(1),
  name: z.string().min(1),
  /** One short, factual line from the story's perspective. */
  caption: z.string().min(1),
  encounter: encounterSchema,
});

export const arcSchema = z
  .object({
    id: idSchema,
    collection: z.literal(EPIC_BATTLES_COLLECTION),
    order: z.number().int().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    stages: z.array(stageSchema).min(1),
  })
  .superRefine((arc, ctx) => {
    const seenIds = new Set<string>();
    const seenOrders = new Set<number>();
    arc.stages.forEach((stage, index) => {
      if (seenIds.has(stage.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", index, "id"],
          message: `duplicate stage id "${stage.id}"`,
        });
      }
      seenIds.add(stage.id);
      if (seenOrders.has(stage.order)) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", index, "order"],
          message: `duplicate stage order ${stage.order}`,
        });
      }
      seenOrders.add(stage.order);
      // The encounter id is what `fightRun` carries and what a persisted
      // battle owner refers back to, so it IS the stage key - one id, not two.
      if (stage.encounter.fights.length !== 1) {
        // "One fight against story enemies" - and the screen fights only the
        // first, so a second would be silently ignored rather than fought.
        ctx.addIssue({
          code: "custom",
          path: ["stages", index, "encounter", "fights"],
          message: `a stage is exactly one fight, got ${stage.encounter.fights.length}`,
        });
      }
      const expected = stageKey(arc.id, stage.id);
      if (stage.encounter.id !== expected) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", index, "encounter", "id"],
          message: `encounter id must be "${expected}"`,
        });
      }
    });
  });

export type EpicStage = z.infer<typeof stageSchema>;
export type EpicArc = z.infer<typeof arcSchema>;

/**
 * Parses authored arcs. Throws, naming the arc, on the first bad one or on a
 * duplicate arc id. Exported so the failure path can be tested without
 * editing a data file.
 */
export function parseArcs(raw: readonly unknown[]): EpicArc[] {
  const arcs = raw.map((entry, index) => {
    const result = arcSchema.safeParse(entry);
    if (!result.success) {
      const id =
        typeof entry === "object" && entry !== null && "id" in entry
          ? String((entry as { id: unknown }).id)
          : `#${index}`;
      throw new Error(
        `[epicBattles] arc "${id}" is invalid:\n${z.prettifyError(result.error)}`,
      );
    }
    return result.data;
  });
  const ids = new Set<string>();
  for (const arc of arcs) {
    if (ids.has(arc.id)) {
      throw new Error(`[epicBattles] duplicate arc id "${arc.id}"`);
    }
    ids.add(arc.id);
  }
  return arcs
    .map((arc) => ({
      ...arc,
      stages: [...arc.stages].sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => a.order - b.order);
}

// Parsed at load: a bad file fails here, naming the arc.
const ARCS: readonly EpicArc[] = parseArcs([examArc]);

/** Every arc, in order. */
export function listArcs(): readonly EpicArc[] {
  return ARCS;
}

export function getArc(arcId: string): EpicArc | undefined {
  return ARCS.find((arc) => arc.id === arcId);
}

export function getStage(
  arcId: string,
  stageId: string,
): EpicStage | undefined {
  return getArc(arcId)?.stages.find((stage) => stage.id === stageId);
}

/** The label an arc is shown under: "Arc 1: Exam Arc". */
export function arcLabel(arc: Pick<EpicArc, "order" | "title">): string {
  return `Arc ${arc.order}: ${arc.title}`;
}

/** Splits a stage key back into its ids, or null if it is not one. */
export function parseStageKey(
  key: string,
): { arcId: string; stageId: string } | null {
  const parts = key.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { arcId: parts[0], stageId: parts[1] };
}

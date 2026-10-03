import { describe, expect, it } from "vitest";

import { getCharacterArt, getSkillArt } from "@/lib/game/characterArt";
import {
  getCharacterById,
  getPlayableCharacters,
} from "@/lib/game/characterCatalog";
import { getVfxTint } from "@/lib/game/characterVfx";
import {
  arcLabel,
  arcSchema,
  getArc,
  getStage,
  listArcs,
  parseArcs,
  parseStageKey,
  stageKey,
} from "@/lib/game/epicBattles";
import examArc from "@/data/arcs/exam-arc.json";

/**
 * Epic Battles is authored data parsed at module load. These pin the model's
 * contract: a bad file fails loudly, every enemy exists, and the shape
 * Tanveer specified (always open, one fight per stage) cannot drift.
 */

/** A minimal valid arc to break one field at a time. */
function arc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const id = typeof overrides.id === "string" ? overrides.id : "test-arc";
  return {
    id,
    collection: "Epic Battles",
    order: 1,
    title: "Test",
    summary: "A test arc.",
    stages: [
      {
        id: "one",
        order: 1,
        name: "One",
        caption: "First.",
        encounter: {
          id: `${id}/one`,
          fights: [{ enemies: [{ id: "lyra_npc", level: 20 }] }],
        },
      },
    ],
    ...overrides,
  };
}

describe("the authored arcs", () => {
  it("loads the exam arc with its two stages in order", () => {
    const exam = getArc("exam-arc");
    expect(exam?.title).toBe("Exam Arc");
    expect(exam?.stages.map((stage) => stage.id)).toEqual([
      "master-tao",
      "lyra",
    ]);
    expect(exam && arcLabel(exam)).toBe("Arc 1: Exam Arc");
  });

  it("resolves every enemy of every stage in the catalog", () => {
    const missing: string[] = [];
    for (const authored of listArcs()) {
      for (const stage of authored.stages) {
        for (const fight of stage.encounter.fights) {
          for (const enemy of fight.enemies) {
            if (!getCharacterById(enemy.id)) {
              missing.push(`${stageKey(authored.id, stage.id)} -> ${enemy.id}`);
            }
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("fields the boss Tao and the story Lyra, both elite", () => {
    expect(getStage("exam-arc", "master-tao")?.encounter.fights[0].enemies[0].id).toBe(
      "master_tao_npc",
    );
    expect(getStage("exam-arc", "lyra")?.encounter.fights[0].enemies[0].id).toBe(
      "lyra_npc",
    );
    expect(getCharacterById("master_tao_npc")?.tier).toBe("elite");
    expect(getCharacterById("lyra_npc")?.tier).toBe("elite");
  });

  it("gives every encounter the id of its stage key", () => {
    for (const authored of listArcs()) {
      for (const stage of authored.stages) {
        expect(stage.encounter.id).toBe(stageKey(authored.id, stage.id));
      }
    }
  });
});

describe("the boss Tao (master_tao_npc)", () => {
  const base = getCharacterById("master_tao");
  const boss = getCharacterById("master_tao_npc");

  it("keeps Flaming Palm and the ultimate from the playable kit", () => {
    const first = (c: typeof base) =>
      JSON.parse(
        JSON.stringify({ skill: c?.skills[0], ultimate: c?.ultimate }).replace(
          /"characterId":"[a-z_]+"/g,
          '"characterId":"x"',
        ),
      );
    expect(first(boss)).toEqual(first(base));
  });

  it("carries Tanveer's boss stats", () => {
    expect(boss?.hp).toBe(10500);
    expect(boss?.atk).toBe(220);
    expect(boss?.def).toBe(195);
    expect(boss?.ultGaugeMax).toBe(10);
    expect(boss?.ccImmune).toBe(true);
    expect(boss?.lore).not.toMatch(/provisional/i);
  });

  it("is story-only, so no roster, archive or summon list shows it", () => {
    expect(boss?.storyOnly).toBe(true);
    expect(getPlayableCharacters().map((c) => c.id)).not.toContain(
      "master_tao_npc",
    );
  });

  it("has no phases", () => {
    expect(boss).not.toHaveProperty("phases");
  });

  it("renders the playable card's art and flavour", () => {
    expect(getCharacterArt("master_tao_npc")).toBe(getCharacterArt("master_tao"));
    expect(getSkillArt("master_tao_npc", "Flaming Palm")).toBe(
      getSkillArt("master_tao", "Flaming Palm"),
    );
    expect(getVfxTint("master_tao_npc", "x")).toBe(getVfxTint("master_tao", "x"));
  });
});

describe("helpers", () => {
  it("builds and splits a stage key", () => {
    expect(stageKey("exam-arc", "lyra")).toBe("exam-arc/lyra");
    expect(parseStageKey("exam-arc/lyra")).toEqual({
      arcId: "exam-arc",
      stageId: "lyra",
    });
    expect(parseStageKey("exam-arc")).toBeNull();
    expect(parseStageKey("a/b/c")).toBeNull();
    expect(parseStageKey("/b")).toBeNull();
  });

  it("looks arcs and stages up, and returns undefined for the unknown", () => {
    expect(getArc("nope")).toBeUndefined();
    expect(getStage("exam-arc", "nope")).toBeUndefined();
    expect(getStage("nope", "lyra")).toBeUndefined();
    expect(getStage("exam-arc", "lyra")?.name).toBe("Lyra");
  });

  it("lists arcs and stages sorted by order whatever the file order", () => {
    const reversed = parseArcs([
      arc({
        id: "b-arc",
        order: 2,
        stages: [
          { ...(arc().stages as Record<string, unknown>[])[0], id: "z", order: 2, encounter: { id: "b-arc/z", fights: [{ enemies: [{ id: "lyra_npc" }] }] } },
          { ...(arc().stages as Record<string, unknown>[])[0], id: "y", order: 1, encounter: { id: "b-arc/y", fights: [{ enemies: [{ id: "lyra_npc" }] }] } },
        ],
      }),
      arc({ id: "a-arc", order: 1 }),
    ]);
    expect(reversed.map((a) => a.id)).toEqual(["a-arc", "b-arc"]);
    expect(reversed[1].stages.map((s) => s.id)).toEqual(["y", "z"]);
  });
});

describe("a bad arc fails at parse, naming the arc", () => {
  it("accepts the shipped file and the minimal fixture", () => {
    expect(arcSchema.safeParse(examArc).success).toBe(true);
    expect(arcSchema.safeParse(arc()).success).toBe(true);
  });

  it.each([
    ["a wrong collection", { collection: "Side Stories" }],
    ["no stages", { stages: [] }],
    ["a missing title", { title: undefined }],
    ["an id with a slash", { id: "exam/arc" }],
  ])("rejects %s", (_label, overrides) => {
    expect(() => parseArcs([arc(overrides)])).toThrow(/\[epicBattles\] arc/);
  });

  it("names the arc in the error", () => {
    expect(() => parseArcs([arc({ id: "named-arc", collection: "x" })])).toThrow(
      /"named-arc"/,
    );
  });

  it("rejects an encounter id that is not the stage key", () => {
    const stage = (arc().stages as Record<string, unknown>[])[0];
    expect(() =>
      parseArcs([
        arc({
          stages: [{ ...stage, encounter: { id: "wrong", fights: [{ enemies: [{ id: "lyra_npc" }] }] } }],
        }),
      ]),
    ).toThrow(/encounter id must be "test-arc\/one"/);
  });

  it("rejects a stage that is not exactly one fight", () => {
    const stage = (arc().stages as Record<string, unknown>[])[0];
    const fight = { enemies: [{ id: "lyra_npc" }] };
    expect(() =>
      parseArcs([
        arc({
          stages: [{ ...stage, encounter: { id: "test-arc/one", fights: [fight, fight] } }],
        }),
      ]),
    ).toThrow(/exactly one fight/);
  });

  it("rejects an enemy-less fight, a bad level and duplicate ids", () => {
    const stage = (arc().stages as Record<string, unknown>[])[0];
    const encounter = (fights: unknown) => ({ id: "test-arc/one", fights });
    expect(() =>
      parseArcs([arc({ stages: [{ ...stage, encounter: encounter([{ enemies: [] }]) }] })]),
    ).toThrow();
    expect(() =>
      parseArcs([
        arc({
          stages: [{ ...stage, encounter: encounter([{ enemies: [{ id: "lyra_npc", level: 0 }] }]) }],
        }),
      ]),
    ).toThrow();
    expect(() =>
      parseArcs([
        arc({ stages: [stage, { ...stage, order: 2 }] }),
      ]),
    ).toThrow(/duplicate stage id/);
    expect(() => parseArcs([arc(), arc()])).toThrow(/duplicate arc id/);
  });

  it("carries no gate: a stage has no rank, unlock or stamina field", () => {
    // Every stage is always open and free (Tanveer, 2026-10-03). The schema
    // strips unknown keys, so an authored `requiredRank` would be silently
    // dropped - this pins that the parsed shape cannot carry one either.
    const parsed = parseArcs([arc()])[0].stages[0] as Record<string, unknown>;
    for (const field of ["requiredRank", "unlocks", "staminaCost", "rewards"]) {
      expect(parsed).not.toHaveProperty(field);
    }
  });
});

import { describe, expect, it } from "vitest";
import { validateStoryChapters } from "@/lib/game/storySchema";
import chapter1 from "@/data/story/chapter-1.json";
import type { StoryChapter } from "@/types/story";

/**
 * Story chapter schema (story mode v2, 2026-08-18).
 *
 * The rules below are design decisions, not taste, and every one of them fails
 * *silently* if unchecked: a farm table on a scene stage pays for nothing, a boss
 * that isn't last stops the next chapter unlocking, a stage numbered out of order
 * makes `1-4` mean the fifth stage, and a duplicate mission id makes one mission
 * claim another's reward.
 */

/** A minimal valid chapter, mutated per test — the shape a new chapter starts
 *  from, which is also what makes each failure below a one-field difference. */
function chapter(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "cX",
    number: 99,
    title: "Test Chapter",
    tagline: "A line.",
    coverCharacterId: "duke",
    stages: [
      {
        id: "s1",
        number: 1,
        name: "A Fight",
        kind: "battle",
        origin: "filler",
        intro: [],
        outro: [],
        waves: [{ enemies: [{ id: "wild_beast" }] }],
        team: [{ id: "duke" }],
        teamMode: "canon",
        missions: [],
        rewards: { firstClear: { gems: 1 }, farm: { coin: { min: 1, max: 2 } } },
        stamina: 4,
      },
    ],
    ...overrides,
  };
}

function stage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base = (chapter().stages as Record<string, unknown>[])[0];
  return { ...base, ...overrides };
}

describe("the authored catalog", () => {
  it("chapter 1 loads", () => {
    const [loaded] = validateStoryChapters([chapter1]) as StoryChapter[];
    expect(loaded.id).toBe("c1");
    expect(loaded.stages).toHaveLength(5);
    expect(loaded.stages.map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it("ends on a boss stage, which is what unlocks the next chapter", () => {
    const [loaded] = validateStoryChapters([chapter1]) as StoryChapter[];
    expect(loaded.stages[loaded.stages.length - 1].kind).toBe("boss");
  });

  it("keeps gems out of every farm table", () => {
    // Gems are first-clear-only currency (rulings #47, #80). The farm shape has
    // no field for them at all, so this asserts the structural ban holds for real
    // authored data rather than just in the type.
    const [loaded] = validateStoryChapters([chapter1]) as StoryChapter[];
    for (const s of loaded.stages) {
      expect(Object.keys(s.rewards.farm ?? {})).not.toContain("gems");
    }
  });

  it("tags every stage and scene with its origin", () => {
    const [loaded] = validateStoryChapters([chapter1]) as StoryChapter[];
    for (const s of loaded.stages) {
      expect(["canon", "filler"]).toContain(s.origin);
      for (const scene of [...s.intro, ...s.outro]) {
        expect(["canon", "filler"]).toContain(scene.origin);
      }
    }
  });
});

describe("rejections", () => {
  it("refuses stage numbers that skip", () => {
    expect(() =>
      validateStoryChapters([
        chapter({ stages: [stage({ id: "s1", number: 2 })] }),
      ]),
    ).toThrow(/stage numbers must run 1\.\.N/);
  });

  it("refuses a scene stage that carries waves", () => {
    expect(() =>
      validateStoryChapters([
        chapter({
          stages: [stage({ kind: "story", rewards: { firstClear: {} } })],
        }),
      ]),
    ).toThrow(/scene stage but authors 1 wave/);
  });

  it("refuses a battle stage with no waves", () => {
    expect(() =>
      validateStoryChapters([chapter({ stages: [stage({ waves: [] })] })]),
    ).toThrow(/battle stage with no waves/);
  });

  it("refuses a battle stage with no team to fight it", () => {
    expect(() =>
      validateStoryChapters([chapter({ stages: [stage({ team: [] })] })]),
    ).toThrow(/waves but no authored team/);
  });

  it("refuses a farm table on a scene stage", () => {
    expect(() =>
      validateStoryChapters([
        chapter({
          stages: [
            stage({
              kind: "story",
              waves: [],
              team: [],
              rewards: { firstClear: {}, farm: { coin: { min: 1, max: 1 } } },
            }),
          ],
        }),
      ]),
    ).toThrow(/cannot carry a farm table/);
  });

  it("refuses a boss stage that isn't last", () => {
    expect(() =>
      validateStoryChapters([
        chapter({
          stages: [
            stage({ id: "s1", number: 1, kind: "boss" }),
            stage({ id: "s2", number: 2 }),
          ],
        }),
      ]),
    ).toThrow(/is the boss but is not last/);
  });

  it("refuses a fourth mission", () => {
    const mission = (id: string) => ({
      id,
      label: "Do a thing",
      goal: { type: "noLosses" },
      reward: { gems: 1 },
    });
    expect(() =>
      validateStoryChapters([
        chapter({
          stages: [
            stage({
              missions: [mission("m1"), mission("m2"), mission("m3"), mission("m4")],
            }),
          ],
        }),
      ]),
    ).toThrow(/missions/);
  });

  it("refuses duplicate mission ids inside a chapter", () => {
    const mission = { id: "m1", label: "x", goal: { type: "noLosses" }, reward: {} };
    expect(() =>
      validateStoryChapters([
        chapter({
          stages: [
            stage({ id: "s1", number: 1, missions: [mission] }),
            stage({ id: "s2", number: 2, missions: [mission] }),
          ],
        }),
      ]),
    ).toThrow(/duplicate mission id/);
  });

  it("refuses more than three waves", () => {
    expect(() =>
      validateStoryChapters([
        chapter({
          stages: [
            stage({
              waves: Array.from({ length: 4 }, () => ({
                enemies: [{ id: "wild_beast" }],
              })),
            }),
          ],
        }),
      ]),
    ).toThrow();
  });

  it("refuses an unknown enemy id", () => {
    expect(() =>
      validateStoryChapters([
        chapter({ stages: [stage({ waves: [{ enemies: [{ id: "nope" }] }] })] }),
      ]),
    ).toThrow(/unknown character "nope"/);
  });

  it("refuses an unknown portrait id", () => {
    expect(() =>
      validateStoryChapters([
        chapter({
          stages: [
            stage({ intro: [{ text: "hi", portraitId: "nope", origin: "canon" }] }),
          ],
        }),
      ]),
    ).toThrow(/unknown portrait "nope"/);
  });

  it("refuses two chapters sharing a number", () => {
    expect(() =>
      validateStoryChapters([chapter({ id: "cA" }), chapter({ id: "cB" })]),
    ).toThrow(/share a number/);
  });

  it("refuses a scene with no origin", () => {
    expect(() =>
      validateStoryChapters([
        chapter({ stages: [stage({ intro: [{ text: "untagged" }] })] }),
      ]),
    ).toThrow();
  });
});

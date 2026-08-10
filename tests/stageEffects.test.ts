import { describe, expect, it } from "vitest";
import { actionsForTurn } from "@/lib/game/actionEconomy";
import {
  bonusActionsFor,
  describeStageEffect,
  groupStageEffects,
  stageAdjustedStats,
  statBoostPercentFor,
} from "@/lib/game/stageEffects";
import { validateStoryParts } from "@/lib/game/storySchema";
import type { BattleCharacter } from "@/types/character";
import type { StageEffect } from "@/types/stageEffects";
import part2 from "@/data/story/part2.json";

function unit(overrides: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    instanceId: "u1",
    currentHP: 1000,
    isSub: false,
    ...overrides,
  } as BattleCharacter;
}

const P2C2: StageEffect[] = [
  { type: "statBoost", target: "enemy", stat: "all", valuePercent: 5 },
  { type: "bonusActions", target: "player", value: 1 },
];

describe("stage effects (Tanveer, 2026-08-10)", () => {
  it("lifts a lone player from 2 actions to 3", () => {
    const solo = [unit()];
    expect(actionsForTurn(solo)).toBe(2);
    expect(actionsForTurn(solo, bonusActionsFor(P2C2, "player"))).toBe(3);
  });

  it("never raises the ceiling above the hard cap of 3", () => {
    const full = [unit(), unit(), unit()];
    expect(actionsForTurn(full, bonusActionsFor(P2C2, "player"))).toBe(3);
    expect(actionsForTurn(full, 5)).toBe(3);
  });

  it("gives the bonus only to the targeted side", () => {
    expect(bonusActionsFor(P2C2, "player")).toBe(1);
    expect(bonusActionsFor(P2C2, "enemy")).toBe(0);
  });

  it("applies a 'both' effect to either side", () => {
    const both: StageEffect[] = [
      { type: "bonusActions", target: "both", value: 1 },
    ];
    expect(bonusActionsFor(both, "player")).toBe(1);
    expect(bonusActionsFor(both, "enemy")).toBe(1);
  });

  it("boosts every basic stat with stat: all, and only the named side", () => {
    const base = { atk: 140, def: 115, hp: 8000 };
    expect(stageAdjustedStats(base, P2C2, "enemy")).toEqual({
      atk: 147,
      def: 121,
      hp: 8400,
    });
    expect(stageAdjustedStats(base, P2C2, "player")).toEqual(base);
    expect(statBoostPercentFor(P2C2, "enemy", "atk")).toBe(5);
  });

  it("leaves stats untouched when there are no stage effects", () => {
    const base = { atk: 100, def: 50, hp: 1000 };
    expect(stageAdjustedStats(base, undefined, "player")).toEqual(base);
    expect(actionsForTurn([unit()], bonusActionsFor(undefined, "player"))).toBe(2);
  });

  it("describes effects in the roster's arrow idiom", () => {
    expect(describeStageEffect(P2C2[0])).toBe("All stats 5% 👆 during battle");
    expect(describeStageEffect(P2C2[1])).toBe("+1 action per turn (max 3)");
  });

  it("groups effects into the brief's three sections", () => {
    const grouped = groupStageEffects(P2C2);
    expect(grouped.enemy).toHaveLength(1);
    expect(grouped.player).toHaveLength(1);
    expect(grouped.both).toHaveLength(0);
  });

  it("Part 2 Chapter 2 carries the effects that replaced lyra_npc_2", () => {
    const [part] = validateStoryParts([part2]);
    const chapter = part.chapters.find((c) => c.id === "p2c2");
    expect(chapter?.battle.enemyTeam).toEqual([{ id: "lyra_npc" }]);
    expect(chapter?.stageEffects).toEqual(P2C2);
  });
});

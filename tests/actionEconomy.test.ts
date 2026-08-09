import { describe, expect, it } from "vitest";
import { actionsForTurn } from "@/lib/game/actionEconomy";
import { enemyActionsForTurn } from "@/lib/game/ai";
import type { BattleCharacter } from "@/types/character";

function unit(
  overrides: Partial<BattleCharacter> & { instanceId: string },
): BattleCharacter {
  return {
    id: overrides.instanceId,
    name: overrides.instanceId,
    color: "blue",
    atk: 100,
    def: 0,
    hp: 1000,
    currentHP: 1000,
    ultGauge: 0,
    skills: [],
    buffs: [],
    debuffs: [],
    effects: [],
    team: "enemy",
    ...overrides,
  } as BattleCharacter;
}

describe("action economy (both sides, ruling 2026-08-09)", () => {
  it("gives living field members +1, capped at 3", () => {
    expect(actionsForTurn([])).toBe(0);
    expect(actionsForTurn([unit({ instanceId: "a" })])).toBe(2);
    expect(
      actionsForTurn([unit({ instanceId: "a" }), unit({ instanceId: "b" })]),
    ).toBe(3);
    expect(
      actionsForTurn([
        unit({ instanceId: "a" }),
        unit({ instanceId: "b" }),
        unit({ instanceId: "c" }),
        unit({ instanceId: "d" }),
      ]),
    ).toBe(3);
  });

  it("ignores the dead and the benched", () => {
    expect(
      actionsForTurn([
        unit({ instanceId: "a" }),
        unit({ instanceId: "dead", currentHP: 0 }),
        unit({ instanceId: "bench", isSub: true }),
      ]),
    ).toBe(2);
  });

  it("keeps elite bosses at a flat 3, even alone", () => {
    expect(actionsForTurn([unit({ instanceId: "lyra", tier: "elite" })])).toBe(3);
  });

  it("enemyActionsForTurn stays an alias of the shared rule", () => {
    const team = [unit({ instanceId: "a" }), unit({ instanceId: "b" })];
    expect(enemyActionsForTurn(team)).toBe(actionsForTurn(team));
    expect(enemyActionsForTurn([unit({ instanceId: "solo" })])).toBe(2);
  });
});

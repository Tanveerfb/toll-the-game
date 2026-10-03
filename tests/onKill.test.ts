import { describe, expect, it } from "vitest";

import { getCharacterById } from "@/lib/game/characterCatalog";
import { executeSkill } from "@/lib/game/combat";
import { applyKillPassives } from "@/lib/game/onKill";
import { tickTeamDebuffs } from "@/lib/game/tick";
import { playerBand, simulate } from "@/lib/game/simulate";
import type { BattleCharacter } from "@/types/character";

/**
 * `onKill` - "when this character defeats an enemy" (lib/game/onKill.ts). Boss
 * Tao heals a share of max HP (35% today), once per battle. A kill is the striker's own direct
 * damage taking an enemy to 0: a skill, an ultimate or a counter. Damage over
 * time does not count, and nor does an ally's kill.
 */

function unit(
  id: string,
  team: "player" | "enemy",
  over: Partial<BattleCharacter> = {},
): BattleCharacter {
  const data = getCharacterById(id) as unknown as Record<string, unknown>;
  return {
    ...(data as object),
    instanceId: `${id}-${team}`,
    currentHP: data.hp as number,
    currentAttack: data.atk as number,
    currentDefense: data.def as number,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team,
    ...over,
  } as BattleCharacter;
}

/** Tao's kill heal as a fraction of max HP, read from his kit so a retune moves one file. */
const KILL_HEAL =
  ((getCharacterById("master_tao_npc") as unknown as {
    passive: { blocks: Array<{ trigger: string; mechanics: Array<{ valuePercent: number }> }> };
  }).passive.blocks.find((b) => b.trigger === "onKill")!.mechanics[0].valuePercent) / 100;

const taoHurt = (over: Partial<BattleCharacter> = {}) => {
  const tao = unit("master_tao_npc", "enemy");
  return { ...tao, currentHP: 4000, ...over } as BattleCharacter;
};

/** Tao's first skill (Flaming Palm) at one of the players. */
const palm = (target: BattleCharacter, source = "master_tao_npc-enemy") => ({
  sourceInstanceId: source,
  skill: getCharacterById("master_tao_npc")!.skills[0] as never,
  targetInstanceId: target.instanceId,
  rank: 3 as const,
});

const run = (
  action: ReturnType<typeof palm>,
  playerTeam: BattleCharacter[],
  enemyTeam: BattleCharacter[],
) => executeSkill(action, { playerTeam, enemyTeam }, () => {}, 0, () => 0.99);

describe("a direct kill", () => {
  it("heals Tao by his kill share of max HP, once", () => {
    const victim = unit("lyra", "player", { currentHP: 1 });
    const first = run(palm(victim), [victim], [taoHurt()]);
    expect(first.playerTeam[0].currentHP).toBe(0);
    const tao = first.enemyTeam[0];
    expect(tao.currentHP).toBeGreaterThanOrEqual(4000 + Math.floor(tao.hp * KILL_HEAL));
    expect(tao.currentHP).toBeLessThanOrEqual(tao.hp);
    expect(tao.passiveState.onKillHeals).toBe(1);

    // A second kill, with Tao hurt again, earns nothing: maxTriggers is 1.
    const second = run(
      palm(unit("duke", "player", { currentHP: 1 })),
      [unit("duke", "player", { currentHP: 1 })],
      [{ ...tao, currentHP: 3000 }],
    );
    expect(second.playerTeam[0].currentHP).toBe(0);
    // Only the 5% base lifesteal moved it: nowhere near a full heal.
    expect(second.enemyTeam[0].currentHP).toBeLessThan(4000);
    expect(second.enemyTeam[0].passiveState.onKillHeals).toBe(1);
  });

  it("heals against the live max HP, ramp included", () => {
    const victim = unit("lyra", "player", { currentHP: 1 });
    const grown = taoHurt({ hp: 12000 });
    const after = run(palm(victim), [victim], [grown]).enemyTeam[0];
    expect(after.currentHP).toBeGreaterThanOrEqual(4000 + Math.floor(12000 * KILL_HEAL));
  });

  it("does nothing when the hit does not kill", () => {
    const victim = unit("lyra", "player");
    const after = run(palm(victim), [victim], [taoHurt()]);
    expect(after.playerTeam[0].currentHP).toBeGreaterThan(0);
    // Base lifesteal nudges it; a kill heal would have added a share of max HP.
    expect(after.enemyTeam[0].currentHP).toBeLessThan(5000);
    expect(after.enemyTeam[0].passiveState.onKillHeals).toBeUndefined();
  });
});

describe("what is not a kill", () => {
  it("damage over time that kills credits nobody", () => {
    const victim = unit("lyra", "player", {
      currentHP: 10,
      debuffs: [{ type: "damageOverTime", name: "Bleed", value: 500, debuffDuration: 2 }],
    });
    const tao = taoHurt();
    const ticked = tickTeamDebuffs([victim], () => {});
    expect(ticked[0].currentHP).toBe(0);
    expect(tao.currentHP).toBe(4000);
    expect(tao.passiveState.onKillHeals).toBeUndefined();
  });

  it("an ally's kill does not heal Tao", () => {
    const victim = unit("duke", "player", { currentHP: 1 });
    const ally = unit("lyra_npc", "enemy");
    const lyraPalm = {
      sourceInstanceId: ally.instanceId,
      skill: getCharacterById("lyra_npc")!.skills[0] as never,
      targetInstanceId: victim.instanceId,
      rank: 3 as const,
    };
    const after = run(lyraPalm, [victim], [taoHurt(), ally]);
    expect(after.playerTeam[0].currentHP).toBe(0);
    expect(after.enemyTeam[0].currentHP).toBe(4000);
  });

  it("a benched Tao earns nothing", () => {
    const teams = { playerTeam: [], enemyTeam: [taoHurt({ isSub: true })] };
    applyKillPassives(teams, new Map([["master_tao_npc-enemy", 1]]), () => {});
    expect(teams.enemyTeam[0].currentHP).toBe(4000);
  });

  it("a dead striker earns nothing", () => {
    const teams = { playerTeam: [], enemyTeam: [taoHurt({ currentHP: 0 })] };
    applyKillPassives(teams, new Map([["master_tao_npc-enemy", 1]]), () => {});
    expect(teams.enemyTeam[0].currentHP).toBe(0);
  });
});

describe("a counter kill", () => {
  it("counts for the counterer, who survived the hit", () => {
    const counterStance = {
      type: "stance" as const,
      counterDamagePercent: 900,
      buffDuration: 2,
      name: "Counter",
    };
    const tao = taoHurt({ buffs: [counterStance] });
    const attacker = unit("lyra", "player", { currentHP: 5 });
    const poke = {
      sourceInstanceId: attacker.instanceId,
      skill: getCharacterById("lyra")!.skills[0] as never,
      targetInstanceId: tao.instanceId,
      rank: 1 as const,
    };
    const after = run(poke as never, [attacker], [tao]);
    expect(after.playerTeam[0].currentHP).toBe(0);
    // The poke landed first, so the heal is measured against a lower floor.
    expect(after.enemyTeam[0].currentHP).toBeGreaterThan(4000);
    expect(after.enemyTeam[0].passiveState.onKillHeals).toBe(1);
  });
});

describe("in the simulator", () => {
  it("reports how often the kill heal fired", async () => {
    const { stats } = await simulate(
      playerBand(["duke", "lyra", "siddiq"], 20),
      [{ id: "master_tao_npc", level: 20 }],
      { runs: 20, seed: 1, fieldCap: 3, collectStats: true },
    );
    const tao = stats!.units.find((u) => u.characterId === "master_tao_npc")!;
    const t = stats!.telemetry[tao.instanceId];
    expect(t.killHealShare).toBeGreaterThanOrEqual(0);
    expect(t.killHealShare).toBeLessThanOrEqual(1);
    expect(t.killHeals.max).toBeLessThanOrEqual(1);
  });
});

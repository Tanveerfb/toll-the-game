import { describe, expect, it } from "vitest";

import { getAIMove } from "@/lib/game/ai";
import { getCharacterById } from "@/lib/game/characterCatalog";
import {
  dealTeamHand,
  initialCardsFor,
  settlePlayedCard,
} from "@/lib/game/deck";
import { playerBand, simulate } from "@/lib/game/simulate";
import { ultGaugeAfterAction } from "@/lib/game/ultGauge";
import type { ActionCard } from "@/types/action";
import type { BattleCharacter } from "@/types/character";

/**
 * The simulator plays from a hand and fills ultimate gauge by the battle's own
 * rules, and every random pick in it comes from the seeded RNG.
 *
 * Before 2026-10-03 it fed the AI every skill with no hand, so each unit played
 * its FIRST attack skill forever and no gauge ever filled. Live enemies were
 * never affected: `getAIMove` with a hand already chooses among the cards in it.
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

describe("the shared gauge rule", () => {
  it("grants +1 for an ordinary card, capped at the unit's maximum", () => {
    const skill = { type: "attack" };
    expect(ultGaugeAfterAction({ ultGauge: 2 }, skill)).toBe(3);
    expect(ultGaugeAfterAction({ ultGauge: 5 }, skill)).toBe(5);
    expect(ultGaugeAfterAction({ ultGauge: 9, ultGaugeMax: 10 }, skill)).toBe(10);
    expect(ultGaugeAfterAction({ ultGauge: 10, ultGaugeMax: 10 }, skill)).toBe(10);
  });

  it("spends the gauge on an ultimate and refills by its own mechanics", () => {
    expect(ultGaugeAfterAction({ ultGauge: 5 }, { type: "ultimate" })).toBe(0);
    expect(
      ultGaugeAfterAction(
        { ultGauge: 10, ultGaugeMax: 10 },
        { type: "ultimate", mechanics: [{ type: "gainUltGauge", value: 3 }] },
      ),
    ).toBe(3);
  });

  it("is what settling a played card applies, merges included", () => {
    const tao = unit("master_tao_npc", "enemy", { ultGauge: 4 });
    const hand = initialCardsFor([tao]);
    const played = hand[0];
    const settled = settlePlayedCard({
      team: [tao],
      hand,
      action: {
        sourceInstanceId: tao.instanceId,
        skill: played.skill,
        cardId: played.id,
      },
    });
    expect(settled.hand.some((c) => c.id === played.id)).toBe(false);
    expect(settled.team[0].ultGauge).toBe(5);
  });
});

describe("dealing a hand", () => {
  it("only deals an ultimate to a unit whose gauge is full", () => {
    const hasUlt = (gauge: number) => {
      const tao = unit("master_tao_npc", "enemy", { ultGauge: gauge });
      const dealt = dealTeamHand({ team: [tao], hand: [], rng: () => 0.5 });
      return dealt.hand.some((c) => c.skill.type === "ultimate");
    };
    expect(tao10().ultGaugeMax).toBe(10);
    expect(hasUlt(9)).toBe(false);
    expect(hasUlt(10)).toBe(true);
  });

  it("is reproducible for a seeded rng", () => {
    const tao = unit("master_tao_npc", "enemy");
    const skills = (rng: () => number) =>
      dealTeamHand({ team: [tao], hand: [], rng }).hand.map((c) => c.skill.skillName);
    expect(skills(() => 0.1)).toEqual(skills(() => 0.1));
    expect(skills(() => 0.1)).not.toEqual(skills(() => 0.9));
  });
});

function tao10() {
  return getCharacterById("master_tao_npc")!;
}

describe("the AI's picks come from the rng it is given", () => {
  const team = [unit("gon", "enemy"), unit("duke", "enemy", { instanceId: "d2" })];
  const foes = [unit("lyra", "player"), unit("siddiq", "player")];
  const hand = (): ActionCard[] => initialCardsFor(team);

  it("picks the first or last candidate as the rng dictates", () => {
    const low = getAIMove(team, foes, undefined, hand(), () => 0);
    const high = getAIMove(team, foes, undefined, hand(), () => 0.999);
    expect(low?.sourceInstanceId).toBe(team[0].instanceId);
    expect(high?.sourceInstanceId).toBe(team[1].instanceId);
  });
});

describe("simulated fights use the whole kit and are reproducible", () => {
  const boss = { id: "master_tao_npc", level: 20 };
  const run = (seed = 1) =>
    simulate(playerBand(["duke", "lyra", "siddiq"], 20), [boss], {
      runs: 12,
      seed,
      fieldCap: 3,
      collectStats: true,
    });

  it("casts the second skill and the ultimate", async () => {
    const { stats } = await run();
    const tao = stats!.units.find((u) => u.characterId === "master_tao_npc")!;
    expect(tao.bySkill["Flaming Palm"]).toBeGreaterThan(0);
    expect(tao.bySkill["Examiner's Judgement"]).toBeGreaterThan(0);
    expect(tao.ultsUsed.mean).toBeGreaterThan(0);
    expect(tao.bySkill["Wrath of the Fire Sage"]).toBeGreaterThan(0);
  });

  it("gives the same numbers for the same seed, including the AI's picks", async () => {
    const a = await run();
    const b = await run();
    expect(a).toEqual(b);
  });

  it("differs for a different seed", async () => {
    const a = await run(1);
    const b = await run(2);
    expect(a.stats).not.toEqual(b.stats);
  });
});

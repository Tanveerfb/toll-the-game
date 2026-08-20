import { describe, expect, it } from "vitest";

import { getCharacterById } from "@/lib/game/characterCatalog";
import { calculateDamage } from "@/lib/game/damage";
import { applyDefeatPassives } from "@/lib/game/onDefeat";
import { isGoalMet, type StageRunSummary } from "@/lib/game/stageMissions";
import type { BattleCharacter } from "@/types/character";

/**
 * The chapter 1 checkpoint fight (2026-08-21) landed four kits and four engine
 * capabilities they needed. These cover the capabilities; the kits themselves
 * are covered by the catalog/art/schema guards that already run over the whole
 * roster.
 */

function unit(over: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    id: "u",
    instanceId: "u1",
    name: "Unit",
    color: "red",
    team: "enemy",
    hp: 1000,
    currentHP: 1000,
    atk: 100,
    def: 100,
    currentAttack: 100,
    currentDefense: 100,
    buffs: [],
    debuffs: [],
    passiveState: {},
    ...over,
  } as BattleCharacter;
}

const noop = () => {};

describe("onDefeat passives", () => {
  const bruiserPassive = {
    name: "Paid in Advance",
    trigger: "onDefeat" as const,
    mechanics: [
      { type: "heal" as const, maxHpPercent: 20 },
      { type: "buff" as const, stat: "atk", valuePercent: 20, duration: 2 },
    ],
  };

  it("pays out to living allies when the owner dies", () => {
    const dead = unit({ instanceId: "a", currentHP: 0, passive: bruiserPassive });
    const ally = unit({ instanceId: "b", currentHP: 400, hp: 1000 });
    const teams = { playerTeam: [], enemyTeam: [dead, ally] };

    expect(applyDefeatPassives(teams, noop)).toBe(1);
    expect(ally.currentHP).toBe(600); // +20% of its OWN max HP
    expect(ally.buffs).toHaveLength(1);
    expect(ally.buffs[0]).toMatchObject({ stat: "atk", valuePercent: 20 });
  });

  it("fires once, however many times the pass runs", () => {
    const dead = unit({ instanceId: "a", currentHP: 0, passive: bruiserPassive });
    const ally = unit({ instanceId: "b", currentHP: 400 });
    const teams = { playerTeam: [], enemyTeam: [dead, ally] };

    applyDefeatPassives(teams, noop);
    // A corpse stays on the field until turn-start cleanup, so the pass will
    // see it again on the very next action.
    expect(applyDefeatPassives(teams, noop)).toBe(0);
    expect(ally.currentHP).toBe(600);
    expect(ally.buffs).toHaveLength(1);
  });

  it("does not heal the dead — including itself", () => {
    const dead = unit({ instanceId: "a", currentHP: 0, passive: bruiserPassive });
    const alsoDead = unit({ instanceId: "b", currentHP: 0 });
    const teams = { playerTeam: [], enemyTeam: [dead, alsoDead] };

    applyDefeatPassives(teams, noop);
    expect(dead.currentHP).toBe(0);
    expect(alsoDead.currentHP).toBe(0);
  });

  it("ignores a living unit that happens to carry the trigger", () => {
    const alive = unit({ currentHP: 1, passive: bruiserPassive });
    const teams = { playerTeam: [], enemyTeam: [alive] };
    expect(applyDefeatPassives(teams, noop)).toBe(0);
  });
});

describe("targetTagBonus conditionStatuses", () => {
  const enforcer = unit({
    passive: {
      name: "Open Wound",
      trigger: "always",
      mechanics: [
        {
          type: "targetTagBonus",
          conditionStatuses: ["bleed"],
          valuePercent: 25,
        },
      ],
    },
  });

  const hit = (target: BattleCharacter) =>
    calculateDamage({
      baseDamage: 1000,
      skillMechanics: [],
      target,
      attacker: enforcer,
    });

  it("raises damage against a target carrying the status", () => {
    const clean = unit({ instanceId: "t1", team: "player" });
    const bleeding = unit({
      instanceId: "t2",
      team: "player",
      // Exactly how combat.ts stores a Bleed: a named damageOverTime entry.
      debuffs: [
        { type: "damageOverTime", name: "Bleed", value: 10, debuffDuration: 2 },
      ],
    });

    expect(hit(bleeding)).toBeGreaterThan(hit(clean));
    expect(hit(bleeding) / hit(clean)).toBeCloseTo(1.25, 2);
  });

  it("matches on the stored name, not a made-up type", () => {
    // The guard that would have caught the original bug: `bleed` is not a
    // StatusEffectType at all, so a type-only matcher never fires.
    const wrongShape = unit({
      instanceId: "t5",
      team: "player",
      debuffs: [{ type: "damageOverTime", value: 10, debuffDuration: 2 }],
    });
    expect(hit(wrongShape)).toBe(hit(unit({ instanceId: "t6", team: "player" })));
  });

  it("is a status check, not a tag check — a matching tag does not count", () => {
    const tagged = unit({ instanceId: "t3", team: "player", tags: ["bleed"] });
    const clean = unit({ instanceId: "t4", team: "player" });
    expect(hit(tagged)).toBe(hit(clean));
  });
});

describe("useSkillRank mission goal", () => {
  const run = (over: Partial<StageRunSummary> = {}): StageRunSummary => ({
    wavesCleared: 2,
    wavesTotal: 2,
    turns: 8,
    fielded: ["duke"],
    fallen: [],
    ultimatesUsed: 0,
    rankUses: { 1: 0, 2: 0, 3: 0 },
    isRetry: false,
    ...over,
  });

  it("counts plays of exactly that rank", () => {
    const r = run({ rankUses: { 1: 9, 2: 5, 3: 1 } });
    expect(isGoalMet({ type: "useSkillRank", rank: 2, count: 5 }, r)).toBe(true);
    expect(isGoalMet({ type: "useSkillRank", rank: 2, count: 6 }, r)).toBe(false);
  });

  it("does not let a lower rank satisfy a higher one", () => {
    // Nine rank-1 plays are not three rank-3 plays, however many there are.
    const r = run({ rankUses: { 1: 9, 2: 0, 3: 0 } });
    expect(isGoalMet({ type: "useSkillRank", rank: 3, count: 3 }, r)).toBe(false);
  });
});

describe("the four kits load with the shape the fight needs", () => {
  it("gives every checkpoint kit two skills and an ultimate", () => {
    for (const id of [
      "ford_bandit",
      "checkpoint_bruiser",
      "checkpoint_enforcer",
      "toll_collector",
    ]) {
      const kit = getCharacterById(id);
      expect(kit, id).toBeDefined();
      expect(kit!.skills, id).toHaveLength(2);
      expect(kit!.ultimate, id).toBeDefined();
    }
  });

  it("keeps the generic enemies off the premium colours", () => {
    // Light and dark are premium and are not spent on story mobs
    // (Tanveer, 2026-08-21).
    for (const id of [
      "ford_bandit",
      "checkpoint_bruiser",
      "checkpoint_enforcer",
      "toll_collector",
    ]) {
      expect(["red", "blue", "green"], id).toContain(getCharacterById(id)!.color);
    }
  });
});

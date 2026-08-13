import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import type { BattleActionEvent } from "@/types/battleEvent";

/**
 * Ruling #71 — a hit whose damage nulls to 0 reads "Tanked", and the effects
 * that only exist because the hit landed do not proc.
 *
 * Reported case: Volcanic Frost resolved for 0 against ~400 DEF and still
 * applied `decay (0/turn)`.
 *
 * Scope is deliberately narrow (Tanveer, 2026-08-13): DoTs and ult-gauge
 * depletion. Stun/freeze and the stat debuffs are the same shape and are
 * explicitly deferred — the tests below pin that boundary so a later session
 * widening it does so on purpose.
 */

function makeChar(
  overrides: Partial<BattleCharacter> & {
    instanceId: string;
    team: "player" | "enemy";
  },
): BattleCharacter {
  const dummy: SkillCard = {
    skillName: "Dummy",
    characterId: "dummy",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [100, 100, 100],
  };
  return {
    id: overrides.instanceId,
    name: overrides.instanceId,
    color: "red",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [dummy, dummy] as [SkillCard, SkillCard],
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 0,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    ...overrides,
  } as BattleCharacter;
}

/** Damage-reduction drags the post-DEF floor of 1 under 1.0, so the floored
 *  result is 0. That is the only way a null is produced — calculateDamage
 *  already floors `baseDamage - DEF` at 1. */
function wall(instanceId: string): BattleCharacter {
  return makeChar({
    instanceId,
    team: "enemy",
    def: 4000,
    currentDefense: 4000,
    buffs: [
      {
        type: "buff",
        stat: "damageReduction",
        valuePercent: 60,
        uncancellable: true,
        name: "Bulwark",
      },
    ],
  } as Partial<BattleCharacter> & { instanceId: string; team: "enemy" });
}

function run(skill: SkillCard, target: BattleCharacter) {
  const attacker = makeChar({ instanceId: "a", team: "player" });
  const lines: string[] = [];
  const events: BattleActionEvent[] = [];
  const teams = executeSkill(
    { sourceInstanceId: "a", targetInstanceId: target.instanceId, skill, rank: 1 },
    { playerTeam: [attacker], enemyTeam: [target] },
    (e) => lines.push(e),
    0,
    () => 0.99,
    (e) => events.push(e),
  );
  return { teams, lines, events, victim: teams.enemyTeam[0] };
}

const decayStrike: SkillCard = {
  skillName: "Volcanic Frost",
  characterId: "attacker",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 150, 200],
  mechanics: [{ type: "decay", stacks: 1, duration: 3, damagePercent: 10 }],
} as SkillCard;

describe("a tanked hit", () => {
  it("resolves for 0 and flags the target as tanked", () => {
    const { events, victim } = run(decayStrike, wall("v"));
    expect(events[0].targets[0].damage).toBe(0);
    expect(events[0].targets[0].tanked).toBe(true);
    expect(victim.currentHP).toBe(1000);
  });

  it("reads 'Tanked' instead of 'dealt 0 damage'", () => {
    const { lines } = run(decayStrike, wall("v"));
    const action = lines.find((l) => l.includes("Volcanic Frost"));
    expect(action).toContain("Tanked");
    expect(action).not.toContain("dealt 0 damage");
  });

  it("does not apply decay at all — not decay valued at zero", () => {
    const { victim } = run(decayStrike, wall("v"));
    expect(victim.debuffs.some((d) => d.type === "decay")).toBe(false);
  });

  it("does not deplete the ult gauge (Isolde's S2 shape)", () => {
    const target = wall("v");
    target.ultGauge = 3;
    const { victim } = run(
      {
        skillName: "Gauge Break",
        characterId: "attacker",
        type: "attack",
        statMultiplier: "atk",
        damageRanked: [100, 150, 200],
        mechanics: [{ type: "lowerUltGauge", value: 1 }],
      } as SkillCard,
      target,
    );
    expect(victim.ultGauge).toBe(3);
  });

  it("skips every DoT family, not just the damage-scaled ones", () => {
    // Corrosion and ignite are percent/stack based, so they would have landed
    // at full strength off a hit that did nothing.
    const { victim } = run(
      {
        skillName: "Rotting Touch",
        characterId: "attacker",
        type: "attack",
        statMultiplier: "atk",
        damageRanked: [100, 150, 200],
        mechanics: [
          { type: "corrosion", valuePercent: 10, duration: 2 },
          { type: "ignite", stacks: 2, duration: 3 },
          { type: "bleed", damagePercent: 90, duration: 2 },
          { type: "shock", damagePercent: 30, duration: 4 },
        ],
      } as SkillCard,
      wall("v"),
    );
    expect(victim.debuffs).toHaveLength(0);
  });

  it("still applies effects that resolve BEFORE the damage step", () => {
    // Tanveer's clause-order rule: "Cancels buffs, does damage …, greatly
    // lowers ATK and DEF" — the cancel precedes the damage and still fires.
    const target = wall("v");
    target.buffs.push({
      type: "buff",
      stat: "atk",
      valuePercent: 30,
      name: "Rally",
    });
    const { victim, lines } = run(
      {
        skillName: "Evil Spirit",
        characterId: "attacker",
        type: "attack",
        statMultiplier: "atk",
        damageRanked: [100, 150, 200],
        mechanics: [{ type: "cancelBuffs" }],
      } as SkillCard,
      target,
    );
    expect(victim.buffs.some((b) => b.name === "Rally")).toBe(false);
    expect(lines.join("\n")).toContain("cancelled buffs");
  });

  it("does not stun — hard CC rides on the hit landing too", () => {
    // Tanveer, 2026-08-13: "null them if the damage resulted in null". Freeze
    // is unimplemented but is a stun variant, so it inherits this rule.
    const { victim } = run(
      {
        skillName: "Concussive Blow",
        characterId: "attacker",
        type: "attack",
        statMultiplier: "atk",
        damageRanked: [100, 150, 200],
        mechanics: [{ type: "stun", duration: 2 }],
      } as SkillCard,
      wall("v"),
    );
    expect(victim.debuffs.some((d) => d.type === "stun")).toBe(false);
  });

  it("still applies a plain stat debuff — not ruled on yet", () => {
    // The stat debuffs are the same shape and will probably follow, but they
    // have not been ruled. Pinned so widening the set stays deliberate.
    const { victim } = run(
      {
        skillName: "Sapping Strike",
        characterId: "attacker",
        type: "attack",
        statMultiplier: "atk",
        damageRanked: [100, 150, 200],
        mechanics: [{ type: "debuff", stat: "atk", valuePercent: 30, duration: 2 }],
      } as SkillCard,
      wall("v"),
    );
    expect(victim.debuffs.some((d) => d.type === "debuff")).toBe(true);
  });
});

describe("a hit that lands is unaffected", () => {
  it("applies its DoT normally at 1 damage", () => {
    const soft = makeChar({ instanceId: "v", team: "enemy" });
    const { victim, events } = run(decayStrike, soft);
    expect(events[0].targets[0].tanked).toBeUndefined();
    expect(events[0].targets[0].damage).toBeGreaterThan(0);
    expect(victim.debuffs.some((d) => d.type === "decay")).toBe(true);
  });

  it("a skill that never intended damage is not a null", () => {
    // Draw Fire taunts for 0 damage by design — it must not read "Tanked".
    const soft = makeChar({ instanceId: "v", team: "enemy" });
    const { events, lines } = run(
      {
        skillName: "Draw Fire",
        characterId: "attacker",
        type: "debuff",
        statMultiplier: "atk",
        damageRanked: [0, 0, 0],
        mechanics: [{ type: "taunt", duration: 2 }],
      } as SkillCard,
      soft,
    );
    expect(events[0].targets[0].tanked).toBeUndefined();
    expect(lines.join("\n")).not.toContain("Tanked");
  });
});

describe("an AoE that nulls on one target only", () => {
  it("skips the DoT for the tanked unit and applies it to the others", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const tank = wall("tank");
    const soft = makeChar({ instanceId: "soft", team: "enemy" });
    const events: BattleActionEvent[] = [];

    const teams = executeSkill(
      {
        sourceInstanceId: "a",
        targetInstanceId: "tank",
        skill: {
          ...decayStrike,
          mechanics: [
            { type: "aoe" },
            { type: "decay", stacks: 1, duration: 3, damagePercent: 10 },
          ],
        } as SkillCard,
        rank: 1,
      },
      { playerTeam: [attacker], enemyTeam: [tank, soft] },
      () => {},
      0,
      () => 0.99,
      (e) => events.push(e),
    );

    const tanked = teams.enemyTeam.find((c) => c.instanceId === "tank")!;
    const hit = teams.enemyTeam.find((c) => c.instanceId === "soft")!;
    expect(tanked.debuffs.some((d) => d.type === "decay")).toBe(false);
    expect(hit.debuffs.some((d) => d.type === "decay")).toBe(true);
  });
});

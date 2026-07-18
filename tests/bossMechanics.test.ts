import { describe, expect, it } from "vitest";
import { tickTeamDebuffs } from "@/lib/game/tick";
import { executeSkill } from "@/lib/game/combat";
import { ultGaugeMax, DEFAULT_ULT_GAUGE_MAX } from "@/lib/game/ultGauge";
import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";
import type { SkillCard } from "@/types/skillCard";

function char(over: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    id: "m",
    name: "Mob",
    color: "dark",
    atk: 100,
    def: 50,
    hp: 1000,
    skills: [] as unknown as BattleCharacter["skills"],
    instanceId: "m1",
    currentHP: 1000,
    currentAttack: 100,
    currentDefense: 50,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team: "player",
    ...over,
  } as BattleCharacter;
}

const noop = () => {};

describe("ultGaugeMax", () => {
  it("defaults to 5", () => {
    expect(ultGaugeMax({})).toBe(DEFAULT_ULT_GAUGE_MAX);
    expect(ultGaugeMax({})).toBe(5);
  });
  it("honors a per-character override (Molvarr = 10)", () => {
    expect(ultGaugeMax({ ultGaugeMax: 10 })).toBe(10);
  });
});

describe("Corrosion DoT (10% max HP per stack per turn)", () => {
  const corrosion = (over: Partial<StatusEffect> = {}): StatusEffect => ({
    type: "corrosion",
    name: "Corrosion",
    valuePercent: 10,
    stacks: 1,
    debuffDuration: 2,
    ...over,
  });

  it("deals 10% of MAX HP at the victim's turn end", () => {
    const [ticked] = tickTeamDebuffs([char({ debuffs: [corrosion()] })], noop);
    expect(ticked.currentHP).toBe(900); // 10% of 1000
  });

  it("is based on max HP, not current HP", () => {
    const [ticked] = tickTeamDebuffs(
      [char({ currentHP: 500, debuffs: [corrosion()] })],
      noop,
    );
    expect(ticked.currentHP).toBe(400); // still 100 (10% of max 1000), not 50
  });

  it("stacks uncapped — 3 stacks = 30% max HP", () => {
    const [ticked] = tickTeamDebuffs(
      [char({ debuffs: [corrosion({ stacks: 3 })] })],
      noop,
    );
    expect(ticked.currentHP).toBe(700); // 30% of 1000
  });

  it("multiple independent corrosion entries sum", () => {
    const [ticked] = tickTeamDebuffs(
      [char({ debuffs: [corrosion(), corrosion()] })],
      noop,
    );
    expect(ticked.currentHP).toBe(800); // 100 + 100
  });

  it("decrements duration and expires", () => {
    let team = [char({ debuffs: [corrosion({ debuffDuration: 2 })] })];
    team = tickTeamDebuffs(team, noop);
    expect(team[0].debuffs[0].debuffDuration).toBe(1);
    team = tickTeamDebuffs(team, noop);
    expect(team[0].debuffs.some((d) => d.type === "corrosion")).toBe(false);
    expect(team[0].currentHP).toBe(800); // two ticks of 100
  });
});

describe("CC immunity", () => {
  const stunSkill: SkillCard = {
    skillName: "Bash",
    characterId: "p",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [50, 50, 50],
    mechanics: [{ type: "stun", duration: 1 }],
  };

  const run = (targetImmune: boolean) => {
    const attacker = char({ instanceId: "p1", team: "player" });
    const target = char({
      instanceId: "e1",
      team: "enemy",
      ccImmune: targetImmune,
    });
    return executeSkill(
      {
        sourceInstanceId: "p1",
        skill: stunSkill,
        targetInstanceId: "e1",
      },
      { playerTeam: [attacker], enemyTeam: [target] },
      noop,
      0,
      () => 0.99, // never evade
    );
  };

  it("blocks stun on a CC-immune target", () => {
    const res = run(true);
    expect(res.enemyTeam[0].debuffs.some((d) => d.type === "stun")).toBe(false);
  });

  it("still stuns a normal target", () => {
    const res = run(false);
    expect(res.enemyTeam[0].debuffs.some((d) => d.type === "stun")).toBe(true);
  });
});

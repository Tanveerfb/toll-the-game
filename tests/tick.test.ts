import { describe, expect, it } from "vitest";
import { tickTeamEffects } from "@/lib/game/tick";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";

const noopLog = () => {};

function makeChar(
  overrides: Partial<BattleCharacter> & { instanceId: string },
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
    color: "blue",
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
    team: "player",
    ...overrides,
  } as BattleCharacter;
}

describe("tickTeamEffects", () => {
  it("decrements durations and drops expired effects", () => {
    const char = makeChar({
      instanceId: "c1",
      buffs: [{ type: "buff", stat: "atk", valuePercent: 10, buffDuration: 2 }],
      debuffs: [{ type: "stun", debuffDuration: 1 }],
    });
    const [after1] = tickTeamEffects([char], noopLog);
    expect(after1.buffs[0].buffDuration).toBe(1);
    expect(after1.debuffs).toHaveLength(0); // 1-turn stun expires on the tick

    const [after2] = tickTeamEffects([after1], noopLog);
    expect(after2.buffs).toHaveLength(0);
  });

  it("a 2-turn stun applied mid-turn survives exactly one tick", () => {
    // Stun semantics (#9): applied during the opposing action phase with
    // duration 2, it survives the next turn-start tick (blocking that turn)
    // and expires on the following one.
    const char = makeChar({
      instanceId: "c1",
      debuffs: [{ type: "stun", debuffDuration: 2 }],
    });
    const [tick1] = tickTeamEffects([char], noopLog);
    expect(tick1.debuffs.some((d) => d.type === "stun")).toBe(true);
    const [tick2] = tickTeamEffects([tick1], noopLog);
    expect(tick2.debuffs.some((d) => d.type === "stun")).toBe(false);
  });

  it("durationless effects persist", () => {
    const char = makeChar({
      instanceId: "c1",
      buffs: [{ type: "buff", stat: "def", valuePercent: 20 }],
    });
    const [after] = tickTeamEffects([char], noopLog);
    expect(after.buffs).toHaveLength(1);
  });

  it("applies DoT (value + decay capturedDamage) and HoT", () => {
    const char = makeChar({
      instanceId: "c1",
      currentHP: 500,
      buffs: [{ type: "healOverTime", value: 50, buffDuration: 2 }],
      debuffs: [
        { type: "damageOverTime", value: 30, debuffDuration: 2 },
        { type: "decay", capturedDamage: 20, debuffDuration: 2 },
      ],
    });
    const [after] = tickTeamEffects([char], noopLog);
    // 500 - (30 + 20) + 50
    expect(after.currentHP).toBe(500);
  });

  it("DoT cannot reduce below 0 and HoT cannot exceed max HP", () => {
    const dying = makeChar({
      instanceId: "dying",
      currentHP: 10,
      debuffs: [{ type: "damageOverTime", value: 500, debuffDuration: 1 }],
    });
    const full = makeChar({
      instanceId: "full",
      currentHP: 990,
      buffs: [{ type: "healOverTime", value: 100, buffDuration: 1 }],
    });
    const [d, f] = tickTeamEffects([dying, full], noopLog);
    expect(d.currentHP).toBe(0);
    expect(f.currentHP).toBe(1000);
  });

  it("skips dead characters and resets per-turn passive flags", () => {
    const dead = makeChar({
      instanceId: "dead",
      currentHP: 0,
      debuffs: [{ type: "stun", debuffDuration: 1 }],
    });
    const flagged = makeChar({
      instanceId: "flagged",
      passiveState: { firstActionTriggeredThisTurn: true },
    });
    const [d, f] = tickTeamEffects([dead, flagged], noopLog);
    expect(d.debuffs).toHaveLength(1); // untouched
    expect(f.passiveState.firstActionTriggeredThisTurn).toBe(false);
  });
});

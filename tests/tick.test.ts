import { describe, expect, it } from "vitest";
import { tickTeamBuffs, tickTeamDebuffs } from "@/lib/game/tick";
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

describe("tickTeamBuffs (own turn start)", () => {
  it("a 1-turn buff survives the opposing turn and expires as the next own turn begins", () => {
    // Ruling #21: buff applied on your turn -> protected through the whole
    // enemy turn -> gone when your next turn starts.
    const char = makeChar({
      instanceId: "c1",
      buffs: [{ type: "buff", stat: "atk", valuePercent: 10, buffDuration: 1 }],
    });
    const [after] = tickTeamBuffs([char], noopLog);
    expect(after.buffs).toHaveLength(0);
  });

  it("decrements multi-turn buffs without touching debuffs", () => {
    const char = makeChar({
      instanceId: "c1",
      buffs: [{ type: "buff", stat: "atk", valuePercent: 10, buffDuration: 2 }],
      debuffs: [{ type: "stun", debuffDuration: 1 }],
    });
    const [after] = tickTeamBuffs([char], noopLog);
    expect(after.buffs[0].buffDuration).toBe(1);
    expect(after.debuffs).toHaveLength(1);
  });

  it("durationless buffs persist", () => {
    const char = makeChar({
      instanceId: "c1",
      buffs: [{ type: "buff", stat: "def", valuePercent: 20 }],
    });
    const [after] = tickTeamBuffs([char], noopLog);
    expect(after.buffs).toHaveLength(1);
  });

  it("procs HoT capped at max HP and resets per-turn passive flags", () => {
    const healing = makeChar({
      instanceId: "healing",
      currentHP: 990,
      buffs: [{ type: "healOverTime", value: 100, buffDuration: 1 }],
      passiveState: { firstActionTriggeredThisTurn: true },
    });
    const [after] = tickTeamBuffs([healing], noopLog);
    expect(after.currentHP).toBe(1000);
    expect(after.buffs).toHaveLength(0); // HoT 1 = heals exactly once
    expect(after.passiveState.firstActionTriggeredThisTurn).toBe(false);
  });
});

describe("tickTeamDebuffs (own turn end)", () => {
  it("a 1-turn stun blocks exactly one turn: present during the turn, gone at its end", () => {
    const char = makeChar({
      instanceId: "c1",
      debuffs: [{ type: "stun", debuffDuration: 1 }],
    });
    // During the victim's turn the stun is present (blocks the turn) …
    expect(char.debuffs.some((d) => d.type === "stun")).toBe(true);
    // … and the end-of-turn tick removes it.
    const [after] = tickTeamDebuffs([char], noopLog);
    expect(after.debuffs.some((d) => d.type === "stun")).toBe(false);
  });

  it("a 2-turn stun blocks two turns", () => {
    const char = makeChar({
      instanceId: "c1",
      debuffs: [{ type: "stun", debuffDuration: 2 }],
    });
    const [tick1] = tickTeamDebuffs([char], noopLog);
    expect(tick1.debuffs.some((d) => d.type === "stun")).toBe(true);
    const [tick2] = tickTeamDebuffs([tick1], noopLog);
    expect(tick2.debuffs.some((d) => d.type === "stun")).toBe(false);
  });

  it("a 1-turn DoT procs exactly once, then disappears", () => {
    // Tanveer's walkthrough: bleed applied on turn 1 -> victim plays their
    // turn (cleanse window) -> proc -> gone.
    const char = makeChar({
      instanceId: "c1",
      currentHP: 500,
      debuffs: [{ type: "damageOverTime", value: 30, debuffDuration: 1 }],
    });
    const [after] = tickTeamDebuffs([char], noopLog);
    expect(after.currentHP).toBe(470);
    expect(after.debuffs).toHaveLength(0);
    const [again] = tickTeamDebuffs([after], noopLog);
    expect(again.currentHP).toBe(470);
  });

  it("a 2-turn DoT procs twice", () => {
    const char = makeChar({
      instanceId: "c1",
      currentHP: 500,
      debuffs: [{ type: "damageOverTime", value: 30, debuffDuration: 2 }],
    });
    const [tick1] = tickTeamDebuffs([char], noopLog);
    expect(tick1.currentHP).toBe(470);
    const [tick2] = tickTeamDebuffs([tick1], noopLog);
    expect(tick2.currentHP).toBe(440);
    expect(tick2.debuffs).toHaveLength(0);
  });

  it("applies decay capturedDamage, cannot reduce below 0, sets tookDamageThisRound", () => {
    const dying = makeChar({
      instanceId: "dying",
      currentHP: 10,
      debuffs: [
        { type: "damageOverTime", value: 500, debuffDuration: 1 },
        { type: "decay", capturedDamage: 20, debuffDuration: 1 },
      ],
    });
    const [after] = tickTeamDebuffs([dying], noopLog);
    expect(after.currentHP).toBe(0);
    expect(after.passiveState.tookDamageThisRound).toBe(true);
  });

  it("lethal DoT triggers Nine Lives; the revival cleanses ALL buffs and debuffs (ruling #29)", () => {
    const sara = makeChar({
      instanceId: "sara",
      currentHP: 400,
      passive: {
        name: "Nine Lives",
        trigger: "onLethalDamage",
        mechanics: [
          { type: "surviveLethal", hpConditionPercent: 30, healDamagePercent: 50 },
        ],
      },
      buffs: [
        { type: "buff", stat: "atk", valuePercent: 30, uncancellable: true },
      ],
      debuffs: [{ type: "damageOverTime", value: 999, debuffDuration: 3 }],
    });
    const [after] = tickTeamDebuffs([sara], noopLog);
    expect(after.currentHP).toBe(Math.floor(999 * 0.5)); // heals 50% of the proc
    expect(after.passiveState.lethalSurvived).toBe(true);
    expect(after.buffs).toHaveLength(0); // even uncancellable buffs are wiped
    expect(after.debuffs).toHaveLength(0); // the DoT itself is gone too
    expect(after.passiveState.tookDamageThisRound).toBe(true);
  });

  it("Nine Lives does not catch a lethal DoT below the HP threshold or twice", () => {
    const passive: import("@/types/passive").Passive = {
      name: "Nine Lives",
      trigger: "onLethalDamage",
      mechanics: [
        { type: "surviveLethal", hpConditionPercent: 30, healDamagePercent: 50 },
      ],
    };
    const lowHp = makeChar({
      instanceId: "low",
      currentHP: 100, // below 30% of 1000
      passive,
      debuffs: [{ type: "damageOverTime", value: 200, debuffDuration: 1 }],
    });
    const [deadLow] = tickTeamDebuffs([lowHp], noopLog);
    expect(deadLow.currentHP).toBe(0);

    const usedUp = makeChar({
      instanceId: "used",
      currentHP: 400,
      passive,
      passiveState: { lethalSurvived: true },
      debuffs: [{ type: "damageOverTime", value: 999, debuffDuration: 1 }],
    });
    const [deadUsed] = tickTeamDebuffs([usedUp], noopLog);
    expect(deadUsed.currentHP).toBe(0);
  });

  it("skips dead characters", () => {
    const dead = makeChar({
      instanceId: "dead",
      currentHP: 0,
      debuffs: [{ type: "stun", debuffDuration: 1 }],
    });
    const [after] = tickTeamDebuffs([dead], noopLog);
    expect(after.debuffs).toHaveLength(1); // untouched
  });
});

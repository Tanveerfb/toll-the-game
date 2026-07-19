import { describe, expect, it } from "vitest";
import {
  bossPhaseCount,
  enterBossPhase,
  shouldAdvancePhase,
  transitionBossPhases,
} from "@/lib/game/phases";
import type { BattleCharacter, CharacterPhase } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";

const skill = (name: string): SkillCard => ({
  skillName: name,
  characterId: "boss",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 100, 100],
});

const phase2: CharacterPhase = {
  hp: 4000,
  atk: 210,
  def: 145,
  skills: [skill("P2a"), skill("P2b"), skill("P2c")], // any count
};

function boss(over: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    id: "molvarr",
    name: "Molvarr",
    color: "dark",
    atk: 150,
    def: 110,
    hp: 3000,
    tier: "elite",
    phases: [
      { hp: 3000, atk: 150, def: 110, skills: [skill("P1a"), skill("P1b")] },
      phase2,
    ],
    skills: [skill("P1a"), skill("P1b")],
    instanceId: "e1",
    currentHP: 3000,
    currentAttack: 150,
    currentDefense: 110,
    ultGauge: 4,
    buffs: [{ type: "buff", stat: "atk", valuePercent: 50, buffDuration: 2 }],
    debuffs: [{ type: "stun", debuffDuration: 1 }],
    passiveState: { phaseTurns: 7 },
    team: "enemy",
    phaseIndex: 0,
    ...over,
  } as BattleCharacter;
}

describe("boss phases", () => {
  it("counts phases", () => {
    expect(bossPhaseCount(boss())).toBe(2);
    expect(bossPhaseCount({ phases: undefined })).toBe(0);
  });

  it("advances when HP hits 0 and a later phase exists", () => {
    expect(shouldAdvancePhase(boss({ currentHP: 0, phaseIndex: 0 }))).toBe(true);
  });

  it("does NOT advance on the final phase", () => {
    expect(shouldAdvancePhase(boss({ currentHP: 0, phaseIndex: 1 }))).toBe(false);
  });

  it("does NOT advance while still alive", () => {
    expect(shouldAdvancePhase(boss({ currentHP: 500, phaseIndex: 0 }))).toBe(false);
  });

  it("enters a phase with its stat block at full HP", () => {
    const next = enterBossPhase(boss({ currentHP: 0 }), 1);
    expect(next.phaseIndex).toBe(1);
    expect(next.atk).toBe(210);
    expect(next.def).toBe(145);
    expect(next.hp).toBe(4000);
    expect(next.currentHP).toBe(4000);
    expect(next.currentAttack).toBe(210);
    expect(next.skills).toHaveLength(3);
  });

  it("resets the boss (buffs, debuffs, gauge, per-phase state)", () => {
    const next = enterBossPhase(boss({ currentHP: 0 }), 1);
    expect(next.buffs).toEqual([]);
    expect(next.debuffs).toEqual([]);
    expect(next.ultGauge).toBe(0);
    expect(next.passiveState).toEqual({});
  });

  it("transitionBossPhases advances a downed phased boss, not other enemies", () => {
    const mob = boss({ instanceId: "e2", phases: undefined, currentHP: 0 });
    const downedBoss = boss({ currentHP: 0, phaseIndex: 0 });
    const result = transitionBossPhases([downedBoss, mob]);
    expect(result.transitions).toHaveLength(1);
    expect(result.team[0].phaseIndex).toBe(1); // boss advanced
    expect(result.team[0].currentHP).toBe(4000);
    expect(result.team[1].currentHP).toBe(0); // plain mob stays dead
    // Structured break info drives the phase-break flourish
    expect(result.breaks).toEqual([{ name: "Molvarr", phase: 2 }]);
  });

  it("transitionBossPhases is a no-op when nothing is downed", () => {
    const result = transitionBossPhases([boss({ currentHP: 3000 })]);
    expect(result.transitions).toHaveLength(0);
  });
});

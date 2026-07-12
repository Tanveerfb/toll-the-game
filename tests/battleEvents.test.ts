import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import type { UltimateCard } from "@/types/ultimateCard";
import type { BattleActionEvent } from "@/types/battleEvent";

const noopLog = () => {};

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

const strike: SkillCard = {
  skillName: "Strike",
  characterId: "attacker",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 150, 200],
};

function run(
  action: {
    sourceInstanceId: string;
    targetInstanceId: string;
    skill: SkillCard | UltimateCard;
    rank?: 1 | 2 | 3;
  },
  playerTeam: BattleCharacter[],
  enemyTeam: BattleCharacter[],
  rng: () => number = () => 0.99,
) {
  const events: BattleActionEvent[] = [];
  const teams = executeSkill(
    { rank: 1, ...action },
    { playerTeam, enemyTeam },
    noopLog,
    0,
    rng,
    (e) => events.push(e),
  );
  return { events, teams };
}

describe("battle event emission (animation sequencer contract)", () => {
  it("emits one action event with damage and exact hp snapshots", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const victim = makeChar({ instanceId: "v", team: "enemy", currentHP: 800 });
    const { events } = run(
      { sourceInstanceId: "a", targetInstanceId: "v", skill: strike },
      [attacker],
      [victim],
    );

    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.kind).toBe("action");
    expect(ev.sourceInstanceId).toBe("a");
    expect(ev.sourceTeam).toBe("player");
    expect(ev.isUlt).toBe(false);
    expect(ev.skillName).toBe("Strike");
    expect(ev.targets).toHaveLength(1);
    expect(ev.targets[0].instanceId).toBe("v");
    expect(ev.targets[0].damage).toBe(100);
    expect(ev.targets[0].hpBefore).toBe(800);
    expect(ev.targets[0].hpAfter).toBe(700);
    expect(ev.targets[0].killed).toBeUndefined();
  });

  it("flags kills (hpAfter 0) and ultimates", () => {
    const ult: UltimateCard = {
      skillName: "Finisher",
      characterId: "a",
      type: "ultimate",
      statMultiplier: "atk",
      damage: 300,
    };
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const victim = makeChar({ instanceId: "v", team: "enemy", currentHP: 50 });
    const { events } = run(
      { sourceInstanceId: "a", targetInstanceId: "v", skill: ult },
      [attacker],
      [victim],
    );

    expect(events[0].isUlt).toBe(true);
    expect(events[0].targets[0].killed).toBe(true);
    expect(events[0].targets[0].hpAfter).toBe(0);
  });

  it("marks evades without hp snapshots or damage", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const dodger = makeChar({
      instanceId: "v",
      team: "enemy",
      buffs: [{ type: "buff", stat: "evade", valuePercent: 100 }],
    });
    const { events } = run(
      { sourceInstanceId: "a", targetInstanceId: "v", skill: strike },
      [attacker],
      [dodger],
      () => 0, // roll under 100% evade
    );

    expect(events[0].targets[0].evaded).toBe(true);
    expect(events[0].targets[0].damage).toBeUndefined();
    expect(events[0].targets[0].hpAfter).toBeUndefined();
  });

  it("records heal amounts on heal skills", () => {
    const healSkill: SkillCard = {
      skillName: "Mend",
      characterId: "h",
      type: "heal",
      statMultiplier: "atk",
      damageRanked: [50, 75, 100],
    };
    const healer = makeChar({ instanceId: "h", team: "player" });
    const hurt = makeChar({ instanceId: "w", team: "player", currentHP: 500 });
    const { events } = run(
      { sourceInstanceId: "h", targetInstanceId: "w", skill: healSkill },
      [healer, hurt],
      [makeChar({ instanceId: "e", team: "enemy" })],
    );

    expect(events[0].targets[0].instanceId).toBe("w");
    expect(events[0].targets[0].heal).toBe(50);
    expect(events[0].targets[0].hpBefore).toBe(500);
    expect(events[0].targets[0].hpAfter).toBe(550);
  });

  it("captures counter strikes with the attacker's post-counter HP", () => {
    const attacker = makeChar({
      instanceId: "a",
      team: "player",
      currentHP: 300,
    });
    const counterer = makeChar({
      instanceId: "v",
      team: "enemy",
      buffs: [{ type: "stance", counterDamagePercent: 100 }],
    });
    const { events } = run(
      { sourceInstanceId: "a", targetInstanceId: "v", skill: strike },
      [attacker],
      [counterer],
    );

    expect(events[0].counters).toHaveLength(1);
    const counter = events[0].counters[0];
    expect(counter.byInstanceId).toBe("v");
    expect(counter.onInstanceId).toBe("a");
    expect(counter.damage).toBeGreaterThan(0);
    expect(counter.attackerHpAfter).toBe(300 - counter.damage);
  });

  it("emits nothing without an emitter (default path untouched)", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const victim = makeChar({ instanceId: "v", team: "enemy" });
    // No emit argument — must not throw
    const teams = executeSkill(
      {
        sourceInstanceId: "a",
        targetInstanceId: "v",
        skill: strike,
        rank: 1,
      },
      { playerTeam: [attacker], enemyTeam: [victim] },
      noopLog,
    );
    expect(teams.enemyTeam[0].currentHP).toBe(900);
  });
});

describe("optional enemy targeting (ruling 2026-07-12 — unmarked = random)", () => {
  it("picks a random living field enemy when no target is set", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const e1 = makeChar({ instanceId: "e1", team: "enemy" });
    const e2 = makeChar({ instanceId: "e2", team: "enemy" });
    // rng 0.99 → last pool slot (e2)
    const { teams } = run(
      { sourceInstanceId: "a", targetInstanceId: "", skill: strike },
      [attacker],
      [e1, e2],
      () => 0.99,
    );
    expect(teams.enemyTeam[0].currentHP).toBe(1000);
    expect(teams.enemyTeam[1].currentHP).toBe(900);
  });

  it("random pick skips dead enemies and subs", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const dead = makeChar({ instanceId: "dead", team: "enemy", currentHP: 0 });
    const sub = makeChar({ instanceId: "sub", team: "enemy", isSub: true });
    const alive = makeChar({ instanceId: "alive", team: "enemy" });
    // rng 0 → first pool slot; pool must contain only "alive"
    const { teams } = run(
      { sourceInstanceId: "a", targetInstanceId: "", skill: strike },
      [attacker],
      [dead, sub, alive],
      () => 0,
    );
    expect(teams.enemyTeam[2].currentHP).toBe(900);
    expect(teams.enemyTeam[1].currentHP).toBe(1000);
  });

  it("fizzles when every enemy is dead", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const dead = makeChar({ instanceId: "dead", team: "enemy", currentHP: 0 });
    const { teams, events } = run(
      { sourceInstanceId: "a", targetInstanceId: "", skill: strike },
      [attacker],
      [dead],
    );
    expect(teams.enemyTeam[0].currentHP).toBe(0);
    expect(events).toHaveLength(0);
  });

  it("a marked target is still honored", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const e1 = makeChar({ instanceId: "e1", team: "enemy" });
    const e2 = makeChar({ instanceId: "e2", team: "enemy" });
    const { teams } = run(
      { sourceInstanceId: "a", targetInstanceId: "e1", skill: strike },
      [attacker],
      [e1, e2],
      () => 0.99,
    );
    expect(teams.enemyTeam[0].currentHP).toBe(900);
    expect(teams.enemyTeam[1].currentHP).toBe(1000);
  });

  it("retargets when the marked enemy is already dead (focus-fire overkill)", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const dead = makeChar({ instanceId: "dead", team: "enemy", currentHP: 0 });
    const alive = makeChar({ instanceId: "alive", team: "enemy" });
    // Marked "dead" is invalid -> re-pick from living pool (only "alive").
    const { teams } = run(
      { sourceInstanceId: "a", targetInstanceId: "dead", skill: strike },
      [attacker],
      [dead, alive],
      () => 0,
    );
    expect(teams.enemyTeam[0].currentHP).toBe(0);
    expect(teams.enemyTeam[1].currentHP).toBe(900);
  });
});

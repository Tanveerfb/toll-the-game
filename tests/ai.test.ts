import { describe, expect, it } from "vitest";
import {
  ENEMY_ACTIONS_PER_TURN,
  freshAITurnContext,
  getAIMove,
  noteAIAction,
} from "@/lib/game/ai";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import type { UltimateCard } from "@/types/ultimateCard";

const attack: SkillCard = {
  skillName: "Attack",
  characterId: "x",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 100, 100],
};

const buffSkill: SkillCard = {
  skillName: "Rally",
  characterId: "x",
  type: "buff",
  statMultiplier: "atk",
  damageRanked: [0, 0, 0],
  mechanics: [{ type: "buff", stat: "atk", valuePercent: 30, duration: 2 }],
};

const healSkill: SkillCard = {
  skillName: "Mend",
  characterId: "x",
  type: "heal",
  statMultiplier: "hp",
  damageRanked: [20, 20, 20],
};

const stanceSkill: SkillCard = {
  skillName: "Guard",
  characterId: "x",
  type: "stance",
  statMultiplier: "def",
  damageRanked: [0, 0, 0],
  mechanics: [{ type: "stance", stat: "damageReduction", valuePercent: 40 }],
};

const debuffSkill: SkillCard = {
  skillName: "Sap",
  characterId: "x",
  type: "debuff",
  statMultiplier: "atk",
  damageRanked: [0, 0, 0],
  mechanics: [{ type: "debuff", stat: "atk", valuePercent: 25, duration: 2 }],
};

const ult: UltimateCard = {
  skillName: "Finisher",
  characterId: "x",
  type: "ultimate",
  statMultiplier: "atk",
  damage: 400,
};

function makeChar(
  overrides: Partial<BattleCharacter> & {
    instanceId: string;
    team: "player" | "enemy";
  },
): BattleCharacter {
  return {
    id: overrides.instanceId,
    name: overrides.instanceId,
    color: "red",
    atk: 100,
    def: 0,
    hp: 1000,
    skills: [attack, attack] as [SkillCard, SkillCard],
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

describe("getAIMove", () => {
  it("takes 3 actions per enemy turn by design", () => {
    expect(ENEMY_ACTIONS_PER_TURN).toBe(3);
  });

  it("returns an action from a living, non-stunned enemy", () => {
    const dead = makeChar({ instanceId: "dead", team: "enemy", currentHP: 0 });
    const stunned = makeChar({
      instanceId: "stunned",
      team: "enemy",
      debuffs: [{ type: "stun", debuffDuration: 1 }],
    });
    const alive = makeChar({ instanceId: "alive", team: "enemy" });
    const player = makeChar({ instanceId: "p1", team: "player" });

    for (let i = 0; i < 20; i++) {
      const action = getAIMove([dead, stunned, alive], [player]);
      expect(action?.sourceInstanceId).toBe("alive");
    }
  });

  it("may pick the same enemy more than once across a turn (no per-enemy limit)", () => {
    const only = makeChar({ instanceId: "only", team: "enemy" });
    const player = makeChar({ instanceId: "p1", team: "player" });
    const sources = Array.from(
      { length: ENEMY_ACTIONS_PER_TURN },
      () => getAIMove([only], [player])?.sourceInstanceId,
    );
    expect(sources).toEqual(["only", "only", "only"]);
  });

  it("returns null when all enemies are dead or all players are dead", () => {
    const enemy = makeChar({ instanceId: "e1", team: "enemy", currentHP: 0 });
    const player = makeChar({ instanceId: "p1", team: "player" });
    expect(getAIMove([enemy], [player])).toBeNull();

    const aliveEnemy = makeChar({ instanceId: "e2", team: "enemy" });
    const deadPlayer = makeChar({
      instanceId: "p2",
      team: "player",
      currentHP: 0,
    });
    expect(getAIMove([aliveEnemy], [deadPlayer])).toBeNull();
  });

  it("targets the lowest-HP player by default", () => {
    const enemy = makeChar({ instanceId: "e1", team: "enemy" });
    const healthy = makeChar({ instanceId: "healthy", team: "player" });
    const weak = makeChar({
      instanceId: "weak",
      team: "player",
      currentHP: 100,
    });
    const action = getAIMove([enemy], [healthy, weak]);
    expect(action?.targetInstanceId).toBe("weak");
  });

  it("respects taunt over default targeting", () => {
    const taunter = makeChar({ instanceId: "taunter", team: "player" });
    const weak = makeChar({ instanceId: "weak", team: "player", currentHP: 1 });
    const enemy = makeChar({
      instanceId: "e1",
      team: "enemy",
      debuffs: [{ type: "taunt", sourceId: "taunter", debuffDuration: 1 }],
    });
    const action = getAIMove([enemy], [taunter, weak]);
    expect(action?.targetInstanceId).toBe("taunter");
  });
});

describe("getAIMove priority order (ruling 2026-07-13)", () => {
  const player = () => makeChar({ instanceId: "p1", team: "player" });

  it("casts the ultimate first when the gauge is full", () => {
    const enemy = makeChar({
      instanceId: "e1",
      team: "enemy",
      skills: [buffSkill, attack],
      ultimate: ult,
      ultGauge: 5,
    });
    expect(getAIMove([enemy], [player()])?.skill.skillName).toBe("Finisher");
  });

  it("prefers a new buff over attacking, but only within the per-turn cap", () => {
    const enemy = makeChar({
      instanceId: "e1",
      team: "enemy",
      skills: [buffSkill, attack],
    });
    expect(getAIMove([enemy], [player()])?.skill.type).toBe("buff");
    const capped = { ...freshAITurnContext(), buffsUsed: 1 };
    expect(getAIMove([enemy], [player()], capped)?.skill.type).toBe("attack");
  });

  it("skips a buff that only re-applies a stat the unit already has", () => {
    const enemy = makeChar({
      instanceId: "e1",
      team: "enemy",
      skills: [buffSkill, attack],
      buffs: [{ type: "buff", stat: "atk", valuePercent: 30, buffDuration: 2 }],
    });
    expect(getAIMove([enemy], [player()])?.skill.type).toBe("attack");
  });

  it("heals when an ally is under 50%, and not otherwise", () => {
    const healer = makeChar({
      instanceId: "e1",
      team: "enemy",
      skills: [healSkill, attack],
    });
    const hurt = makeChar({
      instanceId: "e2",
      team: "enemy",
      currentHP: 300, // 30% of 1000
    });
    const healAction = getAIMove([healer, hurt], [player()]);
    expect(healAction?.skill.type).toBe("heal");
    expect(healAction?.targetInstanceId).toBe("e2");

    const healthy = makeChar({ instanceId: "e2", team: "enemy" });
    expect(getAIMove([healer, healthy], [player()])?.skill.type).toBe("attack");
  });

  it("takes a stance (capped) when no ult/buff/heal applies", () => {
    const enemy = makeChar({
      instanceId: "e1",
      team: "enemy",
      skills: [stanceSkill, attack],
    });
    expect(getAIMove([enemy], [player()])?.skill.type).toBe("stance");
    const capped = { ...freshAITurnContext(), stancesUsed: 1 };
    expect(getAIMove([enemy], [player()], capped)?.skill.type).toBe("attack");
  });

  it("does not re-take a stance it already holds", () => {
    const enemy = makeChar({
      instanceId: "e1",
      team: "enemy",
      skills: [stanceSkill, attack],
      buffs: [{ type: "stance", stat: "damageReduction", valuePercent: 40 }],
    });
    expect(getAIMove([enemy], [player()])?.skill.type).toBe("attack");
  });

  it("uses a debuff (capped) before a plain attack", () => {
    const enemy = makeChar({
      instanceId: "e1",
      team: "enemy",
      skills: [debuffSkill, attack],
    });
    expect(getAIMove([enemy], [player()])?.skill.type).toBe("debuff");
    const capped = { ...freshAITurnContext(), debuffsUsed: 1 };
    expect(getAIMove([enemy], [player()], capped)?.skill.type).toBe("attack");
  });

  it("noteAIAction bumps the matching per-turn cap", () => {
    const ctx = freshAITurnContext();
    noteAIAction(ctx, "buff");
    noteAIAction(ctx, "stance");
    noteAIAction(ctx, "disable");
    expect(ctx).toEqual({ buffsUsed: 1, stancesUsed: 1, debuffsUsed: 1 });
  });
});

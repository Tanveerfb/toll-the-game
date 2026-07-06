import { describe, expect, it } from "vitest";
import { ENEMY_ACTIONS_PER_TURN, getAIMove } from "@/lib/game/ai";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";

const attack: SkillCard = {
  skillName: "Attack",
  characterId: "x",
  type: "attack",
  statMultiplier: "atk",
  damageRanked: [100, 100, 100],
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

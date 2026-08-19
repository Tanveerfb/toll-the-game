import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import { executeSkill } from "@/lib/game/combat";
import { applyBossTurnStart } from "@/lib/game/bossPassives";

/**
 * Ruling #60, restated by Tanveer 2026-08-19 as an invariant with no
 * exceptions: "No new debuffs can be put on the char if the debuffimmune buff
 * or effect is active on said target character."
 *
 * The trap the ruling exists for: `executeSkill` gates on immunity, but
 * passives and boss passives apply debuffs *outside* that path, so each one
 * has to re-check by hand. Two sites were fixed that way in 2026-08-09 and the
 * ruling warned that "any new out-of-combat debuff applier needs the same
 * guard" — a warning with nothing enforcing it. These tests are the guard.
 */

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
    color: "blue",
    atk: 100,
    def: 0,
    hp: 5000,
    skills: [dummy, dummy] as [SkillCard, SkillCard],
    currentHP: 5000,
    currentAttack: 100,
    currentDefense: 0,
    ultGauge: 0,
    buffs: [],
    debuffs: [],
    passiveState: {},
    lifestealPercent: 0,
    ...overrides,
  } as BattleCharacter;
}

const IMMUNITY = {
  type: "buff" as const,
  debuffImmune: true,
  buffDuration: 3,
  name: "Debuff Immunity",
};

describe("debuff immunity blocks every applier (ruling #60)", () => {
  it("a skill's debuff does not land on an immune target", () => {
    const attacker = makeChar({ instanceId: "attacker", team: "player" });
    const target = makeChar({
      instanceId: "target",
      team: "enemy",
      buffs: [IMMUNITY],
    });
    const debuffCard: SkillCard = {
      skillName: "Wither",
      characterId: "attacker",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [100, 100, 100],
      mechanics: [
        { type: "debuff", stat: "atk", valuePercent: 30, duration: 2 },
      ],
    } as SkillCard;

    const result = executeSkill(
      {
        sourceInstanceId: "attacker",
        skill: debuffCard,
        targetInstanceId: "target",
        rank: 1,
      },
      { playerTeam: [attacker], enemyTeam: [target] },
      noopLog,
    );

    expect(result.enemyTeam[0].debuffs).toEqual([]);
    // The hit still lands — immunity blocks the effect, not the damage.
    expect(result.enemyTeam[0].currentHP).toBeLessThan(5000);
  });

  it("a boss passive's corrosion does not land on an immune player", () => {
    const boss = makeChar({
      instanceId: "boss",
      team: "enemy",
      passive: {
        name: "Corrosive Tide",
        description: "",
        mechanics: [{ type: "bossApplyCorrosion", perTurn: 1, duration: 2 }],
      },
    } as never);
    const immune = makeChar({
      instanceId: "immune",
      team: "player",
      buffs: [IMMUNITY],
    });
    const exposed = makeChar({ instanceId: "exposed", team: "player" });

    const { playerTeam } = applyBossTurnStart(
      [boss],
      [immune, exposed],
      noopLog,
    );

    expect(playerTeam[0].debuffs).toEqual([]);
    // The control: without immunity the same call *does* corrode, so a pass
    // here can never mean "the mechanic simply didn't fire".
    expect(playerTeam[1].debuffs.length).toBeGreaterThan(0);
  });

  it("only the known appliers create debuffs, and each checks immunity", () => {
    // The regression this catches is a *fourth* applier appearing without the
    // guard. `tick.ts` is excluded deliberately: it decrements existing
    // durations and never creates an entry.
    const dir = path.join(process.cwd(), "lib", "game");
    const creators = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => {
        // The discriminator is *appending*, not the presence of a duration
        // field. `tick.ts` rebuilds every debuff each turn to decrement it —
        // textually identical to authoring one, behaviourally the opposite.
        // Adding an entry looks like `debuffs.push({` or `[...x.debuffs, {`.
        const src = fs.readFileSync(path.join(dir, f), "utf8");
        return /debuffs\.push\(|\.\.\.\w+\.debuffs,\s*\{/.test(src);
      })
      .sort();

    expect(creators).toEqual(["bossPassives.ts", "combat.ts", "passive.ts"]);

    for (const f of creators) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      expect(src, `${f} creates debuffs without checking debuffImmune`).toMatch(
        /debuffImmune/,
      );
    }
  });
});

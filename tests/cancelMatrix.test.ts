import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import { getAllCharacters } from "@/lib/game/characterCatalog";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
import type { StatusEffect } from "@/types/mechanic";

/**
 * Ruling #132 (Tanveer, 2026-09-16): a stance and a buff are different things,
 * and each cancel reaches exactly one of them.
 *
 *   cancelBuffs   → free-standing buffs only; a stance survives it
 *   cancelStances → the stance and every part of it; a plain buff survives it
 *
 * His example: a skill that *"applies taunt and raises defense for two turns"*
 * loses the DEF raise as well when its stance is cancelled, because that raise
 * is part of the stance — while *"a skill which just says raises defense by
 * 30% … would be affected by cancel buffs but it will not be affected by
 * cancel stances."*
 *
 * Before this, `cancelBuffs` swept everything cancellable, so a stance had no
 * defence against either mechanic and the distinction the two exist to draw
 * did not exist in the engine.
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
    ...overrides,
  } as BattleCharacter;
}

/** A taunt stance that also raises DEF — exactly the skill he described. */
const STANCE_ENTRIES: StatusEffect[] = [
  {
    type: "taunt",
    buffDuration: 2,
    appliedSeq: 1,
    groupId: "g1",
    groupName: "Hold the Line",
  } as StatusEffect,
  {
    type: "stance",
    stat: "def",
    valuePercent: 30,
    buffDuration: 2,
    groupId: "g1",
    groupName: "Hold the Line",
  } as StatusEffect,
];

/** A free-standing DEF buff from some other skill. */
const PLAIN_BUFF: StatusEffect = {
  type: "buff",
  stat: "def",
  valuePercent: 30,
  buffDuration: 2,
  name: "Rally",
} as StatusEffect;

function cancelWith(types: string[]): BattleCharacter {
  const victim = makeChar({
    instanceId: "victim",
    team: "enemy",
    buffs: [...STANCE_ENTRIES.map((e) => ({ ...e })), { ...PLAIN_BUFF }],
  });
  const attacker = makeChar({ instanceId: "attacker", team: "player" });
  const skill = {
    skillName: "Test Cancel",
    characterId: "attacker",
    type: "attack",
    statMultiplier: "atk",
    damageRanked: [10, 10, 10],
    mechanics: types.map((type) => ({ type })),
  } as unknown as SkillCard;
  const result = executeSkill(
    {
      sourceInstanceId: "attacker",
      skill,
      targetInstanceId: "victim",
      rank: 1,
    },
    { playerTeam: [attacker], enemyTeam: [victim] },
    noopLog,
    0,
    () => 0.99,
  );
  return result.enemyTeam[0];
}

const names = (u: BattleCharacter) =>
  u.buffs.map((b) => b.name ?? b.type).sort();

describe("#132 — cancelBuffs and cancelStances reach different things", () => {
  it("cancelStances takes the stance AND its DEF raise, sparing the plain buff", () => {
    // The DEF raise is part of the stance, so it goes with it — his example.
    expect(names(cancelWith(["cancelStances"]))).toEqual(["Rally"]);
  });

  it("cancelBuffs takes the plain buff and leaves the whole stance standing", () => {
    // This is the half that did not exist before #132: a stance used to be
    // swept by cancelBuffs like anything else.
    expect(names(cancelWith(["cancelBuffs"]))).toEqual(["stance", "taunt"]);
  });

  it("a skill carrying both clears everything cancellable", () => {
    // And it really runs both. They used to be `if` / `else if`, so the
    // second mechanic on a skill authoring both was unreachable.
    expect(names(cancelWith(["cancelBuffs", "cancelStances"]))).toEqual([]);
  });

  it("uncancellable entries survive either one", () => {
    const victim = makeChar({
      instanceId: "victim",
      team: "enemy",
      buffs: [
        {
          type: "stance",
          stat: "def",
          valuePercent: 30,
          uncancellable: true,
          groupId: "g1",
          groupName: "Unbreakable",
        } as StatusEffect,
        {
          type: "buff",
          stat: "atk",
          valuePercent: 30,
          uncancellable: true,
          name: "Permanent",
        } as StatusEffect,
      ],
    });
    const attacker = makeChar({ instanceId: "attacker", team: "player" });
    const skill = {
      skillName: "Test Cancel",
      characterId: "attacker",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [10, 10, 10],
      mechanics: [{ type: "cancelBuffs" }, { type: "cancelStances" }],
    } as unknown as SkillCard;
    const result = executeSkill(
      {
        sourceInstanceId: "attacker",
        skill,
        targetInstanceId: "victim",
        rank: 1,
      },
      { playerTeam: [attacker], enemyTeam: [victim] },
      noopLog,
      0,
      () => 0.99,
    );
    expect(names(result.enemyTeam[0])).toEqual(["Permanent", "stance"]);
  });
});

describe("#132 — membership is by group, not by entry type", () => {
  it("a DEF raise authored as a plain buff still belongs to its stance", () => {
    // The case the group exists for. Typed `buff`, but applied by a skill that
    // is a stance, so it goes with the stance and survives cancelBuffs — which
    // is exactly what Tanveer described: "applies taunt that raises defense
    // for two turns … cancel stances would also remove the defense buff".
    const stanceSkill = {
      skillName: "Hold the Line",
      characterId: "holder",
      type: "stance",
      statMultiplier: "def",
      damageRanked: [0, 0, 0],
      mechanics: [
        { type: "taunt", duration: 2 },
        { type: "buff", stat: "def", valuePercent: 30, duration: 2, targetSelf: true },
      ],
    } as unknown as SkillCard;

    const holder = makeChar({ instanceId: "holder", team: "enemy" });
    const mover = makeChar({ instanceId: "mover", team: "enemy" });
    const raised = executeSkill(
      {
        sourceInstanceId: "holder",
        skill: stanceSkill,
        targetInstanceId: "mover",
        rank: 1,
      },
      { playerTeam: [makeChar({ instanceId: "p", team: "player" })], enemyTeam: [holder, mover] },
      noopLog,
    ).enemyTeam[0];

    const defEntry = raised.buffs.find((b) => b.type === "buff");
    expect(defEntry).toBeDefined();
    expect(defEntry!.groupId).toBeDefined();
    expect(defEntry!.groupName).toBe("Hold the Line");

    const run = (mechanics: { type: string }[]) => {
      const attacker = makeChar({ instanceId: "attacker", team: "player" });
      const victim = { ...raised, buffs: raised.buffs.map((b) => ({ ...b })) };
      const skill = {
        skillName: "Test Cancel",
        characterId: "attacker",
        type: "attack",
        statMultiplier: "atk",
        damageRanked: [10, 10, 10],
        mechanics,
      } as unknown as SkillCard;
      return executeSkill(
        {
          sourceInstanceId: "attacker",
          skill,
          targetInstanceId: "holder",
          rank: 1,
        },
        { playerTeam: [attacker], enemyTeam: [victim as BattleCharacter] },
        noopLog,
        0,
        () => 0.99,
      ).enemyTeam[0];
    };

    // cancelBuffs must NOT reach it — it is part of a stance.
    expect(run([{ type: "cancelBuffs" }]).buffs.some((b) => b.type === "buff")).toBe(true);
    // cancelStances must take it along with the taunt.
    expect(run([{ type: "cancelStances" }]).buffs).toEqual([]);
  });
});

describe("#132 — a card cancels what its text says it cancels", () => {
  /**
   * The guard that would have caught this. Three skills read "Cancels buffs
   * and stances" while authoring only `cancelBuffs`: Leorio's Remote Punch,
   * Meliodas's Evil Spirit and Siddiq's Wrath of the Wild. They did the right
   * thing only because `cancelBuffs` used to sweep stances too, so splitting
   * the two would have silently nerfed all three against their own cards.
   */
  type Action = {
    skillName?: string;
    description?: string;
    mechanics?: { type?: string }[];
  };

  function actionsOf(c: Record<string, unknown>): Action[] {
    const out: Action[] = [];
    for (const s of (c.skills as Action[]) ?? []) out.push(s);
    if (c.ultimate) out.push(c.ultimate as Action);
    if (c.spSkill) out.push(c.spSkill as Action);
    return out;
  }

  it("every description promising stances authors cancelStances", () => {
    const offenders: string[] = [];
    for (const c of getAllCharacters()) {
      const raw = c as unknown as Record<string, unknown>;
      for (const a of actionsOf(raw)) {
        const text = (a.description ?? "").toLowerCase();
        if (!/cancels?\b[^.;]*\bstances?\b/.test(text)) continue;
        const types = (a.mechanics ?? []).map((m) => m.type);
        if (!types.includes("cancelStances")) {
          offenders.push(
            `${raw.id} / ${a.skillName}: says stances, authors ${types.join("+")}`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("and nothing authors cancelStances without saying so", () => {
    const offenders: string[] = [];
    for (const c of getAllCharacters()) {
      const raw = c as unknown as Record<string, unknown>;
      for (const a of actionsOf(raw)) {
        const types = (a.mechanics ?? []).map((m) => m.type);
        if (!types.includes("cancelStances")) continue;
        const text = (a.description ?? "").toLowerCase();
        if (!/stances?\b/.test(text)) {
          offenders.push(`${raw.id} / ${a.skillName}: cancels stances silently`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

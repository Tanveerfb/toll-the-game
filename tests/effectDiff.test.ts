import { describe, expect, it } from "vitest";
import { executeSkill } from "@/lib/game/combat";
import {
  snapshotEffects,
  diffEffects,
  diffEffectIdentities,
  describeEventEffect,
} from "@/lib/game/effectDiff";
import { tickTeamBuffs, tickTeamDebuffs } from "@/lib/game/tick";
import type { BattleCharacter } from "@/types/character";
import type { SkillCard } from "@/types/skillCard";
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

function run(
  action: {
    sourceInstanceId: string;
    targetInstanceId: string;
    skill: SkillCard;
    rank?: 1 | 2 | 3;
  },
  playerTeam: BattleCharacter[],
  enemyTeam: BattleCharacter[],
) {
  const events: BattleActionEvent[] = [];
  const teams = executeSkill(
    { rank: 1, ...action },
    { playerTeam, enemyTeam },
    noopLog,
    0,
    () => 0.99,
    (e) => events.push(e),
  );
  return { events, teams };
}

describe("diffEffects", () => {
  it("reports nothing when no status moved", () => {
    const char = makeChar({ instanceId: "a", team: "player" });
    const before = snapshotEffects([char]);
    expect(diffEffects(before, [char])).toEqual([]);
  });

  it("reports an added buff as applied, on the right slot", () => {
    const char = makeChar({ instanceId: "a", team: "player" });
    const before = snapshotEffects([char]);
    char.buffs.push({
      type: "buff",
      stat: "atk",
      valuePercent: 25,
      buffDuration: 2,
    });

    const [change] = diffEffects(before, [char]);
    expect(change.instanceId).toBe("a");
    expect(change.removed).toEqual([]);
    expect(change.applied).toHaveLength(1);
    expect(change.applied[0]).toMatchObject({
      slot: "buff",
      type: "buff",
      stat: "atk",
      valuePercent: 25,
      duration: 2,
    });
  });

  it("reports a cleansed debuff as removed", () => {
    const char = makeChar({
      instanceId: "a",
      team: "player",
      debuffs: [
        { type: "debuff", stat: "def", valuePercent: 30, debuffDuration: 2 },
      ],
    });
    const before = snapshotEffects([char]);
    char.debuffs = [];

    const [change] = diffEffects(before, [char]);
    expect(change.applied).toEqual([]);
    expect(change.removed).toHaveLength(1);
    expect(change.removed[0]).toMatchObject({ slot: "debuff", stat: "def" });
  });

  it("reads a duration refresh as an application, not a cleanse", () => {
    // Same effect, new numbers: the multiset diff sees remove+add, which would
    // otherwise print a cleanse the player never got.
    const char = makeChar({
      instanceId: "a",
      team: "player",
      buffs: [
        {
          type: "buff",
          name: "Guard",
          stat: "def",
          valuePercent: 20,
          buffDuration: 1,
        },
      ],
    });
    const before = snapshotEffects([char]);
    char.buffs = [
      {
        type: "buff",
        name: "Guard",
        stat: "def",
        valuePercent: 20,
        buffDuration: 3,
      },
    ];

    const [change] = diffEffects(before, [char]);
    expect(change.removed).toEqual([]);
    expect(change.applied[0].duration).toBe(3);
  });

  it("counts a second copy of an identical stack as applied", () => {
    const entry = {
      type: "debuff" as const,
      stat: "atk",
      valuePercent: 10,
      debuffDuration: 2,
    };
    const char = makeChar({
      instanceId: "a",
      team: "player",
      debuffs: [{ ...entry }],
    });
    const before = snapshotEffects([char]);
    char.debuffs.push({ ...entry });

    const [change] = diffEffects(before, [char]);
    expect(change.applied).toHaveLength(1);
    expect(change.removed).toEqual([]);
  });

  it("is immune to in-place mutation of a snapshotted entry", () => {
    // executeSkill shallow-copies the arrays, so a snapshot holding live
    // references would silently agree with whatever the entry became.
    const entry = { type: "buff" as const, stat: "atk", valuePercent: 10 };
    const char = makeChar({ instanceId: "a", team: "player", buffs: [entry] });
    const before = snapshotEffects([char]);
    entry.valuePercent = 40;

    // Held live, the snapshot would agree with the mutation and report no
    // change at all. Frozen, it sees 10 become 40 — and since the identity is
    // unchanged, that reads as a refresh rather than a cleanse plus a grant.
    const [change] = diffEffects(before, [char]);
    expect(change).toBeDefined();
    expect(change.applied[0].valuePercent).toBe(40);
    expect(change.removed).toEqual([]);
  });
});

describe("effect changes on the event stream (Open Issue #22)", () => {
  const debuffSkill = {
    skillName: "Sap",
    characterId: "a",
    type: "debuff",
    statMultiplier: "atk",
    damageRanked: [50, 50, 50],
    mechanics: [
      {
        type: "debuff",
        stat: "def",
        valuePercent: 30,
        duration: 2,
        name: "Sapped",
      },
    ],
  } as unknown as SkillCard;

  it("carries the debuff a skill applied to its target", () => {
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const victim = makeChar({ instanceId: "v", team: "enemy" });
    const { events } = run(
      { sourceInstanceId: "a", targetInstanceId: "v", skill: debuffSkill },
      [attacker],
      [victim],
    );

    const change = events[0].effects?.find((c) => c.instanceId === "v");
    expect(change).toBeDefined();
    expect(change!.applied.map((e) => e.name)).toContain("Sapped");
    expect(change!.applied[0]).toMatchObject({
      slot: "debuff",
      valuePercent: 30,
      duration: 2,
    });
  });

  it("carries a self buff, which never appears under targets", () => {
    const selfBuff = {
      skillName: "Brace",
      characterId: "a",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [50, 50, 50],
      mechanics: [
        {
          type: "buff",
          stat: "def",
          valuePercent: 25,
          duration: 2,
          applyTo: "self",
        },
      ],
    } as unknown as SkillCard;
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const victim = makeChar({ instanceId: "v", team: "enemy" });
    const { events } = run(
      { sourceInstanceId: "a", targetInstanceId: "v", skill: selfBuff },
      [attacker],
      [victim],
    );

    expect(events[0].targets.map((t) => t.instanceId)).not.toContain("a");
    const change = events[0].effects?.find((c) => c.instanceId === "a");
    expect(change?.applied[0]).toMatchObject({
      slot: "buff",
      stat: "def",
      valuePercent: 25,
    });
  });

  it("omits the field entirely for an action that moved nothing", () => {
    const plain: SkillCard = {
      skillName: "Strike",
      characterId: "a",
      type: "attack",
      statMultiplier: "atk",
      damageRanked: [50, 50, 50],
    };
    const attacker = makeChar({ instanceId: "a", team: "player" });
    const victim = makeChar({ instanceId: "v", team: "enemy" });
    const { events } = run(
      { sourceInstanceId: "a", targetInstanceId: "v", skill: plain },
      [attacker],
      [victim],
    );
    expect(events[0].effects).toEqual([]);
  });
});

describe("diffEffectIdentities (the tick comparison)", () => {
  it("stays silent while a buff is merely counting down", () => {
    // The whole reason ticks do not use the full diff: every surviving
    // durationed effect changes on every tick, and reporting them would
    // redraw the entire board once a turn.
    const char = makeChar({
      instanceId: "a",
      team: "player",
      buffs: [{ type: "buff", stat: "atk", valuePercent: 25, buffDuration: 3 }],
    });
    const before = snapshotEffects([char]);
    const [ticked] = tickTeamBuffs([char], noopLog);

    expect(ticked.buffs[0].buffDuration).toBe(2);
    expect(diffEffectIdentities(before, [ticked])).toEqual([]);
    // …whereas the action-grade diff would have called that a change.
    expect(diffEffects(before, [ticked])).toHaveLength(1);
  });

  it("reports a buff that ran out", () => {
    const char = makeChar({
      instanceId: "a",
      team: "player",
      buffs: [{ type: "buff", stat: "atk", valuePercent: 25, buffDuration: 1 }],
    });
    const before = snapshotEffects([char]);
    const [ticked] = tickTeamBuffs([char], noopLog);

    const [change] = diffEffectIdentities(before, [ticked]);
    expect(change.applied).toEqual([]);
    expect(change.removed[0]).toMatchObject({ slot: "buff", stat: "atk" });
  });

  it("reports a stun expiring, which moves no HP at all", () => {
    // The case the old `targets.length > 0` gate dropped entirely.
    const char = makeChar({
      instanceId: "a",
      team: "player",
      debuffs: [{ type: "stun", debuffDuration: 1 }],
    });
    const before = snapshotEffects([char]);
    const [ticked] = tickTeamDebuffs([char], noopLog);

    expect(ticked.currentHP).toBe(char.currentHP);
    const [change] = diffEffectIdentities(before, [ticked]);
    expect(change.removed).toHaveLength(1);
    expect(change.removed[0].type).toBe("stun");
  });
});

describe("describeEventEffect", () => {
  it("signs a debuff negative and a buff positive", () => {
    expect(
      describeEventEffect({
        slot: "buff",
        type: "buff",
        stat: "atk",
        valuePercent: 25,
        duration: 2,
      }),
    ).toBe("ATK +25% · 2t");
    expect(
      describeEventEffect({
        slot: "debuff",
        type: "debuff",
        stat: "def",
        valuePercent: 30,
      }),
    ).toBe("DEF −30%");
  });

  it("names a DoT with its per-turn value", () => {
    expect(
      describeEventEffect({
        slot: "debuff",
        type: "damageOverTime",
        name: "Shock",
        value: 120,
        duration: 4,
      }),
    ).toBe("Shock (120/turn) · 4t");
  });

  it("narrates a stun and a seal without inventing a percentage", () => {
    expect(
      describeEventEffect({ slot: "debuff", type: "stun", duration: 2 }),
    ).toBe("Stunned · 2t");
    expect(
      describeEventEffect({
        slot: "debuff",
        type: "seal",
        sealType: "attack",
        duration: 1,
      }),
    ).toBe("attack skills sealed · 1t");
  });
});

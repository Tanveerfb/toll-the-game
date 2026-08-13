import { describe, expect, it } from "vitest";
import { buildBattleReport } from "@/lib/game/battleReport";
import type { SequencedBattleEvent } from "@/store/gameStore";
import type { BattleCharacter } from "@/types/character";

/**
 * Saved battles are analysed, not read (Tanveer, 2026-08-13).
 *
 * So the report's job is to be *correct and complete* rather than readable,
 * and these tests cover the three things that made the previous markdown
 * version unreliable: totals nobody had checked, a raw log that
 * double-printed, and no opening statline to measure anything against.
 */

function unit(
  instanceId: string,
  name: string,
  over: Partial<BattleCharacter> = {},
): BattleCharacter {
  return {
    instanceId,
    id: name.toLowerCase(),
    name,
    color: "blue",
    hp: 3000,
    currentHP: 3000,
    atk: 200,
    def: 100,
    currentAttack: 200,
    currentDefense: 100,
    ultGauge: 0,
    isSub: false,
    buffs: [],
    debuffs: [],
    skills: [],
    ...over,
  } as unknown as BattleCharacter;
}

function action(
  over: Partial<SequencedBattleEvent> & { turn?: number } = {},
): SequencedBattleEvent {
  return {
    kind: "action",
    id: 1,
    turn: 0,
    phase: "PlayerAction",
    sourceInstanceId: "p1",
    sourceName: "Lyra",
    sourceTeam: "player",
    sourceColor: "blue",
    sourceCharacterId: "lyra",
    skillName: "Magma Shaft",
    skillType: "attack",
    isUlt: false,
    rank: 1,
    targets: [],
    counters: [],
    ...over,
  } as SequencedBattleEvent;
}

const BASE = {
  result: "victory",
  turn: 2,
  playerTurns: 3,
  enemyTurns: 2,
  timestamp: "2026-08-13T00:00:00.000Z",
  rawLog: [] as string[],
};

describe("totals", () => {
  it("adds damage to the dealer and the taker", () => {
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra")],
      enemyTeam: [unit("e1", "Mustafa")],
      events: [
        action({
          targets: [
            { instanceId: "e1", name: "Mustafa", damage: 400, hpBefore: 3000, hpAfter: 2600 },
          ],
        }),
      ],
    });
    const lyra = report.totals.byUnit.find((u) => u.instanceId === "p1")!;
    const mustafa = report.totals.byUnit.find((u) => u.instanceId === "e1")!;
    expect(lyra.damageDealt).toBe(400);
    expect(mustafa.damageTaken).toBe(400);
    expect(report.totals.player.damage).toBe(400);
    expect(report.totals.enemy.damage).toBe(0);
  });

  it("counts an AoE as one action, not one per target", () => {
    // The action economy is per card. Counting hits would make a three-enemy
    // AoE look like three turns' worth of tempo.
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Sara")],
      enemyTeam: [unit("e1", "A"), unit("e2", "B"), unit("e3", "C")],
      events: [
        action({
          sourceName: "Sara",
          targets: [
            { instanceId: "e1", name: "A", damage: 100 },
            { instanceId: "e2", name: "B", damage: 100 },
            { instanceId: "e3", name: "C", damage: 100 },
          ],
        }),
      ],
    });
    const sara = report.totals.byUnit.find((u) => u.instanceId === "p1")!;
    expect(sara.actions).toBe(1);
    expect(sara.damageDealt).toBe(300);
  });

  it("separates ultimates from ranked cards", () => {
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra")],
      enemyTeam: [unit("e1", "Mustafa")],
      events: [
        action({ isUlt: true, rank: undefined }),
        action({ rank: 3 }),
        action({ rank: 3 }),
      ],
    });
    const lyra = report.totals.byUnit.find((u) => u.instanceId === "p1")!;
    expect(lyra.ultsUsed).toBe(1);
    expect(lyra.cardsByRank.r3).toBe(2);
    expect(lyra.actions).toBe(3);
  });

  it("records healing separately from damage", () => {
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Isolde"), unit("p2", "Lyra")],
      enemyTeam: [unit("e1", "Mustafa")],
      events: [
        action({
          sourceName: "Isolde",
          targets: [{ instanceId: "p2", name: "Lyra", heal: 620 }],
        }),
      ],
    });
    const isolde = report.totals.byUnit.find((u) => u.instanceId === "p1")!;
    const lyra = report.totals.byUnit.find((u) => u.instanceId === "p2")!;
    expect(isolde.healingDone).toBe(620);
    expect(lyra.healingReceived).toBe(620);
    expect(isolde.damageDealt).toBe(0);
  });
});

describe("anomalies — the point of the whole thing", () => {
  it("flags an attack that resolved for zero damage", () => {
    // The 2026-08-13 finding: Volcanic Frost landed on 400 DEF for 0, and the
    // decay it applies scaled off that same 0. A card that spends an action
    // and changes nothing should never need a human to spot it.
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra")],
      enemyTeam: [unit("e1", "Gon")],
      events: [
        action({
          skillName: "Volcanic Frost",
          targets: [{ instanceId: "e1", name: "Gon", damage: 0 }],
        }),
      ],
    });
    expect(report.anomalies.some((a) => a.kind === "zero-damage-attack")).toBe(
      true,
    );
    expect(
      report.totals.byUnit.find((u) => u.instanceId === "p1")!.zeroDamageHits,
    ).toBe(1);
  });

  it("does not call a dodge a zero-damage attack", () => {
    // An evade is the defender working, not the card failing.
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra")],
      enemyTeam: [unit("e1", "Gon")],
      events: [
        action({ targets: [{ instanceId: "e1", name: "Gon", evaded: true }] }),
      ],
    });
    expect(report.anomalies.some((a) => a.kind === "zero-damage-attack")).toBe(
      false,
    );
  });

  it("flags chip damage against a big health bar", () => {
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra")],
      enemyTeam: [unit("e1", "Mustafa", { hp: 4290, currentHP: 4290 })],
      events: [
        action({
          targets: [{ instanceId: "e1", name: "Mustafa", damage: 16 }],
        }),
      ],
    });
    const chip = report.anomalies.find((a) => a.kind === "chip-damage-attack");
    expect(chip?.detail).toContain("16");
  });

  it("flags a unit that never acted", () => {
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra"), unit("p2", "Isolde")],
      enemyTeam: [unit("e1", "Mustafa")],
      events: [action()],
    });
    expect(
      report.anomalies.some(
        (a) => a.kind === "never-acted" && a.detail.includes("Isolde"),
      ),
    ).toBe(true);
  });

  it("does not flag a benched unit for not acting", () => {
    // A sub can't act by design; reporting it as an anomaly is noise.
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra"), unit("p2", "Isolde", { isSub: true })],
      enemyTeam: [unit("e1", "Mustafa")],
      events: [action()],
    });
    expect(
      report.anomalies.some((a) => a.detail.includes("Isolde")),
    ).toBe(false);
  });
});

describe("the raw log", () => {
  it("collapses the engine's consecutive duplicate lines and says how many", () => {
    // The string log repeats entries the event stream records once — proven by
    // HP arithmetic on the 2026-08-13 run. Left in, every count read off it
    // is wrong.
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra")],
      enemyTeam: [unit("e1", "Mustafa")],
      events: [],
      rawLog: ["hit for 164", "hit for 164", "hit for 76"],
    });
    expect(report.rawLog.lines).toEqual(["hit for 164", "hit for 76"]);
    expect(report.rawLog.collapsedDuplicates).toBe(1);
    expect(
      report.anomalies.some((a) => a.kind === "duplicate-log-lines"),
    ).toBe(true);
  });

  it("keeps genuinely repeated non-adjacent lines", () => {
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra")],
      enemyTeam: [unit("e1", "Mustafa")],
      events: [],
      rawLog: ["a", "b", "a"],
    });
    expect(report.rawLog.lines).toEqual(["a", "b", "a"]);
    expect(report.rawLog.collapsedDuplicates).toBe(0);
  });
});

describe("opening statlines", () => {
  it("keeps the opening snapshot distinct from the final one", () => {
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra", { currentHP: 12 })],
      enemyTeam: [unit("e1", "Mustafa", { currentHP: 0 })],
      openingPlayerTeam: [unit("p1", "Lyra", { currentHP: 3000 })],
      openingEnemyTeam: [unit("e1", "Mustafa", { currentHP: 4290, hp: 4290 })],
      events: [],
    });
    expect(report.teams.opening.player[0].currentHp).toBe(3000);
    expect(report.teams.final.player[0].currentHp).toBe(12);
    expect(report.teams.opening.enemy[0].maxHp).toBe(4290);
  });

  it("falls back to the final teams when no snapshot was taken", () => {
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra", { currentHP: 12 })],
      enemyTeam: [unit("e1", "Mustafa")],
      events: [],
    });
    expect(report.teams.opening.player[0].currentHp).toBe(12);
  });
});

describe("shape", () => {
  it("serialises to JSON without loss", () => {
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra")],
      enemyTeam: [unit("e1", "Mustafa")],
      events: [action({ targets: [{ instanceId: "e1", name: "Mustafa", damage: 5 }] })],
    });
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    expect(report.schema).toBe("toll-battle-report/1");
  });

  it("reports damage per turn in turn order", () => {
    const report = buildBattleReport({
      ...BASE,
      playerTeam: [unit("p1", "Lyra")],
      enemyTeam: [unit("e1", "Mustafa")],
      events: [
        action({ turn: 1, targets: [{ instanceId: "e1", name: "Mustafa", damage: 100 }] }),
        action({ turn: 0, targets: [{ instanceId: "e1", name: "Mustafa", damage: 50 }] }),
      ],
    });
    expect(report.damageByTurn.map((d) => d.turn)).toEqual([0, 1]);
    expect(report.damageByTurn[0].player).toBe(50);
  });
});

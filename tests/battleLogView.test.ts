import { describe, expect, it } from "vitest";
import { groupEventsByTurn } from "@/components/game/battle/BattleLogDrawer";
import { formatBattleLogMarkdown } from "@/lib/game/battleLogMarkdown";
import type { SequencedBattleEvent } from "@/store/gameStore";
import type { BattleCharacter } from "@/types/character";

function action(
  id: number,
  turn: number,
  overrides: Partial<Extract<SequencedBattleEvent, { kind: "action" }>> = {},
): SequencedBattleEvent {
  return {
    kind: "action",
    id,
    turn,
    phase: "PlayerAction",
    sourceInstanceId: `src-${id}`,
    sourceName: "Duke",
    sourceTeam: "player",
    sourceColor: "blue",
    sourceCharacterId: "duke",
    skillName: "Fist of Flowing Ruin : Slide",
    skillType: "attack",
    isUlt: false,
    rank: 2,
    targets: [
      {
        instanceId: "t1",
        name: "Raider",
        damage: 412,
        hpBefore: 900,
        hpAfter: 488,
      },
    ],
    counters: [],
    ...overrides,
  } as SequencedBattleEvent;
}

function tick(id: number, turn: number): SequencedBattleEvent {
  return {
    kind: "tick",
    id,
    turn,
    phase: "OnPlayerTurnEnd",
    label: "DoT",
    targets: [
      { instanceId: "t1", name: "Raider", hpBefore: 488, hpAfter: 400 },
    ],
  };
}

function unit(overrides: Partial<BattleCharacter> = {}): BattleCharacter {
  return {
    instanceId: "p1",
    id: "duke",
    name: "Duke",
    team: "player",
    color: "blue",
    atk: 210,
    def: 85,
    hp: 1500,
    currentHP: 1200,
    currentAttack: 230,
    currentDefense: 85,
    ultGauge: 3,
    buffs: [],
    debuffs: [],
    passiveState: {},
    skills: [],
    ...overrides,
  } as unknown as BattleCharacter;
}

describe("groupEventsByTurn", () => {
  it("groups events by turn, newest turn first", () => {
    const groups = groupEventsByTurn([
      action(1, 0),
      action(2, 1),
      action(3, 2),
    ]);
    expect(groups.map((g) => g.turn)).toEqual([2, 1, 0]);
  });

  it("keeps events inside a turn in resolution order", () => {
    // Reversing within a turn would scramble cause and effect (a DoT tick
    // must read after the hit that applied it).
    const groups = groupEventsByTurn([action(1, 0), tick(2, 0), action(3, 0)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].events.map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it("returns no groups for an empty stream", () => {
    expect(groupEventsByTurn([])).toEqual([]);
  });
});

describe("formatBattleLogMarkdown", () => {
  const base = {
    result: "victory",
    turn: 2,
    playerTurns: 3,
    enemyTurns: 3,
    playerTeam: [unit()],
    enemyTeam: [unit({ instanceId: "e1", name: "Raider", team: "enemy" })],
    rawLog: ["[Action] Duke used Slide.", "Raider takes 412 damage."],
    timestamp: "Mon Aug 04 2026",
  };

  it("renders a heading, final-state tables and a per-turn timeline", () => {
    const md = formatBattleLogMarkdown({
      ...base,
      events: [action(1, 0), tick(2, 0), action(3, 1)],
    });
    expect(md).toContain("# Battle log — VICTORY");
    expect(md).toContain("### Player team");
    expect(md).toContain("### Enemy team");
    expect(md).toContain("### Turn 1");
    expect(md).toContain("### Turn 2");
    expect(md).toContain("Fist of Flowing Ruin : Slide");
  });

  it("records per-target damage with exact HP snapshots", () => {
    const md = formatBattleLogMarkdown({ ...base, events: [action(1, 0)] });
    expect(md).toContain("Raider: -412 _(900 → 488)_");
  });

  it("marks crits, evades, survivals and kills", () => {
    const md = formatBattleLogMarkdown({
      ...base,
      events: [
        action(1, 0, {
          targets: [
            { instanceId: "t1", name: "A", evaded: true },
            { instanceId: "t2", name: "B", damage: 90, crit: true, killed: true },
            {
              instanceId: "t3",
              name: "C",
              damage: 10,
              survivedLethal: true,
            },
          ],
        }),
      ],
    });
    expect(md).toContain("A: DODGED");
    expect(md).toContain("B: -90 · CRIT · DOWN");
    expect(md).toContain("C: -10 · SURVIVED");
  });

  it("keeps the raw engine log verbatim as an appendix", () => {
    // It's still the only record of effect applications.
    const md = formatBattleLogMarkdown({ ...base, events: [action(1, 0)] });
    expect(md).toContain("## Raw event log");
    expect(md).toContain("[Action] Duke used Slide.");
  });

  it("says so plainly when there are no structured events", () => {
    const md = formatBattleLogMarkdown({ ...base, events: [] });
    expect(md).toContain("_No structured events recorded._");
  });
});

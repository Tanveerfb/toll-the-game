import { describe, expect, it } from "vitest";
import { foldFightFromBattle, type BattleSnapshot } from "@/lib/game/fightDriver";
import { beginRun, type RunnableEncounter } from "@/lib/game/stageRun";
import type { BattleCharacter } from "@/types/character";
import type { AnyBattleEvent } from "@/types/battleEvent";

/**
 * Folding a finished battle into a run.
 *
 * Extracted from `app/story/page.tsx` on 2026-09-16 so the events board and the
 * story page would share one copy — and then **shipped without a test**, which
 * the 2026-09-17 audit caught as finding T1. It reads three separate store
 * fields and has to get all three right; a second screen now depends on it.
 *
 * The interesting rules are all about what it counts, and they are easy to get
 * subtly wrong in ways nothing else notices: an ultimate carries no rank, a
 * fallen unit must be reported as fallen rather than merely absent, and enemy
 * actions must not be counted as the player's.
 */

const ENCOUNTER: RunnableEncounter = {
  id: "test-stage",
  fights: [
    { enemies: [{ id: "wild_beast" }] },
    { enemies: [{ id: "ford_bandit" }] },
  ],
};

const TEAM = [{ id: "duke" }, { id: "lyra" }, { id: "seras" }];

function unit(id: string, currentHP: number): BattleCharacter {
  return { id, instanceId: `p_${id}`, currentHP } as unknown as BattleCharacter;
}

function action(
  sourceTeam: "player" | "enemy",
  extra: Record<string, unknown> = {},
): AnyBattleEvent {
  return { kind: "action", sourceTeam, ...extra } as unknown as AnyBattleEvent;
}

function snapshot(over: Partial<BattleSnapshot> = {}): BattleSnapshot {
  return {
    playerTeam: [unit("duke", 900), unit("lyra", 120), unit("seras", 0)],
    battleEvents: [],
    playerTurns: 0,
    ...over,
  };
}

const run = () => beginRun("test-stage", ENCOUNTER, TEAM);

describe("who survived", () => {
  it("carries survivors' HP and records the fallen separately", () => {
    const out = foldFightFromBattle(run(), snapshot());
    expect(out.carryHp).toEqual({ duke: 900, lyra: 120 });
    expect(out.fallen).toEqual(["seras"]);
  });

  it("treats exactly 0 HP as fallen, not as a survivor at zero", () => {
    // A unit sent into the next fight at 0 HP would be unkillable-or-dead
    // depending on which check ran first. The boundary is the whole rule.
    const out = foldFightFromBattle(
      run(),
      snapshot({ playerTeam: [unit("duke", 0), unit("lyra", 1)] }),
    );
    expect(out.carryHp).toEqual({ lyra: 1 });
    expect(out.fallen).toEqual(["duke"]);
  });

  it("advances the fight index and is not complete mid-run", () => {
    const out = foldFightFromBattle(run(), snapshot());
    expect(out.fightIndex).toBe(1);
    expect(out.complete).toBe(false);
  });

  it("is complete once the last fight is folded", () => {
    const out = foldFightFromBattle(
      foldFightFromBattle(run(), snapshot()),
      snapshot(),
    );
    expect(out.complete).toBe(true);
  });
});

describe("what it counts", () => {
  it("counts an ultimate as an ultimate and never as a ranked card", () => {
    // An ultimate carries no rank at all (engine rule). Counting it as rank 1
    // would inflate every `useSkillRank` mission in the game.
    const out = foldFightFromBattle(
      run(),
      snapshot({
        battleEvents: [
          action("player", { isUlt: true }),
          action("player", { isUlt: true, rank: 3 }),
        ],
      }),
    );
    expect(out.ultimatesUsed).toBe(2);
    expect(out.rankUses).toEqual({ 1: 0, 2: 0, 3: 0 });
  });

  it("reads an absent rank as rank 1, matching the sequencer", () => {
    const out = foldFightFromBattle(
      run(),
      snapshot({ battleEvents: [action("player"), action("player", { rank: 2 })] }),
    );
    expect(out.rankUses).toEqual({ 1: 1, 2: 1, 3: 0 });
  });

  it("ignores the enemy's actions entirely", () => {
    // The event stream carries both sides. Counting the enemy's cards would
    // make every mission trivially completable by a long fight.
    const out = foldFightFromBattle(
      run(),
      snapshot({
        battleEvents: [
          action("enemy", { rank: 3 }),
          action("enemy", { isUlt: true }),
          action("player", { rank: 3 }),
        ],
      }),
    );
    expect(out.rankUses).toEqual({ 1: 0, 2: 0, 3: 1 });
    expect(out.ultimatesUsed).toBe(0);
  });

  it("ignores events that are not actions", () => {
    const out = foldFightFromBattle(
      run(),
      snapshot({
        battleEvents: [
          { kind: "damage", sourceTeam: "player" } as unknown as AnyBattleEvent,
          action("player", { rank: 1 }),
        ],
      }),
    );
    expect(out.rankUses).toEqual({ 1: 1, 2: 0, 3: 0 });
  });
});

describe("accumulating across fights", () => {
  it("sums turns, ultimates and rank uses over the whole run", () => {
    // `stageMissions` counts turns across the RUN, not per fight, so a
    // `withinTurns` mission is a budget for the stage. Folding has to add up.
    const first = foldFightFromBattle(
      run(),
      snapshot({
        playerTurns: 6,
        battleEvents: [action("player", { isUlt: true }), action("player", { rank: 2 })],
      }),
    );
    const second = foldFightFromBattle(
      first,
      snapshot({
        playerTurns: 9,
        battleEvents: [action("player", { rank: 2 }), action("player", { rank: 3 })],
      }),
    );

    expect(second.turns).toBe(15);
    expect(second.ultimatesUsed).toBe(1);
    expect(second.rankUses).toEqual({ 1: 0, 2: 2, 3: 1 });
  });

  it("never revives a unit that fell in an earlier fight", () => {
    // The fallen staying down is ruling #103 and the reason a multi-fight
    // stage is a resource problem rather than three separate fights.
    const first = foldFightFromBattle(
      run(),
      snapshot({ playerTeam: [unit("duke", 900), unit("seras", 0)] }),
    );
    const second = foldFightFromBattle(
      first,
      snapshot({ playerTeam: [unit("duke", 400)] }),
    );
    expect(second.fallen).toEqual(["seras"]);
    expect(second.carryHp).toEqual({ duke: 400 });
  });
});

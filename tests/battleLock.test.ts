import { describe, expect, it } from "vitest";
import { battleLockRoute, resumedEventBattle } from "@/lib/game/battleLock";
import { beginRun } from "@/lib/game/fightRun";
import { FIRST_ASCENSION_TRIAL } from "@/lib/game/trialEncounters";
import type { BattleOwner } from "@/types/battleOwner";

/**
 * The battle lock (audit finding F5, 2026-09-26). His rule: a reload or a
 * navigation must not take the player out of a battle; finishing it or
 * forfeiting it are the only ways out.
 */

const BOSS: BattleOwner = {
  route: "/events",
  view: { kind: "boss", eventId: "molvarr", difficulty: 2 },
};

describe("battleLockRoute", () => {
  it("lets the player go anywhere when no battle is running", () => {
    expect(battleLockRoute("initializing", null, "/gacha")).toBeNull();
    expect(battleLockRoute("initializing", BOSS, "/gacha")).toBeNull();
  });

  it("sends the player back to the screen that owns the battle", () => {
    expect(battleLockRoute("PlayerAction", BOSS, "/gacha")).toBe("/events");
    expect(battleLockRoute("EnemyAction", BOSS, "/practice")).toBe("/events");
    expect(battleLockRoute("PlayerAction", BOSS, "/")).toBe("/events");
  });

  it("stays put on the owning screen", () => {
    expect(battleLockRoute("PlayerAction", BOSS, "/events")).toBeNull();
    expect(
      battleLockRoute("PlayerAction", { route: "/practice" }, "/practice"),
    ).toBeNull();
  });

  it("holds through the victory and defeat cards", () => {
    // The boss pays out from the victory card's button; leaving from there
    // would walk away from the rewards.
    expect(battleLockRoute("victory", BOSS, "/gacha")).toBe("/events");
    expect(battleLockRoute("defeat", BOSS, "/archive")).toBe("/events");
  });

  it("treats an ownerless live battle as practice's", () => {
    // Saved before owners existed. Practice renders any battle it finds.
    expect(battleLockRoute("PlayerAction", null, "/events")).toBe("/practice");
    expect(battleLockRoute("PlayerAction", null, "/practice")).toBeNull();
  });

  it("matches the owner's subtree, not just its exact path", () => {
    expect(battleLockRoute("PlayerAction", BOSS, "/events/")).toBeNull();
  });
});

describe("resumedEventBattle", () => {
  it("rebuilds a live boss fight at the difficulty it was entered at", () => {
    // The victory card pays out at the difficulty in state, which a reload
    // would otherwise reset to the account's world level.
    const resumed = resumedEventBattle("PlayerAction", BOSS);
    expect(resumed?.kind).toBe("boss");
    expect(resumed?.event.id).toBe("molvarr");
    expect(resumed?.kind === "boss" && resumed.difficulty).toBe(2);
  });

  it("rebuilds a live trial fight with its run intact", () => {
    const run = { ...beginRun(FIRST_ASCENSION_TRIAL, [{ id: "duke" }]), fightIndex: 1 };
    const resumed = resumedEventBattle("EnemyAction", {
      route: "/events",
      view: { kind: "trial", eventId: "trial-rank-20", run },
    });
    expect(resumed?.kind === "trial" && resumed.run.fightIndex).toBe(1);
  });

  it("keeps a finished fight's card, so its rewards can still be claimed", () => {
    expect(resumedEventBattle("victory", BOSS)?.kind).toBe("boss");
  });

  it("resumes nothing when no battle is live or another screen owns it", () => {
    expect(resumedEventBattle("initializing", BOSS)).toBeNull();
    expect(resumedEventBattle("PlayerAction", { route: "/practice" })).toBeNull();
    expect(resumedEventBattle("PlayerAction", null)).toBeNull();
  });

  it("falls back to the board for an event that no longer exists", () => {
    expect(
      resumedEventBattle("PlayerAction", {
        route: "/events",
        view: { kind: "boss", eventId: "retired-boss", difficulty: 1 },
      }),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { effectCounts } from "@/components/game/battle/EffectsList";
import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";

/**
 * The `↑4 ◆1 ↓3` strip under the ult gauge (Tanveer, 2026-08-13; the stance
 * token added by #133, 2026-09-16).
 *
 * The rules that are easy to get wrong are the exclusions: grey uncancellable
 * entries never count, and a side with nothing is omitted entirely rather than
 * rendered as a zero. The omission is the component's job; what's testable
 * here is that the numbers it reads are right.
 */

function unit(buffs: StatusEffect[], debuffs: StatusEffect[]): BattleCharacter {
  return { buffs, debuffs } as BattleCharacter;
}

const buff = (over: Partial<StatusEffect> = {}): StatusEffect =>
  ({ type: "buff", stat: "atk", valuePercent: 20, ...over }) as StatusEffect;
const debuff = (over: Partial<StatusEffect> = {}): StatusEffect =>
  ({ type: "debuff", stat: "def", valuePercent: 20, ...over }) as StatusEffect;

describe("effectCounts", () => {
  it("counts cancellable buffs and debuffs", () => {
    expect(effectCounts(unit([buff(), buff()], [debuff()]))).toEqual({
      buffs: 2,
      stances: 0,
      debuffs: 1,
    });
  });

  it("excludes grey uncancellable entries from BOTH sides", () => {
    // Ruling #30: uncancellable entries are "effects", not buffs or debuffs —
    // a synergy badge must not inflate the buff count.
    const counts = effectCounts(
      unit(
        [buff(), buff({ uncancellable: true, name: "[Collab] Synergy" })],
        [debuff({ uncancellable: true })],
      ),
    );
    expect(counts).toEqual({ buffs: 1, stances: 0, debuffs: 0 });
  });

  it("counts entries, not stacks", () => {
    // Three stacks of one Corrosion is one debuff — matching the chip strip
    // this replaced, so the number didn't silently change meaning.
    expect(
      effectCounts(unit([], [debuff({ type: "corrosion", stacks: 3 })])),
    ).toEqual({ buffs: 0, stances: 0, debuffs: 1 });
  });

  it("a stance counts as a stance, not as a buff", () => {
    // #133: a stance is its own class, coloured yellow, because it answers a
    // different question from a buff — what can cancel it. Counting it under
    // ↑ would hide exactly the distinction the colour exists to draw.
    expect(
      effectCounts(
        unit(
          [buff(), { type: "stance", stat: "def", valuePercent: 30 } as StatusEffect],
          [],
        ),
      ),
    ).toEqual({ buffs: 1, stances: 1, debuffs: 0 });
  });

  it("anything carrying a stance group counts as a stance, whatever its type", () => {
    // Membership is by group (#132), so a DEF raise typed `buff` but applied
    // by a stance skill is part of that stance here too — the colour and the
    // cancel rule read the same predicate.
    expect(
      effectCounts(unit([buff({ groupId: "g1", groupName: "Hold" })], [])),
    ).toEqual({ buffs: 0, stances: 1, debuffs: 0 });
  });

  it("returns zeroes for a clean unit", () => {
    expect(effectCounts(unit([], []))).toEqual({
      buffs: 0,
      stances: 0,
      debuffs: 0,
    });
  });

  it("returns zeroes when every entry is grey", () => {
    // The strip renders nothing here — NOT "↑0 ↓0".
    expect(
      effectCounts(
        unit([buff({ uncancellable: true })], [debuff({ uncancellable: true })]),
      ),
    ).toEqual({ buffs: 0, stances: 0, debuffs: 0 });
  });
});

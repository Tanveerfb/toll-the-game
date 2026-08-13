import { describe, expect, it } from "vitest";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";

/**
 * The kit-design rules, enforced (2026-08-13).
 *
 * `docs/design/KIT_DESIGN.md` has carried these since 2026-08-10 and nothing
 * checked them. What existed instead was a "stat sanity" block asserting
 * `chiaraData.atk === 205` — a test that restates the JSON, so it can never
 * catch a bug and can only fail when Tanveer rebalances. Its own comment read
 * "Numbers updated by the 2026-08-10 roster stat rebalance", which is the
 * anti-pattern caught in the act: the test failed, and the fix was to copy the
 * new numbers in.
 *
 * These assert **invariants instead of values**. They survive any rebalance
 * that stays inside the design rules, and they fail on one that doesn't —
 * which is the opposite of what they replace.
 *
 * Only rules stated in the docs are encoded here. Balance is Tanveer's; a
 * failure below means either a kit drifted or a rule changed, and which of
 * those it is, is his call — not something to silently widen a band over.
 */

const PLAYABLE = getPlayableCharacters();

/**
 * The union of the three role bands (KIT_DESIGN.md §2, post-ruling-#68):
 * dealer 190–300 / 80–160 / 2900–3600, support 155–205 / 145–155 / 3000–3200,
 * defense 110–175 / 210–240 / 3600–4000.
 *
 * Checked as a union rather than per role because **role is not stored in the
 * kit JSON** — it comes from what the kit does, and the doc is explicit that
 * you never read the role off the numbers. Encoding a role map here would
 * duplicate a design decision into a test file, where it would rot.
 */
const STAT_BANDS = {
  atk: { min: 110, max: 300 },
  def: { min: 80, max: 240 },
  hp: { min: 2900, max: 4000 },
} as const;

/**
 * Kits that knowingly break a rule below, with the reason.
 *
 * An allowlist rather than a softened assertion: the violation stays visible
 * in the suite instead of being buried in a design doc, and clearing the entry
 * is what "fixed" looks like.
 *
 * Empty as of 2026-08-13. Isolde was the only entry — ruling #67, healing off
 * HP while attacking off ATK — and Tanveer closed it by moving her whole kit
 * to HP scaling (Severed Ledger 16/20/25). The entry came out with the fix.
 */
const KNOWN_EXCEPTIONS = {
  oneScalingStat: [] as readonly string[],
} as const;

describe("statlines sit in the roster bands", () => {
  for (const character of PLAYABLE) {
    it(`${character.id}`, () => {
      for (const [stat, band] of Object.entries(STAT_BANDS)) {
        const value = character[stat as keyof typeof STAT_BANDS] as number;
        expect(value, `${character.id} ${stat}`).toBeGreaterThanOrEqual(
          band.min,
        );
        expect(value, `${character.id} ${stat}`).toBeLessThanOrEqual(band.max);
      }
    });
  }
});

describe("ranks never exceed 3", () => {
  it("every rank ladder has exactly three entries", () => {
    // KIT_DESIGN.md §5: "Only values written x/y/z are rank-scaled." A ladder
    // of any other length means a rank the deck can never deal, or a card that
    // reads its own last entry off the end of the array.
    const offenders: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        if (path.endsWith("Ranked") && value.length !== 3) {
          offenders.push(`${path} has ${value.length}`);
        }
        value.forEach((entry, i) => walk(entry, `${path}[${i}]`));
        return;
      }
      if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          walk(child, `${path}.${key}`);
        }
      }
    };
    for (const character of PLAYABLE) walk(character, character.id);
    expect(offenders).toEqual([]);
  });

  it("no ultimate carries a rank ladder", () => {
    // "Ultimates never rank" (§5). An ultimate with `damageRanked` would be
    // read at whatever rank the card happened to be dealt at.
    for (const character of PLAYABLE) {
      if (!character.ultimate) continue;
      expect(
        "damageRanked" in character.ultimate,
        `${character.id}'s ultimate`,
      ).toBe(false);
      expect(
        typeof character.ultimate.damage,
        `${character.id}'s ultimate`,
      ).toBe("number");
    }
  });
});

describe("rank ladders climb", () => {
  it("damage never goes down as a card ranks up", () => {
    // Not the 65%/80% pacing convention — that's a tendency and encoding it
    // would fail on legitimate kits. This is the floor: a card that got
    // *weaker* at a higher rank is a data entry error, every time.
    for (const character of PLAYABLE) {
      for (const skill of character.skills) {
        const ranked = skill.damageRanked;
        if (!Array.isArray(ranked)) continue;
        // A zero-damage utility skill is legitimate; only a real ladder is
        // asserted against.
        if (ranked.every((value) => value === 0)) continue;
        for (let i = 1; i < ranked.length; i += 1) {
          expect(
            ranked[i],
            `${character.id} — ${skill.skillName} R${i + 1}`,
          ).toBeGreaterThanOrEqual(ranked[i - 1]);
        }
      }
    }
  });
});

describe("a synergy's description matches who it actually reaches", () => {
  it("no tag synergy claims to buff 'all allies'", () => {
    // `passive.ts` only applies a synergy buff to allies **carrying the tag** —
    // a male ally on a team with Sara gets nothing from [Female]. Two kits
    // described it as reaching "all allies" anyway (Sara and Batra, both fixed
    // 2026-08-13 on Tanveer's call: the text was wrong, not the code).
    //
    // `passiveDescriptionSync` can't catch this — it checks that stated
    // *numbers* are backed by mechanic data and has no notion of scope.
    const offenders: string[] = [];
    for (const character of PLAYABLE) {
      const passive = character.passive;
      if (!passive) continue;
      for (const mechanic of passive.mechanics ?? []) {
        if (mechanic.type !== "synergy") continue;
        // `flatBonus` synergies are a fixed % per carrier and already word
        // themselves as "[Tag] allies' basic stats 5% up".
        if (!mechanic.conditionTags || mechanic.flatBonus) continue;
        if (/all allies/i.test(passive.description)) {
          offenders.push(`${character.id} — ${passive.name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("one scaling stat per kit", () => {
  // Ruling #67. A kit that reads damage off ATK and heals off HP is two half
  // characters, and inflating either stat silently buffs half the kit.
  for (const character of PLAYABLE) {
    const known = KNOWN_EXCEPTIONS.oneScalingStat.includes(character.id);
    it(`${character.id}${known ? " (known exception)" : ""}`, () => {
      const stats = new Set<string>();

      for (const skill of character.skills) {
        // A `statMultiplier` on a skill that deals nothing is inert — Yalina
        // and Iron both declare one on zero-damage skills, which the audit
        // called cosmetic rather than a violation.
        const ranked = skill.damageRanked;
        const deals = Array.isArray(ranked) && ranked.some((v) => v > 0);
        if (deals && skill.statMultiplier) stats.add(skill.statMultiplier);
      }
      if (character.ultimate?.damage && character.ultimate.statMultiplier) {
        stats.add(character.ultimate.statMultiplier);
      }

      if (known) {
        // Pinned as broken on purpose: when this starts passing, the ruling
        // has been resolved and the entry should come out of the allowlist.
        expect(stats.size, `${character.id} is allowlisted but now conforms`)
          .toBeGreaterThan(1);
        return;
      }
      expect([...stats].sort(), `${character.id} scaling stats`).toHaveLength(
        stats.size > 0 ? 1 : 0,
      );
    });
  }
});

import { describe, expect, it } from "vitest";
import { getAllCharacters } from "@/lib/game/characterCatalog";
import {
  keywordStatesItsOwnValue,
  mechanicGlossary,
} from "@/lib/game/mechanicGlossary";
import { extractKeywordFootnotes } from "@/lib/game/keywordFootnotes";
import { buildDescriptionForRank } from "@/lib/game/descriptionTranslator";

/**
 * Two kit-authoring rulings that were prose until 2026-08-19, both confirmed
 * by Tanveer the same day.
 *
 * #65 — "Never name an unimplemented mechanic. Write what the engine does
 * today." Frost's Glacial Bind read "Freezes them for 1 turn" while the engine
 * ran `stun`; [Freeze] is a *future* mechanic (#75 rules it a stun variant,
 * unbuilt). His reason for wanting this mechanised: "don't want you inventing
 * names and mechanics on your own. consulting me first is a must."
 *
 * #58 — a tier word names a fixed value and the value never moves. What stays
 * forbidden is a ladder *inside* one tier word; stepping *between* words is
 * fine (Chiara's [30,50,50] reads "lowers" then "greatly lowers").
 *
 * Note the boundary with #56: values are free, and this file only ever checks
 * a value when the description actually spends a tier word on it. Explicit
 * percentages are equally legal and are not audited (Leorio's 20/30/50).
 */

const characters = getAllCharacters();

type Action = {
  skillName?: string;
  description?: string;
  mechanics?: Record<string, unknown>[];
};

function actionsOf(c: Record<string, unknown>): Action[] {
  const out: Action[] = [];
  for (const s of (c.skills as Action[]) ?? []) out.push(s);
  if (c.ultimate) out.push(c.ultimate as Action);
  if (c.spSkill) out.push(c.spSkill as Action);
  return out;
}

describe("#65 — descriptions only name mechanics the engine has", () => {
  /**
   * Mechanics that have been *named* in design conversation but do not exist
   * in `types/mechanic.ts`. A word leaves this list the day it is built, not
   * the day it is discussed. Freeze is the one with history; add to this list
   * whenever Tanveer names a future mechanic, so a kit can't ship using it.
   */
  const NOT_BUILT = ["freeze", "freezes", "frozen", "chill", "chilled"];

  it("no skill description names an unbuilt mechanic", () => {
    const offenders: string[] = [];
    for (const c of characters) {
      for (const a of actionsOf(c as unknown as Record<string, unknown>)) {
        const text = (a.description ?? "").toLowerCase();
        for (const word of NOT_BUILT) {
          if (new RegExp(`\\b${word}\\b`).test(text)) {
            offenders.push(`${c.id} / ${a.skillName}: "${word}"`);
          }
        }
      }
    }
    // Lore prose is deliberately not checked — Lyra's Red Ice "freezes enemies
    // on contact" is flavour, not a card telling a player what will happen.
    expect(offenders).toEqual([]);
  });

  it("the glossary doesn't advertise an unbuilt mechanic either", () => {
    const keys = Object.keys(mechanicGlossary).map((k) => k.toLowerCase());
    const offenders = keys.filter((k) =>
      NOT_BUILT.some((w) => new RegExp(`\\b${w}\\b`).test(k)),
    );
    expect(offenders).toEqual([]);
  });
});

describe("#58/#109/#130 — a tier word names one exact value", () => {
  /**
   * Tanveer, 2026-08-19, overturning the threshold reading: *"'raises' MUST be
   * 30%. It can't fluctuate, even by 1%. If I allow it, next time you would
   * propose 'greatly raises' to accept even 55%."*
   *
   * So the scale is a set of exact values, not a set of floors:
   *   raising  30 / 50 / 100      lowering  30 / 50 / 80
   * The downward ceiling is lower on purpose — a stat can never be reduced to
   * zero in battle.
   *
   * Ruling **#130** (2026-09-16) makes the other half first-class. A value off
   * that scale is written with the SAME verb and its number stated —
   * "raises ATK by 33%" — rather than swapped for a different verb. The adverb
   * and the number are alternatives and never both, since "greatly raises DEF
   * by 59%" pairs a word meaning 50 with a 59. A bare verb still means the
   * canonical 30%.
   *
   * These tests were dead when #130 was written, and every claim below about
   * what they had verified was false. `/\braises\b/` had been authored through
   * a heredoc that turned each `\b` into a literal `0x08`, so the filter
   * matched nothing and the loop never ran. Repaired the same day; it
   * immediately found four real hits, all of them created minutes earlier by
   * #130's own migration.
   */
  const RAISE = new Set([30, 50, 100]);
  const LOWER = new Set([30, 50, 80]);

  /** Every tier verb in `text`, minus the ones that state their own number. */
  const TIER_VERB_IN_TEXT =
    /\b(?:permanently\s+)?(?:greatly\s+|massively\s+)?(?:raises|lowers)\b/gi;

  function bareTierVerbs(text: string): string[] {
    return [...text.matchAll(TIER_VERB_IN_TEXT)]
      .filter(
        (m) =>
          !keywordStatesItsOwnValue(
            text,
            m[0],
            (m.index ?? 0) + m[0].length,
          ),
      )
      .map((m) => m[0].toLowerCase());
  }

  /**
   * Rendered at every index the action can take. Six, not three: an ultimate
   * has no rank, so the index means ult level and the ladders run to 6.
   */
  function renderedAtEveryRank(a: Action): string[] {
    return [0, 1, 2, 3, 4, 5].map((r) =>
      buildDescriptionForRank(a as never, r).toLowerCase(),
    );
  }

  function buffDebuffValues(m: Record<string, unknown>): number[] {
    const ladder = m.valueRanked as number[] | undefined;
    const flat = m.valuePercent as number | undefined;
    if (Array.isArray(ladder)) return ladder;
    return typeof flat === "number" ? [flat] : [];
  }

  it("every value under a bare tier word sits exactly on the scale", () => {
    const offenders: string[] = [];
    for (const c of characters) {
      for (const a of actionsOf(c as unknown as Record<string, unknown>)) {
        const texts = renderedAtEveryRank(a);
        if (!texts.some((t) => bareTierVerbs(t).length > 0)) continue;

        for (const m of a.mechanics ?? []) {
          const kind = m.type;
          if (kind !== "buff" && kind !== "debuff") continue;
          const allowed = kind === "buff" ? RAISE : LOWER;
          for (const v of buffDebuffValues(m)) {
            // A zero rank drops its clause entirely (#44), so it carries no word.
            if (v <= 0) continue;
            // #130: exempt when the prose states this number itself. Checked
            // against the RENDERED text, because the number only exists after
            // `[buff.value]` resolves.
            if (texts.some((t) => t.includes(`by ${v}%`))) continue;
            if (!allowed.has(v)) {
              offenders.push(
                `${c.id} / ${a.skillName}: ${kind} ${v}% under a bare tier word — write "${kind === "buff" ? "raises" : "lowers"} … by ${v}%"`,
              );
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("#130 — a rank-scaled value never hides behind a tier word", () => {
    /**
     * Tanveer, 2026-09-16: *"The rank scaled numbers don't follow tier based
     * words. And vice versa."* A ladder spells its numbers at every rank; a
     * tier word means one flat value.
     *
     * This retires #58's allowance for a ladder that STEPS between words. The
     * cited example was Chiara's Marked Card, `[30,50,50]` rendering "lowers"
     * then "greatly lowers" through a `[debuff? … : …]` conditional — the only
     * skill in the game the new rule touched. Its `ranks:[false,true,true]`
     * went with the conditional, and that closed a second bug: the engine
     * gates on `ranks` for `aoeRanked` alone (combat.ts), so R1 applied the
     * DEF debuff, while damagePreview.ts read the same array as "inactive at
     * this rank" and showed the player nothing.
     */
    const offenders: string[] = [];
    for (const c of characters) {
      for (const a of actionsOf(c as unknown as Record<string, unknown>)) {
        const laddered = (a.mechanics ?? []).some((m) => {
          if (m.type !== "buff" && m.type !== "debuff") return false;
          const ladder = m.valueRanked as number[] | undefined;
          if (!Array.isArray(ladder)) return false;
          return new Set(ladder.filter((v) => v > 0)).size > 1;
        });
        if (!laddered) continue;

        for (const text of renderedAtEveryRank(a)) {
          for (const verb of bareTierVerbs(text)) {
            offenders.push(
              `${c.id} / ${a.skillName}: rank-scaled value under "${verb}" — state the number`,
            );
          }
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("the adverb and the explicit number are never both used", () => {
    const offenders: string[] = [];
    for (const c of characters) {
      for (const a of actionsOf(c as unknown as Record<string, unknown>)) {
        for (const text of renderedAtEveryRank(a)) {
          if (
            /\b(?:greatly|massively)\s+(?:raises|lowers)\b[^.;]{0,60}?\bby\s+\d+%/i.test(
              text,
            )
          ) {
            offenders.push(`${c.id} / ${a.skillName}: ${text}`);
          }
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});

describe("#135 — one vocabulary per mechanic", () => {
  /**
   * Tanveer, 2026-09-16, approving a proposal after the stance pass found the
   * roster saying one thing two ways.
   *
   * **Damage reduction reads as "reduces … damage taken by N%".** Both phrases
   * were glossary keys meaning different things — "damage reduction" is the
   * effect, "damage taken" is the stat — and three rules pick the second: the
   * audience rule says a self effect names no audience (so "gains" is wrong),
   * the effects panel prints "-25% damage taken", and mechanics are verbs.
   *
   * **A cancel clause ends in a semicolon, not "and".** The renderer prints
   * "and"; the semicolon is what the AUTHOR writes, because it is the unit
   * `dropZeroValueClauses` can hide (#44). Two skills wrote "and" and rendered
   * identically, so nothing caught it — and a droppable clause added to either
   * would have taken the damage text down with it.
   */
  it("no description uses the noun form 'damage reduction'", () => {
    const offenders: string[] = [];
    for (const c of characters) {
      for (const a of actionsOf(c as unknown as Record<string, unknown>)) {
        if (/damage reduction/i.test(a.description ?? "")) {
          offenders.push(
            `${c.id} / ${a.skillName}: write "reduces … damage taken by N%"`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("a cancel clause is separated by a semicolon, not 'and'", () => {
    const offenders: string[] = [];
    for (const c of characters) {
      for (const a of actionsOf(c as unknown as Record<string, unknown>)) {
        // The "and" in "cancels buffs AND stances" joins two objects inside
        // one clause and is correct — the first version of this check flagged
        // all four skills that write it. What is wrong is an "and" AFTER the
        // object list, joining the cancel to a different clause.
        const joinsAnotherClause =
          /\bcancels\s+(?:buffs|stances)(?:\s+and\s+(?:buffs|stances))*\s+and\s+(?!buffs\b|stances\b)/i;
        if (joinsAnotherClause.test(a.description ?? "")) {
          offenders.push(`${c.id} / ${a.skillName}: use ";" between clauses`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("#27 — one pill per distinct effect, on real kits", () => {
  /**
   * `extractKeywordFootnotes` is unit-tested in `keywordFootnotes.test.ts`;
   * what was never checked is that the rule holds across every description the
   * game actually ships. The failure mode #27 names is a pill per *word*
   * instead of per *effect* — "greatly lowers" also matching "lowers" at the
   * same spot, so one debuff renders two pills.
   */
  it("no shipped description produces a duplicate or overlapping pill", () => {
    const offenders: string[] = [];
    for (const c of characters) {
      for (const a of actionsOf(c as unknown as Record<string, unknown>)) {
        if (!a.description) continue;
        // Render first. A raw JSON description still holds its placeholders,
        // and `[stun.duration]` contains the glossary key "stun" — checking
        // the unrendered string reports a duplicate pill on every skill whose
        // placeholder happens to be named after its own mechanic. Chiara's
        // conditional carries both branches in source for the same reason.
        for (let rank = 0; rank < 3; rank++) {
        const desc = buildDescriptionForRank(
          a as never,
          rank,
        );
        if (!desc) continue;
        const pills = extractKeywordFootnotes(desc).map((f) =>
          f.keyword.toLowerCase(),
        );

        const seen = new Set<string>();
        for (const p of pills) {
          if (seen.has(p))
            offenders.push(`${c.id} / ${a.skillName} R${rank + 1}: "${p}" twice`);
          seen.add(p);
        }
        // Deliberately NOT checked: one pill containing another as a
        // substring. That looked like the per-word failure and is not —
        // Gon's ultimate legitimately carries "raises" (ATK, permanent) and
        // "greatly raises" (DEF, 1 turn) as two distinct effects at two
        // positions in one sentence. What #27 actually forbids is one *span*
        // of text producing two pills, and `extractKeywordFootnotes` makes
        // that impossible by construction: it sorts keys longest-first into a
        // single non-overlapping regex, so "greatly raises" consumes the span
        // and the bare "raises" can never also match there. That behaviour has
        // its own unit tests in `keywordFootnotes.test.ts`.
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

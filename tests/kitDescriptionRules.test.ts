import { describe, expect, it } from "vitest";
import { getAllCharacters } from "@/lib/game/characterCatalog";
import { mechanicGlossary } from "@/lib/game/mechanicGlossary";
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
          if (new RegExp(`\b${word}\b`).test(text)) {
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
      NOT_BUILT.some((w) => new RegExp(`\b${w}\b`).test(k)),
    );
    expect(offenders).toEqual([]);
  });
});

describe("#58/#109 — a tier word names one exact value", () => {
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
   * A value off that scale is not forbidden; it is written differently.
   * "Increases ATK and evade chance by 33%" states the number in the text, so
   * nothing is hidden and the effect gets no hover pill. `tierWord` returns
   * undefined for those, and `buildSkillKeywordGlossary` skips them.
   *
   * This also subsumes the older ladder rule: a ladder cannot step inside one
   * tier word if every tier-worded value has to be exact.
   *
   * Audited across the roster the day this was written: 27 kits, and the only
   * off-scale value in the game was Chiara's evade 33 — which had been written
   * under a tier word since 2026-08-09 and is what prompted the ruling.
   */
  const RAISE = new Set([30, 50, 100]);
  const LOWER = new Set([30, 50, 80]);

  it("every value under a tier word sits exactly on the scale", () => {
    const offenders: string[] = [];
    for (const c of characters) {
      for (const a of actionsOf(c as unknown as Record<string, unknown>)) {
        const text = (a.description ?? "").toLowerCase();
        // Skills that state their numbers spend no tier word and are exempt —
        // Leorio's 20/30/50 says "increases their ATK and DEF by [buff.value]%".
        if (!/raises|lowers/.test(text)) continue;

        for (const m of a.mechanics ?? []) {
          const kind = m.type;
          if (kind !== "buff" && kind !== "debuff") continue;
          const allowed = kind === "buff" ? RAISE : LOWER;
          const ladder = m.valueRanked as number[] | undefined;
          const flat = m.valuePercent as number | undefined;
          const values = Array.isArray(ladder)
            ? ladder
            : typeof flat === "number"
              ? [flat]
              : [];
          for (const v of values) {
            // A zero rank drops its clause entirely (#44), so it carries no word.
            if (v <= 0) continue;
            if (!allowed.has(v)) {
              offenders.push(
                `${c.id} / ${a.skillName}: ${kind} ${v}% under a tier word — use "Increases/Decreases … by ${v}%"`,
              );
            }
          }
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

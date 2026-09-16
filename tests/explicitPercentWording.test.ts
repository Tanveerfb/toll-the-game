import { describe, expect, it } from "vitest";
import { getAllCharacters } from "@/lib/game/characterCatalog";
import { buildDescriptionForRank } from "@/lib/game/descriptionTranslator";
import { extractKeywordFootnotes } from "@/lib/game/keywordFootnotes";
import {
  keywordStatesItsOwnValue,
  mechanicGlossary,
} from "@/lib/game/mechanicGlossary";

/**
 * Ruling #130 (Tanveer, 2026-09-16): the explicit percentage is a first-class
 * description form, not a fallback with a different verb.
 *
 *   raises ATK              30%   (the bare verb still means the canonical value)
 *   greatly raises ATK      50%
 *   massively raises ATK   100%
 *   raises ATK by 33%       33%   (adverb and number are alternatives, never both)
 *
 * His words on the pairing: *"greatly raises defense by — not greatly, just
 * raises defense by 59%."* A word meaning 50 cannot sit in front of a 59.
 *
 * What made this a code change rather than a wording allowance: `raises` is a
 * GLOBAL key in `mechanicGlossary`, merged under every per-skill glossary, so
 * without suppression "raises DEF by 59%" renders a pill asserting 30%
 * directly above a sentence saying 59.
 */

describe("#130 — keywordStatesItsOwnValue", () => {
  const at = (text: string, keyword: string) =>
    keywordStatesItsOwnValue(
      text,
      keyword,
      text.toLowerCase().indexOf(keyword.toLowerCase()) + keyword.length,
    );

  it("suppresses a tier verb that states its own percentage", () => {
    expect(at("Raises ATK by 33% for 2 turns.", "Raises")).toBe(true);
    expect(at("Lowers DEF by 59% for 1 turn.", "Lowers")).toBe(true);
    expect(at("Raises all allies' basic stats by 20%.", "Raises")).toBe(true);
  });

  it("leaves a bare tier verb alone — it still needs its pill", () => {
    expect(at("Raises ATK for 2 turns.", "Raises")).toBe(false);
    expect(at("Greatly raises DEF for 1 turn.", "Greatly raises")).toBe(false);
  });

  it("never reaches across a clause boundary for the number", () => {
    // The first verb has no number of its own and must keep its pill; only
    // the second one states a value.
    const text = "Raises ATK for 2 turns; lowers DEF by 30%.";
    expect(at(text, "Raises")).toBe(false);
    expect(at(text, "lowers")).toBe(true);
  });

  it("only applies to tier verbs", () => {
    expect(at("Taunts and reduces damage taken by 35%.", "Taunts")).toBe(false);
  });

  it("counts an unresolved placeholder as a stated value", () => {
    // `KeyworkHighlighter` is pointed at raw prose in places. A pill claiming
    // 30% over an unrendered ladder is the same lie as over a rendered one.
    expect(at("Raises ATK by [buff.value]% for 2 turns.", "Raises")).toBe(true);
  });

  it("does not scan indefinitely far for a 'by N%'", () => {
    const far =
      "Raises ATK while the wielder still stands and the tide has not yet " +
      "turned against them by 33%.";
    expect(at(far, "Raises")).toBe(false);
  });
});

describe("#130 — footnotes follow the same rule", () => {
  it("drops the tier-verb footnote when the number is in the text", () => {
    const pills = extractKeywordFootnotes(
      "Raises ATK by 33% for 2 turns.",
      mechanicGlossary,
    ).map((f) => f.keyword);
    expect(pills).not.toContain("raises");
  });

  it("keeps it when the verb is carrying the value", () => {
    const pills = extractKeywordFootnotes(
      "Raises ATK for 2 turns.",
      mechanicGlossary,
    ).map((f) => f.keyword);
    expect(pills).toContain("raises");
  });

  it("the global key it would have shown is the one that would be wrong", () => {
    // Proves the hazard is real rather than theoretical: this is the text a
    // suppressed pill would have displayed over a sentence saying 59%.
    expect(mechanicGlossary.raises).toBe("Raises the stat by 30%");
  });
});

describe("#130 — on every shipped description", () => {
  type Action = { skillName?: string; description?: string };

  function actionsOf(c: Record<string, unknown>): Action[] {
    const out: Action[] = [];
    for (const s of (c.skills as Action[]) ?? []) out.push(s);
    if (c.ultimate) out.push(c.ultimate as Action);
    if (c.spSkill) out.push(c.spSkill as Action);
    return out;
  }

  it("no rendered description pills a verb over a number it contradicts", () => {
    const offenders: string[] = [];
    for (const c of getAllCharacters()) {
      const raw = c as unknown as Record<string, unknown>;
      for (const a of actionsOf(raw)) {
        if (!a.description) continue;
        for (let rank = 0; rank < 3; rank++) {
          const text = buildDescriptionForRank(a as never, rank);
          const pills = extractKeywordFootnotes(text, mechanicGlossary).map(
            (f) => f.keyword,
          );
          const tierPill = pills.find((p) => /raises|lowers/.test(p));
          if (!tierPill) continue;
          // A tier pill is only legitimate over a clause with no number.
          if (/\b(?:raises|lowers)\b[^.;]{0,60}?\bby\s+\d+%/i.test(text)) {
            offenders.push(`${raw.id} / ${a.skillName} R${rank + 1}: ${text}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("#130 — the migrated kits, as the player reads them", () => {
  function render(id: string, skillName: string): string[] {
    const c = getAllCharacters().find(
      (x) => (x as unknown as { id?: string }).id === id,
    );
    if (!c) throw new Error(`no character ${id}`);
    const raw = c as unknown as Record<string, unknown>;
    const acts = [
      ...(((raw.skills as unknown[]) ?? []) as Record<string, unknown>[]),
      raw.ultimate as Record<string, unknown>,
      raw.spSkill as Record<string, unknown>,
    ].filter(Boolean);
    const a = acts.find((x) => x.skillName === skillName);
    if (!a) throw new Error(`no skill ${id}/${skillName}`);
    return [0, 1, 2].map((r) => buildDescriptionForRank(a as never, r));
  }

  it("Chiara's Marked Card spells its ladder instead of stepping words", () => {
    // Was `[debuff? greatly lowers : lowers] DEF` on a [30,50,50] ladder —
    // the one skill in the game the ladder rule touched.
    expect(render("chiara", "Marked Card")).toEqual([
      "Does damage equal to 260% ATK to one enemy and lowers DEF by 30% for 1 turn.",
      "Does damage equal to 320% ATK to one enemy and lowers DEF by 50% for 1 turn.",
      "Does damage equal to 400% ATK to one enemy and lowers DEF by 50% for 2 turns.",
    ]);
  });

  it("Leorio keeps one sentence shape across a 20/30/50 ladder", () => {
    expect(render("leorio", "Member of the Zodiac")).toEqual([
      "Targets one chosen ally and raises that ally's ATK and DEF by 20% for 1 turn.",
      "Targets all allies and raises their ATK and DEF by 30% for 1 turn.",
      "Targets all allies and raises their ATK and DEF by 50% for 2 turns.",
    ]);
  });

  it("a 50/75/100 ladder reads the same way at every rank", () => {
    expect(render("checkpoint_bruiser", "Close the Gate")).toEqual([
      "Raises all allies' DEF by 50% for 1 turn.",
      "Raises all allies' DEF by 75% for 2 turns.",
      "Raises all allies' DEF by 100% for 2 turns.",
    ]);
  });

  it("Chiara's off-scale flat 33 keeps the verb and states the number", () => {
    expect(render("chiara", "All In")[0]).toBe(
      "Raises ATK and evade chance by 33% for 3 turns and then does damage equal to 333% ATK to all enemies.",
    );
  });

  it("a stance that reduces damage taken is not a tier verb and is untouched", () => {
    // `reduces damage taken` is not a raise or lower of a stat, so #130's
    // verb rule does not reach it and its own pill is still correct. The
    // sentence around it was rebuilt by #134 (stance wording) — the verb
    // under test is the part that did NOT change.
    expect(render("toll_collector", "State Your Business")[0]).toBe(
      "Assumes a stance for 1 turn: taunts all enemies and reduces damage taken by 35%.",
    );
  });
});

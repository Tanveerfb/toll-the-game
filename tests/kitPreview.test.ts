import { describe, expect, it } from "vitest";
import {
  getAllCharacters,
  getCharacterById,
  getCharacterKit,
  getCharacterPhases,
} from "@/lib/game/characterCatalog";
import { buildCharacterDamagePreview } from "@/lib/game/damagePreview";

const characters = getAllCharacters();

function rowsFor(id: string) {
  const character = getCharacterById(id);
  if (!character) throw new Error(`missing character: ${id}`);
  return buildCharacterDamagePreview(character);
}

describe("kit preview coverage", () => {
  it("produces at least one row for every character", () => {
    const empty = characters
      .filter((c) => buildCharacterDamagePreview(c).length === 0)
      .map((c) => c.id);
    expect(empty).toEqual([]);
  });

  it("covers every ability of every phase, including phase 2+", () => {
    // Multi-phase kits used to be truncated to phase 1 — Molvarr's Abyssal
    // Pierce, Devouring Bite and Tidal Cataclysm never appeared at all.
    const gaps: string[] = [];
    for (const character of characters) {
      const names = new Set(
        buildCharacterDamagePreview(character).map((r) => r.abilityName),
      );
      const phaseCount = Math.max(1, getCharacterPhases(character).length);
      for (let phase = 0; phase < phaseCount; phase++) {
        const kit = getCharacterKit(character, phase);
        for (const skill of kit.skills) {
          if (!names.has(skill.skillName)) {
            gaps.push(`${character.id} p${phase + 1}: ${skill.skillName}`);
          }
        }
        if (kit.ultimate && !names.has(kit.ultimate.skillName)) {
          gaps.push(`${character.id} p${phase + 1}: ${kit.ultimate.skillName}`);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it("tags multi-phase rows with their phase and leaves single-phase rows untagged", () => {
    const molvarr = rowsFor("molvarr");
    expect(new Set(molvarr.map((r) => r.phaseLabel))).toEqual(
      new Set(["Phase 1", "Phase 2"]),
    );
    expect(rowsFor("duke").every((r) => r.phaseLabel === undefined)).toBe(true);
  });

  /**
   * Inverted 2026-09-17. This asserted a passive row for every character;
   * Tanveer removed passives from this table: *"the passive doesn't need to be
   * there - it's only the skills and ultimates."* The passive is still
   * documented in full on the same page, in its own section.
   */
  it("shows no passive rows at all", () => {
    const passiveRows = characters.flatMap((c) =>
      buildCharacterDamagePreview(c)
        .filter((r) => r.rankLabel === "Passive")
        .map((r) => `${c.id}: ${r.abilityName}`),
    );
    expect(passiveRows).toEqual([]);
  });

  /**
   * The gap that made this table worth keeping rather than deleting.
   *
   * An ultimate ladders by ult level, not rank (#92), and `buildKitRows` used
   * to push it **once** - so Lyra's `damageByUltLevel` of
   * [350, 385, 430, 475, 520, 575] rendered as a single 350% row and five
   * sixths of the progression was invisible on a page whose job is showing
   * progression.
   *
   * **Falsified before being trusted**: collapsing the ult-level loop back to
   * a single `push(kit.ultimate)` turns this red on all 24 kits with one.
   */
  it("gives an ultimate one row per ult level", () => {
    const wrong: string[] = [];
    for (const character of characters) {
      const levels = character.ultimate?.damageByUltLevel;
      if (!Array.isArray(levels) || levels.length === 0) continue;
      const rows = buildCharacterDamagePreview(character).filter(
        (r) => r.abilityName === character.ultimate!.skillName,
      );
      if (rows.length !== levels.length) {
        wrong.push(`${character.id}: ${rows.length} rows for ${levels.length} levels`);
      }
    }
    expect(wrong).toEqual([]);
  });

  /**
   * Every ability answers the same question the same way.
   *
   * The per-character scenario switch this replaced hand-wrote cases for six
   * ids and let everyone else fall through, so Batra got 13 rows and Lyra 7
   * for the same question. A skill's row count is now its own ladder length
   * and nothing else.
   */
  it("gives a ranked skill one row per rank", () => {
    const wrong: string[] = [];
    for (const character of characters) {
      const rows = buildCharacterDamagePreview(character);
      for (const skill of character.skills) {
        const ranks = skill.damageRanked;
        if (!Array.isArray(ranks) || ranks.length === 0) continue;
        const forSkill = rows.filter((r) => r.abilityName === skill.skillName);
        if (forSkill.length !== ranks.length) {
          wrong.push(
            `${character.id}/${skill.skillName}: ${forSkill.length} rows for ${ranks.length} ranks`,
          );
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe("kit preview correctness", () => {
  it("never reports damage for a skill with no damage multiplier", () => {
    // The engine's max(1, base - def) floor used to leak out as "1 damage"
    // on pure buff/stance skills — Mustafa's Fortress and Leorio's Member of
    // the Zodiac both read "1 damage" with empty notes.
    const bad = characters.flatMap((c) =>
      buildCharacterDamagePreview(c)
        .filter((r) => r.multiplierLabel === "—" && /\d+ damage/.test(r.resultLabel))
        .map((r) => `${c.id}: ${r.abilityName} -> ${r.resultLabel}`),
    );
    expect(bad).toEqual([]);
  });

  it("describes what a support skill actually does", () => {
    const fortress = rowsFor("mustafa").filter(
      (r) => r.abilityName === "Earth Stance: Fortress",
    );
    expect(fortress).toHaveLength(3);
    expect(fortress[0].resultLabel).toBe("Damage taken −25% (1 turn)");
    expect(fortress[2].resultLabel).toBe("Damage taken −60% (2 turns)");
  });

  it("merges sibling stat buffs sharing an amount and duration", () => {
    // Leorio buffs ATK and DEF by the same amount — two rows read as one line.
    const zodiac = rowsFor("leorio").filter(
      (r) => r.abilityName === "Member of the Zodiac",
    );
    expect(zodiac[2].resultLabel).toBe("ATK · DEF +50% (2 turns)");
  });

  it("puts the healed amount in the result, not buried in the notes", () => {
    const heal = rowsFor("isolde").filter(
      (r) => r.abilityName === "Threads of Renewal",
    );
    expect(heal[0].resultLabel).toMatch(/^Heals \d+ HP to one ally$/);
    expect(heal[2].resultLabel).toMatch(/^Heals \d+ HP to each ally$/);
  });

  it("omits rank-gated effects at ranks where they are inactive", () => {
    // Chiara's House Rules gains its seal only at R3; the preview used to say
    // "No seal at this rank. Seals skills." on the same line.
    const houseRules = rowsFor("chiara").filter(
      (r) => r.abilityName === "House Rules",
    );
    expect(houseRules[0].notes).not.toMatch(/Seals skills/);
    expect(houseRules[2].notes).toMatch(/Seals/);
  });

  it("never emits a zero-valued effect", () => {
    const bad = characters.flatMap((c) =>
      buildCharacterDamagePreview(c)
        .filter((r) => /[+−-]0[^\d%]/.test(`${r.resultLabel} ${r.notes}`))
        .map((r) => `${c.id}: ${r.abilityName} -> ${r.notes}`),
    );
    expect(bad).toEqual([]);
  });

  it("never repeats an effect the prose notes already narrate", () => {
    // "Stuns for 2 turns. … Stuns (2 turns)." on Leorio's ultimate. The prose
    // form reads "…for N turns."; the summariser's form is parenthesised, so
    // the two co-occurring in one cell is the duplicate. Matching on the verb
    // alone would flag Chiara's House Rules, which genuinely applies two
    // DIFFERENT seals (debuff and attackDebuff) at rank 3.
    const bad = characters.flatMap((c) =>
      buildCharacterDamagePreview(c)
        .filter((r) => /(Stuns|Seals)[^.]*\(\d+ turns?\)/.test(r.notes))
        .map((r) => `${c.id}: ${r.abilityName} -> ${r.notes}`),
    );
    expect(bad).toEqual([]);
  });

  it("reports every seal a skill applies, naming which skills each locks", () => {
    // House Rules carries two seals with different rank gates. Reading only
    // the first said "No seal at this rank" at R2 — contradicting the skill's
    // own description, which lists a seal there.
    const houseRules = rowsFor("chiara").filter(
      (r) => r.abilityName === "House Rules",
    );
    expect(houseRules[1].notes).toMatch(/Seals attack debuff skills for 1 turn/);
    expect(houseRules[2].notes).toMatch(/Seals debuff skills for 2 turns/);
    expect(houseRules[2].notes).toMatch(/Seals attack debuff skills for 2 turns/);
  });

  it("never leaks a raw stand-in emoji into a row", () => {
    // Literal 👆/👇 are a phone-typeable stand-in for icons — these rows are
    // plain text, so they must not survive as raw emoji. The passive half of
    // this test went with the passive rows (2026-09-17).
    const anyEmoji = characters.flatMap((c) =>
      buildCharacterDamagePreview(c).filter((r) =>
        /[\u{1F446}\u{1F447}]/u.test(`${r.resultLabel} ${r.notes}`),
      ),
    );
    expect(anyEmoji).toEqual([]);
  });

  it("computes every row at one baseline, so the figures compare", () => {
    // The scenario column is gone from the UI because it no longer varies by
    // character. Two labels exist and only one of them is a scenario:
    // "Standard" is the baseline every row is computed at, and "Per counter"
    // is a UNIT - a counter stance's row reports damage dealt back per attack
    // received, not damage dealt on use. Anything else appearing here means
    // per-character scenarios have crept back and the figures have stopped
    // being comparable between characters.
    const labels = new Set(
      characters.flatMap((c) =>
        buildCharacterDamagePreview(c).map((r) => r.scenarioLabel),
      ),
    );
    expect([...labels].sort()).toEqual(["Per counter", "Standard"]);
  });
});

describe("kit preview de-duplication", () => {
  it("does not restate a self-buff already folded into the damage number", () => {
    // Mustafa's ultimate read "Self DEF buff included (+30%). DEF +30% (2
    // turns)." — the same buff, twice, in one cell.
    const ult = rowsFor("mustafa").find(
      (r) => r.abilityName === "Tea Time Tremor",
    );
    expect(ult?.notes).toContain("Self DEF buff included");
    expect(ult?.notes).not.toMatch(/DEF \+30% \(2 turns\)/);
  });

  it("still reports a self-buff on a stat the damage number does not fold in", () => {
    // Chiara's ultimate buffs ATK (folded in) and Evade (not) — Evade must
    // survive the de-duplication.
    const ult = rowsFor("chiara").find((r) => r.abilityName === "All In");
    expect(ult?.notes).toMatch(/Evade/);
  });
});

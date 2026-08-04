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

  it("includes a passive row for every character that has a passive", () => {
    for (const character of characters) {
      if (!character.passive) continue;
      const rows = buildCharacterDamagePreview(character);
      expect(
        rows.some((r) => r.rankLabel === "Passive"),
        `${character.id} has a passive but no passive row`,
      ).toBe(true);
    }
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
    expect(zodiac[2].resultLabel).toBe("ATK · DEF +40% (2 turns)");
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

  it("reads a passive's authored description rather than guessing from mechanics", () => {
    const passive = rowsFor("mustafa").find((r) => r.rankLabel === "Passive");
    expect(passive?.resultLabel).toContain("DEF 50%");
    // Literal 👆/👇 are a phone-typeable stand-in for icons — this table is
    // plain text, so they must not survive as raw emoji.
    const anyEmoji = characters.flatMap((c) =>
      buildCharacterDamagePreview(c).filter((r) =>
        /[\u{1F446}\u{1F447}]/u.test(`${r.resultLabel} ${r.notes}`),
      ),
    );
    expect(anyEmoji).toEqual([]);
  });

  it("leaves no passive row saying nothing useful", () => {
    const useless = characters
      .filter((c) => c.passive)
      .flatMap((c) =>
        buildCharacterDamagePreview(c)
          .filter((r) => r.rankLabel === "Passive" && r.resultLabel === "See kit")
          .map(() => c.id),
      );
    expect(useless).toEqual([]);
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

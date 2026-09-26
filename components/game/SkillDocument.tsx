import type { ReactNode } from "react";
import KeyworkHighlighter from "@/components/ui/KeyworkHighlighter";
import { PROSE, ProseTable } from "@/components/ui/prose";
import {
  HEAL_NUMBER_CLASS,
  SKILL_TYPE_CHIP,
  skillTypeCategory,
} from "@/lib/game/skillTypeStyle";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";
import {
  buildRankedSkillDescriptions,
  buildUltLevelDescriptions,
  buildSingleDescription,
  buildSkillKeywordGlossary,
  getMechanicTypes,
} from "@/lib/game/descriptionTranslator";
import { mechanicGlossary } from "@/lib/game/mechanicGlossary";

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Skill-type accent, matching the effect-pill scheme used everywhere else:
 *  attack = aggression, debuff/disable = affliction, heal/buff = restoration,
 *  stance and ultimate = climax. These are the `role-*` tokens, which alias
 *  the element hues rather than adding a second colour vocabulary. */
// Ruling #133: shared with the hand and the archive via
// `lib/game/skillTypeStyle.ts`. See the note there on what the three separate
// maps used to disagree about.

/**
 * One skill rendered as a document section rather than a bordered card:
 * a ruled heading, a metadata line (slot · type · mechanics), and a rank
 * table.
 *
 * The archive page previously stacked three prose sentences per skill inside
 * nested boxes, so telling R1 from R3 meant diffing paragraphs by eye. One row
 * per rank fixes that on its own. There was a separate Mult column for a while
 * — dropped (Tanveer, 2026-08-11), since `damageRanked[i]` already appears
 * inside the description the translator builds, and printing it twice per row
 * just widened the table.
 */
export default function SkillDocument({
  skill,
  slot,
  ranked = true,
  currentUltLevel,
}: {
  skill: CharacterSkillData;
  /** "S1" / "S2" / "SP" / "ULT" — the card slot this skill occupies. */
  slot: string;
  /** Set false for a skill that never enters the deck and so has no rank —
   *  a boss SP Skill. Without it the rank table prints the same row three
   *  times off a `damageRanked: [0,0,0]` placeholder. */
  ranked?: boolean;
  /**
   * The player's ult level for this character, when known.
   *
   * An ultimate renders its six-level ladder rather than a rank table, and
   * marks the row the player is actually on — the ladder is only useful next to
   * "you are here". Omitted (archive browsing an unowned kit, battle info
   * panels) it still lists every level, just without a marker.
   */
  currentUltLevel?: number;
}): ReactNode {
  const isUlt = skill.type === "ultimate";
  const ultLines = isUlt ? buildUltLevelDescriptions(skill) : null;
  const rankedLines =
    isUlt || !ranked ? null : buildRankedSkillDescriptions(skill);
  const lines = ultLines ?? rankedLines;
  const rowLabel = (index: number) => (ultLines ? `UL${index + 1}` : `R${index + 1}`);
  const metaParts = [...new Set([skill.type, ...getMechanicTypes(skill)])]
    .filter((part) => !(isUlt && part === "ultimate"))
    .map(toTitleCase);
  // The slot as a chip in the class's hue with ink on it (ruling #154): this
  // renders on the archive's paper sheet, where the hue as text would not read.
  const chip = SKILL_TYPE_CHIP[skillTypeCategory(skill)];
  const numberClassName =
    skill.type === "heal" ? HEAL_NUMBER_CLASS : undefined;

  return (
    <div className="mt-5 first:mt-0">
      <h3 className="flex flex-wrap items-center gap-x-2 font-heading text-lg tracking-title">
        <span
          className={`border border-border px-1.5 py-0.5 font-body text-label font-bold uppercase tracking-label ${chip}`}
        >
          {slot}
        </span>
        {skill.skillName}
      </h3>

      {/* Type first, then mechanics — deduped, because a debuff skill carrying
          a `debuff` mechanic would otherwise read "Debuff · Debuff", and an
          ultimate's `ultimate` type just restates the ULT slot chip. */}
      {metaParts.length > 0 ? (
        <p className="mt-0.5 font-body text-label font-bold uppercase tracking-label text-muted-foreground">
          {metaParts.join(" · ")}
        </p>
      ) : null}

      <div className="mt-1.5">
        {lines ? (
          <ProseTable>
            <thead>
              <tr>
                <th className={`${PROSE.th} w-10`}>{ultLines ? "Ult" : "Rank"}</th>
                <th className={PROSE.th}>Effect</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const isCurrent =
                  ultLines != null && currentUltLevel === index + 1;
                return (
                <tr
                  key={`${skill.skillName}-rank-${index + 1}`}
                  className={isCurrent ? "bg-primary/35" : undefined}
                >
                  <td
                    className={`${PROSE.td} font-body text-caption font-bold uppercase tracking-label ${isCurrent ? "" : "text-muted-foreground"}`}
                  >
                    {rowLabel(index)}
                    {isCurrent ? (
                      <span className="ml-1" aria-label="current level">
                        ◄
                      </span>
                    ) : null}
                  </td>
                  <td className={PROSE.td}>
                    <KeyworkHighlighter
                      text={line}
                      className="font-body text-sm leading-relaxed"
                      numberClassName={numberClassName}
                      glossary={{
                        ...mechanicGlossary,
                        ...buildSkillKeywordGlossary(skill, index),
                      }}
                    />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </ProseTable>
        ) : (
          <KeyworkHighlighter
            text={buildSingleDescription(skill)}
            className="font-body text-sm leading-relaxed"
            numberClassName={numberClassName}
            glossary={{
              ...mechanicGlossary,
              ...buildSkillKeywordGlossary(skill, 0),
            }}
          />
        )}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import KeyworkHighlighter from "@/components/ui/KeyworkHighlighter";
import { PROSE, ProseTable } from "@/components/ui/prose";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";
import {
  buildRankedSkillDescriptions,
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
const SKILL_TYPE_ACCENT: Record<string, string> = {
  attack: "text-role-attack",
  debuff: "text-role-control",
  disable: "text-role-control",
  heal: "text-role-heal",
  cleanse: "text-role-heal",
  buff: "text-role-heal",
  stance: "text-role-ultimate",
  ultimate: "text-role-ultimate",
};

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
}: {
  skill: CharacterSkillData;
  /** "S1" / "S2" / "SP" / "ULT" — the card slot this skill occupies. */
  slot: string;
  /** Set false for a skill that never enters the deck and so has no rank —
   *  a boss SP Skill. Without it the rank table prints the same row three
   *  times off a `damageRanked: [0,0,0]` placeholder. */
  ranked?: boolean;
}): ReactNode {
  const isUlt = skill.type === "ultimate";
  const rankedLines =
    isUlt || !ranked ? null : buildRankedSkillDescriptions(skill);
  const metaParts = [...new Set([skill.type, ...getMechanicTypes(skill)])]
    .filter((part) => !(isUlt && part === "ultimate"))
    .map(toTitleCase);
  const accent = SKILL_TYPE_ACCENT[skill.type] ?? "text-readout-dim";
  // Heal amounts read green, the 7DS convention.
  const numberClassName =
    skill.type === "heal" ? "font-semibold text-role-heal" : undefined;

  return (
    <div className="mt-5 first:mt-0">
      <h3 className="flex flex-wrap items-baseline gap-x-2 border-l border-edge pl-2.5 font-heading text-lg tracking-[0.06em] text-readout-strong">
        <span className={`font-body text-[10px] font-bold uppercase tracking-[0.16em] ${accent}`}>
          {slot}
        </span>
        {skill.skillName}
      </h3>

      {/* Type first, then mechanics — deduped, because a debuff skill carrying
          a `debuff` mechanic would otherwise read "Debuff · Debuff", and an
          ultimate's `ultimate` type just restates the ULT slot chip. */}
      {metaParts.length > 0 ? (
        <p className="mt-0.5 pl-3 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
          {metaParts.join(" · ")}
        </p>
      ) : null}

      <div className="mt-1.5 pl-3">
        {rankedLines ? (
          <ProseTable>
            <thead>
              <tr>
                <th className={`${PROSE.th} w-10`}>Rank</th>
                <th className={PROSE.th}>Effect</th>
              </tr>
            </thead>
            <tbody>
              {rankedLines.map((line, index) => (
                <tr key={`${skill.skillName}-rank-${index + 1}`}>
                  <td
                    className={`${PROSE.td} font-body text-[11px] font-bold uppercase tracking-widest text-readout-muted`}
                  >
                    R{index + 1}
                  </td>
                  <td className={PROSE.td}>
                    <KeyworkHighlighter
                      text={line}
                      className="font-body text-[13px] leading-relaxed text-readout"
                      numberClassName={numberClassName}
                      glossary={{
                        ...mechanicGlossary,
                        ...buildSkillKeywordGlossary(skill, index),
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </ProseTable>
        ) : (
          <KeyworkHighlighter
            text={buildSingleDescription(skill)}
            className="font-body text-sm leading-relaxed text-readout"
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

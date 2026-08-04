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
 *  red = attack, purple = debuff/disable, green = heal/buff, amber = stance
 *  and ultimate. */
const SKILL_TYPE_ACCENT: Record<string, string> = {
  attack: "text-red-300",
  debuff: "text-purple-300",
  disable: "text-purple-300",
  heal: "text-emerald-300",
  cleanse: "text-emerald-300",
  buff: "text-emerald-300",
  stance: "text-amber-300",
  ultimate: "text-amber-300",
};

/**
 * One skill rendered as a document section rather than a bordered card:
 * a ruled heading, a metadata line (slot · type · mechanics), and a rank
 * table.
 *
 * The archive page previously stacked three prose sentences per skill inside
 * nested boxes, so telling R1 from R3 meant diffing paragraphs by eye. The
 * multiplier is real data (`damageRanked[i]`), so it gets its own column and
 * the rank delta is visible at a glance; the description keeps its full
 * keyword-highlighted wording beside it.
 */
export default function SkillDocument({
  skill,
  slot,
}: {
  skill: CharacterSkillData;
  /** "S1" / "S2" / "ULT" — the card slot this skill occupies. */
  slot: string;
}): ReactNode {
  const isUlt = skill.type === "ultimate";
  const rankedLines = isUlt ? null : buildRankedSkillDescriptions(skill);
  const multipliers = Array.isArray(skill.damageRanked)
    ? skill.damageRanked
    : null;
  const metaParts = [...new Set([skill.type, ...getMechanicTypes(skill)])]
    .filter((part) => !(isUlt && part === "ultimate"))
    .map(toTitleCase);
  const accent = SKILL_TYPE_ACCENT[skill.type] ?? "text-zinc-300";
  // Heal amounts read green, the 7DS convention.
  const numberClassName = skill.type === "heal" ? "font-semibold text-emerald-400" : undefined;

  return (
    <div className="mt-5 first:mt-0">
      <h3 className="flex flex-wrap items-baseline gap-x-2 border-l-2 border-zinc-700 pl-2.5 font-heading text-lg tracking-[0.06em] text-zinc-100">
        <span className={`font-body text-[10px] font-bold uppercase tracking-[0.16em] ${accent}`}>
          {slot}
        </span>
        {skill.skillName}
      </h3>

      {/* Type first, then mechanics — deduped, because a debuff skill carrying
          a `debuff` mechanic would otherwise read "Debuff · Debuff", and an
          ultimate's `ultimate` type just restates the ULT slot chip. */}
      {metaParts.length > 0 ? (
        <p className="mt-0.5 pl-3 font-body text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          {metaParts.join(" · ")}
        </p>
      ) : null}

      <div className="mt-1.5 pl-3">
        {rankedLines ? (
          <ProseTable>
            <thead>
              <tr>
                <th className={`${PROSE.th} w-10`}>Rank</th>
                {multipliers ? (
                  <th className={`${PROSE.th} w-16`}>Mult</th>
                ) : null}
                <th className={PROSE.th}>Effect</th>
              </tr>
            </thead>
            <tbody>
              {rankedLines.map((line, index) => (
                <tr key={`${skill.skillName}-rank-${index + 1}`}>
                  <td
                    className={`${PROSE.td} font-body text-[11px] font-bold uppercase tracking-widest text-zinc-500`}
                  >
                    R{index + 1}
                  </td>
                  {multipliers ? (
                    <td
                      className={`${PROSE.td} font-body text-[13px] font-semibold text-amber-200 tabular-nums`}
                    >
                      {multipliers[index] ? `${multipliers[index]}%` : "—"}
                    </td>
                  ) : null}
                  <td className={PROSE.td}>
                    <KeyworkHighlighter
                      text={line}
                      className="font-body text-[13px] leading-relaxed text-zinc-200"
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
            className="font-body text-sm leading-relaxed text-zinc-200"
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

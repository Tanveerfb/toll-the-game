"use client";

import React from "react";
import KeyworkHighlighter from "@/components/ui/KeyworkHighlighter";
import { Badge } from "@/components/ui/badge";
import { type CharacterSkillData } from "@/lib/game/characterCatalog";
import {
  buildRankedSkillDescriptions,
  buildSingleDescription,
  buildSkillKeywordGlossary,
  getMechanicTypes,
} from "@/lib/game/descriptionTranslator";
import { mechanicGlossary } from "@/lib/game/mechanicGlossary";
import { buildPassiveDetailSections } from "@/lib/game/passiveDetailSections";
import {
  extractKeywordFootnotes,
  formatFootnoteLabel,
  type KeywordFootnote,
} from "@/lib/game/keywordFootnotes";

// Kit rendering shared by the archive detail page and the in-battle info
// panel so a character reads identically in both. Fed raw kit data
// (getCharacterById(...)) rather than runtime battle objects, so the
// description translator sees the same shape everywhere. Art is intentionally
// omitted — the battle panel doesn't want it.

interface PassiveMechanicEntry {
  type?: string;
  name?: string;
  trigger?: string;
  triggerText?: string;
  description?: string;
  conditionTags?: string[];
  conditionColors?: string[];
  stat?: string;
  valuePercent?: number;
  conditionNoDeadAllies?: boolean;
  [key: string]: unknown;
}

export interface KitPassiveView {
  name?: string;
  trigger?: string;
  /** Display-only trigger override (e.g. "On turn 10") — the engine still keys
   *  off `trigger`. Use when the raw trigger doesn't read well for players. */
  triggerText?: string;
  description?: string;
  mechanics?: PassiveMechanicEntry[];
}

const UI = {
  fieldLabel: "font-body text-[10px] uppercase tracking-[0.16em] text-zinc-500",
  textValue: "font-body text-sm text-zinc-200",
} as const;

// red = attack, purple = debuff/disable, green = heal/buff, yellow = stance/ult
const SKILL_TYPE_CHIP: Record<string, string> = {
  attack: "bg-red-600 text-white",
  debuff: "bg-purple-600 text-white",
  disable: "bg-purple-600 text-white",
  heal: "bg-emerald-600 text-white",
  cleanse: "bg-emerald-600 text-white",
  buff: "bg-emerald-600 text-white",
  stance: "bg-amber-300 text-zinc-950",
  ultimate: "bg-amber-300 text-zinc-950",
};

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function MechanicsTags({ skill }: { skill: CharacterSkillData }): React.ReactNode {
  const types = getMechanicTypes(skill);
  if (types.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {types.map((type) => (
        <Badge
          key={`${skill.skillName}-${type}`}
          variant="secondary"
          className="rounded-none px-1.5 py-0 font-body text-[10px] uppercase tracking-widest text-zinc-200"
        >
          {toTitleCase(type)}
        </Badge>
      ))}
    </div>
  );
}

export function SkillBlock({
  skill,
  tag,
  onDetails,
}: {
  skill: CharacterSkillData;
  tag: string;
  /** Opens the shared DetailOverlay for this skill (spec §5 — used for the
   *  Super Attack row in the battle character-detail screen). Omitted
   *  everywhere else (archive, kit-phases, kit-lab) — no behavior change. */
  onDetails?: () => void;
}): React.ReactNode {
  const rankedLines =
    skill.type === "ultimate" ? null : buildRankedSkillDescriptions(skill);
  const chipClass = SKILL_TYPE_CHIP[skill.type] ?? "bg-zinc-700 text-zinc-200";
  // Heal skills show their recovery amount in green (7DS convention).
  const numberClassName =
    skill.type === "heal" ? "font-semibold text-emerald-400" : undefined;

  // Keyword footnotes (spec §5): one glossary line per highlighted term,
  // computed across every rank's wording (a term can appear at only one
  // rank) so nothing is missed, deduped by extractKeywordFootnotes.
  const footnoteGlossary = rankedLines
    ? rankedLines.reduce<Record<string, string>>(
        (acc, _line, index) => ({
          ...acc,
          ...buildSkillKeywordGlossary(skill, index),
        }),
        mechanicGlossary,
      )
    : { ...mechanicGlossary, ...buildSkillKeywordGlossary(skill, 0) };
  const footnoteText = rankedLines
    ? rankedLines.join(" ")
    : buildSingleDescription(skill);
  const footnotes = extractKeywordFootnotes(footnoteText, footnoteGlossary);

  return (
    <div className="border border-zinc-800 bg-zinc-950/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={`px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-widest ${chipClass}`}
          >
            {tag}
          </span>
          <p className="font-heading text-lg tracking-[0.05em] text-zinc-100">
            {skill.skillName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MechanicsTags skill={skill} />
          {onDetails ? (
            <button
              type="button"
              onClick={onDetails}
              className="shrink-0 border border-zinc-600 px-2 py-1 font-body text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-amber-300 hover:text-amber-200"
            >
              Details
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5 px-3 py-2.5">
        {rankedLines ? (
          rankedLines.map((line, index) => (
            <div
              key={`${skill.skillName}-rank-${index + 1}`}
              className="grid grid-cols-[44px_1fr] items-baseline gap-2"
            >
              <span className="font-body text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                R{index + 1}
              </span>
              <KeyworkHighlighter
                text={line}
                className={UI.textValue}
                numberClassName={numberClassName}
                glossary={{
                  ...mechanicGlossary,
                  ...buildSkillKeywordGlossary(skill, index),
                }}
              />
            </div>
          ))
        ) : (
          <KeyworkHighlighter
            text={buildSingleDescription(skill)}
            className={UI.textValue}
            numberClassName={numberClassName}
            glossary={{
              ...mechanicGlossary,
              ...buildSkillKeywordGlossary(skill, 0),
            }}
          />
        )}
        <FootnoteList footnotes={footnotes} />
      </div>
    </div>
  );
}

/** Shared "※ Term — meaning" glossary footnote list (spec §5). */
function FootnoteList({
  footnotes,
}: {
  footnotes: KeywordFootnote[];
}): React.ReactNode {
  if (footnotes.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-0.5 border-t border-zinc-800 pt-1.5">
      {footnotes.map((entry) => (
        <p key={entry.keyword} className="font-body text-xs text-zinc-400">
          <span className="mr-1 text-zinc-500">※</span>
          <span className="font-semibold text-sky-300">
            {formatFootnoteLabel(entry.keyword)}
          </span>
          <span className="text-zinc-300"> — {entry.meaning}</span>
        </p>
      ))}
    </div>
  );
}

function formatSynergyStat(stat?: string): string {
  if (!stat) return "stats";
  if (stat.toLowerCase() === "all") return "all stats";
  if (stat.toLowerCase() === "damagedealt") return "damage dealt";
  return stat.toUpperCase();
}

function getSynergyBlocks(passive?: KitPassiveView): string[] {
  if (!Array.isArray(passive?.mechanics)) return [];
  return passive.mechanics
    .filter((entry) => entry.type === "synergy")
    .map((entry) => {
      const tagText =
        Array.isArray(entry.conditionTags) && entry.conditionTags.length > 0
          ? entry.conditionTags.join(" and ")
          : Array.isArray(entry.conditionColors) &&
              entry.conditionColors.length > 0
            ? entry.conditionColors
                .map((color) => toTitleCase(color))
                .join(" and ")
            : "matched";
      const value =
        typeof entry.valuePercent === "number" ? entry.valuePercent : 0;
      const stat = formatSynergyStat(entry.stat);
      return `All ${tagText} allies gain +${value}% ${stat}.`;
    });
}

function PanelSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="border border-zinc-800 bg-black/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <h3 className="font-heading text-base tracking-[0.1em] text-zinc-100">
          {title}
        </h3>
        {subtitle}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function UncancellableBadge(): React.JSX.Element {
  return (
    <span className="rounded-sm border border-rose-500/60 px-1 py-px font-body text-[9px] font-bold uppercase tracking-wider text-rose-300">
      Uncancellable
    </span>
  );
}

/**
 * A passive rendered 7DS-style: flowing prose (trigger woven into the sentence,
 * no Trigger/Effect labels), blue mechanics + amber numbers + cyan
 * parenthetical notes via the highlighter, an "Uncancellable" badge when the
 * text says so, and any synergy mechanic appended. Paragraphs split on blank
 * lines; a `※`-prefixed line is a grey-italic clarifier. Shared by the battle
 * info panel and the archive.
 */
export function PassiveProse({
  passive,
  showName,
  onDetails,
}: {
  passive?: KitPassiveView;
  showName: boolean;
  /** Opens the shared DetailOverlay's categorized Passive Details view
   *  (spec §5). Omitted everywhere else — no behavior change there. */
  onDetails?: () => void;
}): React.JSX.Element {
  const description = passive?.description?.trim() || "To be added.";
  const uncancellable = /uncancellabl|cannot be cancel/i.test(description);
  const synergyBlocks = getSynergyBlocks(passive);
  const paragraphs = description
    .split(/\n{2,}|\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2">
      {(showName && passive?.name) || uncancellable || onDetails ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {showName && passive?.name ? (
              <p className="font-heading text-sm tracking-[0.08em] text-amber-200/90">
                {passive.name}
              </p>
            ) : null}
            {uncancellable ? <UncancellableBadge /> : null}
          </div>
          {onDetails ? (
            <button
              type="button"
              onClick={onDetails}
              className="shrink-0 border border-zinc-600 px-2 py-1 font-body text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-amber-300 hover:text-amber-200"
            >
              Details
            </button>
          ) : null}
        </div>
      ) : null}

      {paragraphs.map((para, index) =>
        para.startsWith("※") ? (
          <p
            key={`para-${index}`}
            className="font-body text-xs italic text-zinc-500"
          >
            {para}
          </p>
        ) : (
          <KeyworkHighlighter
            key={`para-${index}`}
            text={para}
            className={`${UI.textValue} block leading-relaxed`}
          />
        ),
      )}

      {synergyBlocks.length > 0 ? (
        <div className="mt-1 space-y-1 border-l-2 border-sky-500/40 pl-2.5">
          {synergyBlocks.map((line, index) => (
            <KeyworkHighlighter
              key={`synergy-${index}`}
              text={line}
              className="block font-body text-xs text-zinc-300"
            />
          ))}
        </div>
      ) : null}

      <FootnoteList footnotes={extractKeywordFootnotes(description)} />
    </div>
  );
}

/**
 * Skills + Ultimate + Passive(s), rendered identically to the archive (no art).
 * Pass `passives` for a multi-passive kit (bosses); `passive` is the legacy
 * single-passive prop. When both are absent the passive section shows the
 * "to be added" placeholder.
 */
export default function KitDetails({
  skills,
  ultimate,
  passive,
  passives,
  onUltimateDetails,
  onPassiveDetails,
}: {
  skills: CharacterSkillData[];
  ultimate?: CharacterSkillData;
  passive?: KitPassiveView;
  passives?: KitPassiveView[];
  /** Opens the shared DetailOverlay for the ultimate/"Super Attack" row
   *  (spec §5). Battle screen only — absent everywhere else. */
  onUltimateDetails?: (ultimate: CharacterSkillData) => void;
  /** Opens the shared DetailOverlay's categorized Passive Details view for
   *  this passive (spec §5). Battle screen only — absent everywhere else. */
  onPassiveDetails?: (passive: KitPassiveView) => void;
}): React.JSX.Element {
  const passiveList = passives ?? (passive ? [passive] : []);
  const multi = passiveList.length > 1;
  const subtitleName = !multi ? passiveList[0]?.name : undefined;

  return (
    <div className="space-y-3">
      <PanelSection title="Skills">
        <div className="space-y-2.5">
          {skills.map((skill, index) => (
            <SkillBlock
              key={skill.skillName}
              skill={skill}
              tag={`S${index + 1}`}
            />
          ))}
          {ultimate ? (
            <SkillBlock
              skill={ultimate}
              tag="ULT"
              onDetails={
                onUltimateDetails ? () => onUltimateDetails(ultimate) : undefined
              }
            />
          ) : null}
        </div>
      </PanelSection>

      <PanelSection
        title={multi ? "Passives" : "Passive"}
        subtitle={
          subtitleName ? (
            <span className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
              {subtitleName}
            </span>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {passiveList.length === 0 ? (
            <PassiveProse passive={undefined} showName={false} />
          ) : (
            passiveList.map((p, index) => (
              <PassiveProse
                key={`passive-${p.name ?? index}`}
                passive={p}
                showName={multi}
                onDetails={
                  onPassiveDetails ? () => onPassiveDetails(p) : undefined
                }
              />
            ))
          )}
        </div>
      </PanelSection>
    </div>
  );
}

/**
 * Passive Details content (spec §5): categorized condition headers, each
 * followed by a bulleted effect list — rendered inside the shared
 * DetailOverlay. Pure grouping logic lives in lib/game/passiveDetailSections.
 */
export function PassiveDetailSections({
  passive,
}: {
  passive: KitPassiveView;
}): React.JSX.Element {
  const sections = buildPassiveDetailSections(passive);
  return (
    <div className="space-y-4">
      {passive.name ? (
        <p className="font-heading text-sm tracking-[0.08em] text-amber-200/90">
          {passive.name}
        </p>
      ) : null}
      {sections.map((section) => (
        <div key={section.header}>
          <h4 className="mb-1.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200/80">
            {section.header}
          </h4>
          <ul className="space-y-1 border-l-2 border-zinc-700 pl-3">
            {section.bullets.map((bullet, index) => (
              <li key={index} className="list-none">
                <KeyworkHighlighter
                  text={bullet}
                  className={`${UI.textValue} block leading-relaxed`}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

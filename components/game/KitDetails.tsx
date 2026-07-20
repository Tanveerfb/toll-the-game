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
  description?: string;
  mechanics?: PassiveMechanicEntry[];
}

const UI = {
  fieldLabel: "font-body text-[10px] uppercase tracking-[0.16em] text-zinc-500",
  textValue: "font-body text-sm text-zinc-200",
} as const;

const TRIGGER_EXPLANATIONS: Record<string, string> = {
  afterSkill: "After each skill used by this character",
  onIgniteConsume:
    "After a certain number of ignites consumed by this character",
  beforeSkill: "Before this character uses a skill",
  onBattleStart: "At the start of battle",
  onFirstAction: "When this character acts first in a turn",
  onLethalDamage: "When this character receives lethal damage",
  onDamageDealt: "When this character deals damage",
  onAllySkill: "When an ally uses a skill",
  aura: "While this character remains active",
};

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
}: {
  skill: CharacterSkillData;
  tag: string;
}): React.ReactNode {
  const rankedLines =
    skill.type === "ultimate" ? null : buildRankedSkillDescriptions(skill);
  const chipClass = SKILL_TYPE_CHIP[skill.type] ?? "bg-zinc-700 text-zinc-200";

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
        <MechanicsTags skill={skill} />
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

function getPassiveBlocks(passive?: KitPassiveView): Array<{
  trigger: string;
  description: string;
  isConditional?: boolean;
}> {
  if (!passive) {
    return [{ trigger: "To be added", description: "To be added" }];
  }

  const mechanicBlocks = Array.isArray(passive.mechanics)
    ? passive.mechanics
        .filter(
          (entry) =>
            typeof entry === "object" &&
            entry !== null &&
            entry.type !== "synergy" &&
            typeof entry.description === "string" &&
            entry.description.trim().length > 0,
        )
        .map((entry) => {
          const rawTrigger =
            (typeof entry.triggerText === "string" && entry.triggerText) ||
            (typeof entry.trigger === "string" &&
              (TRIGGER_EXPLANATIONS[entry.trigger] ??
                `When ${toTitleCase(entry.trigger)}`));
          const rawType =
            typeof entry.type === "string" ? entry.type.toLowerCase() : "";
          return {
            trigger: rawTrigger || "When passive condition is met",
            description: entry.description!.trim(),
            isConditional: rawType.includes("conditional"),
          };
        })
    : [];

  if (mechanicBlocks.length > 0) return mechanicBlocks;

  const noDeadAlliesCondition = Array.isArray(passive.mechanics)
    ? passive.mechanics.some((entry) => entry.conditionNoDeadAllies === true)
    : false;
  const trigger = noDeadAlliesCondition
    ? "Always when there are no dead allies"
    : passive.trigger
      ? (TRIGGER_EXPLANATIONS[passive.trigger] ??
        `When ${toTitleCase(passive.trigger)}`)
      : "To be added";
  const description = passive.description?.trim() || "To be added";
  return [{ trigger, description }];
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

/** One passive's blocks + synergy, with its name header. Bosses stack several. */
function PassiveEntry({
  passive,
  showName,
}: {
  passive?: KitPassiveView;
  showName: boolean;
}): React.JSX.Element {
  const passiveBlocks = getPassiveBlocks(passive);
  const synergyBlocks = getSynergyBlocks(passive);

  return (
    <div className="space-y-2.5">
      {showName && passive?.name ? (
        <p className="font-heading text-sm tracking-[0.08em] text-amber-200/90">
          {passive.name}
        </p>
      ) : null}
      {passiveBlocks.map((block, index) => (
        <div
          key={`passive-block-${index}`}
          className={`border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 ${block.isConditional ? "ml-4 border-l-2 border-l-amber-400/50" : ""}`}
        >
          <p className={UI.fieldLabel}>
            {block.isConditional ? "Conditional — " : ""}Trigger
          </p>
          <KeyworkHighlighter text={block.trigger} className={UI.textValue} />
          <p className={`${UI.fieldLabel} mt-2`}>Effect</p>
          <KeyworkHighlighter
            text={block.description}
            className={UI.textValue}
          />
        </div>
      ))}

      {synergyBlocks.length > 0 ? (
        <div className="border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
          <p className={UI.fieldLabel}>Synergy</p>
          <div className="mt-1 space-y-1">
            {synergyBlocks.map((line, index) => (
              <KeyworkHighlighter
                key={`synergy-${index}`}
                text={line}
                className={`${UI.textValue} block`}
              />
            ))}
          </div>
        </div>
      ) : null}
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
}: {
  skills: CharacterSkillData[];
  ultimate?: CharacterSkillData;
  passive?: KitPassiveView;
  passives?: KitPassiveView[];
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
          {ultimate ? <SkillBlock skill={ultimate} tag="ULT" /> : null}
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
        <div className="space-y-3">
          {passiveList.length === 0 ? (
            <PassiveEntry passive={undefined} showName={false} />
          ) : (
            passiveList.map((p, index) => (
              <PassiveEntry
                key={`passive-${p.name ?? index}`}
                passive={p}
                showName={multi}
              />
            ))
          )}
        </div>
      </PanelSection>
    </div>
  );
}

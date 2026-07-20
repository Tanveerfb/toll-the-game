import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import KeyworkHighlighter from "@/components/ui/KeyworkHighlighter";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  characterIds,
  getCharacterById,
  getCharacterPhases,
  type CharacterSkillData,
} from "@/lib/game/characterCatalog";
import KitPhases from "@/components/game/KitPhases";
import {
  buildRankedSkillDescriptions,
  buildSingleDescription,
  buildSkillKeywordGlossary,
  getMechanicTypes,
} from "@/lib/game/descriptionTranslator";
import { mechanicGlossary } from "@/lib/game/mechanicGlossary";
import {
  buildCharacterDamagePreview,
  DAMAGE_PREVIEW_DUMMY,
} from "@/lib/game/damagePreview";
import { getCharacterArt } from "@/lib/game/characterArt";

interface CharacterPageProps {
  params: Promise<{ id: string }>;
}

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

interface CharacterPassiveView {
  name?: string;
  trigger?: string;
  /** Display-only trigger override; engine still keys off `trigger`. */
  triggerText?: string;
  description?: string;
  mechanics?: PassiveMechanicEntry[];
}

const UI = {
  fieldLabel:
    "font-body text-[10px] uppercase tracking-[0.16em] text-zinc-500",
  textValue: "font-body text-sm text-zinc-200",
} as const;

const COLOR_STYLES: Record<
  string,
  { frame: string; gradient: string; chip: string }
> = {
  light: {
    frame: "border-amber-200/70",
    gradient: "from-amber-200/25 to-transparent",
    chip: "bg-amber-200 text-zinc-900",
  },
  red: {
    frame: "border-red-500/70",
    gradient: "from-red-600/30 to-transparent",
    chip: "bg-red-500 text-zinc-950",
  },
  blue: {
    frame: "border-sky-500/70",
    gradient: "from-sky-600/30 to-transparent",
    chip: "bg-sky-500 text-zinc-950",
  },
  green: {
    frame: "border-emerald-500/70",
    gradient: "from-emerald-600/30 to-transparent",
    chip: "bg-emerald-500 text-zinc-950",
  },
  dark: {
    frame: "border-violet-500/70",
    gradient: "from-violet-600/30 to-transparent",
    chip: "bg-violet-500 text-zinc-950",
  },
};

const TRIGGER_EXPLANATIONS: Record<string, string> = {
  always: "Always",
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

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function Section({
  title,
  children,
  subtitle,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="border-2 border-zinc-800 bg-black/45">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
        <h2 className="font-heading text-xl tracking-[0.1em] text-zinc-100">
          {title}
        </h2>
        {subtitle}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function MechanicsTags({ skill }: { skill: CharacterSkillData }): ReactNode {
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

// Skill tag chips follow the effect-pill color scheme: red = attack,
// purple = debuff/disable, green = heal/buff, yellow = stance/ultimate.
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

function SkillBlock({
  skill,
  tag,
}: {
  skill: CharacterSkillData;
  tag: string;
}): ReactNode {
  const rankedLines =
    skill.type === "ultimate" ? null : buildRankedSkillDescriptions(skill);
  const chipClass =
    SKILL_TYPE_CHIP[skill.type] ?? "bg-zinc-700 text-zinc-200";

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

function getPassiveBlocks(passive?: CharacterPassiveView): Array<{
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

  if (mechanicBlocks.length > 0) {
    return mechanicBlocks;
  }

  const noDeadAlliesCondition = Array.isArray(passive.mechanics)
    ? passive.mechanics.some((entry) => entry.conditionNoDeadAllies === true)
    : false;

  const trigger = passive.triggerText?.trim()
    ? passive.triggerText.trim()
    : noDeadAlliesCondition
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

function getSynergyBlocks(passive?: CharacterPassiveView): string[] {
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

export function generateStaticParams(): Array<{ id: string }> {
  return characterIds.map((id) => ({ id }));
}

export default async function CharacterDetailPage({
  params,
}: CharacterPageProps): Promise<ReactNode> {
  const { id } = await params;
  const character = getCharacterById(id);

  if (!character) {
    notFound();
  }

  const style = COLOR_STYLES[character.color] ?? COLOR_STYLES.light;
  const passive = character.passive as CharacterPassiveView | undefined;
  const passiveBlocks = getPassiveBlocks(passive);
  const synergyBlocks = getSynergyBlocks(passive);
  const previewRows = buildCharacterDamagePreview(character);
  // Multi-phase kits (bosses, and later playable transformations) get a phase
  // switcher instead of the flat Skills + Passive sections.
  const isMultiPhase = getCharacterPhases(character).length > 1;

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-zinc-950"
      style={{
        backgroundImage:
          "radial-gradient(70% 45% at 90% 0%, rgba(56,189,248,0.15), transparent 75%), radial-gradient(65% 45% at 0% 100%, rgba(245,158,11,0.18), transparent 72%), linear-gradient(155deg, #09090b 0%, #0f172a 52%, #0a0a0a 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[38px_38px] opacity-25" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
        <Link
          href="/archive"
          className="font-body text-xs uppercase tracking-[0.16em] text-zinc-400 hover:text-amber-200"
        >
          ← Character Archive
        </Link>

        <div className="mt-3 grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* Identity panel */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className={`border-2 ${style.frame} bg-zinc-950/85`}>
              <div
                className={`relative flex aspect-square items-center justify-center overflow-hidden bg-linear-to-b ${style.gradient}`}
              >
                {getCharacterArt(character.id) ? (
                  <Image
                    src={getCharacterArt(character.id)!}
                    alt={character.name}
                    width={1024}
                    height={1024}
                    priority
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-heading text-8xl text-white/85 drop-shadow-[0_0_16px_rgba(255,255,255,0.25)]">
                    {character.name.charAt(0)}
                  </span>
                )}
                <span
                  className={`absolute left-2 top-2 px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-widest ${style.chip}`}
                >
                  {character.color}
                </span>
              </div>

              <div className="border-t border-zinc-800 px-4 py-3">
                <h1 className="font-heading text-4xl tracking-[0.08em] text-zinc-100">
                  {character.name}
                </h1>
                <p className="font-body text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {character.id}
                </p>
                {Array.isArray(character.tags) && character.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {character.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="rounded-none border-zinc-600 px-1.5 py-0 font-body text-[10px] uppercase tracking-widest text-zinc-300"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-3 border-t border-zinc-800 text-center">
                {(
                  [
                    ["ATK", character.atk],
                    ["DEF", character.def],
                    ["HP", character.hp],
                  ] as const
                ).map(([label, value], i) => (
                  <div
                    key={label}
                    className={`py-2.5 ${i > 0 ? "border-l border-zinc-800" : ""}`}
                  >
                    <p className={UI.fieldLabel}>{label}</p>
                    <p className="font-heading text-2xl text-zinc-100">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {character.lore ? (
              <div className="border-2 border-zinc-800 bg-black/45 px-4 py-3">
                <p className={UI.fieldLabel}>Lore</p>
                <p className="mt-1 font-body text-sm leading-relaxed text-zinc-300">
                  {character.lore}
                </p>
              </div>
            ) : null}
          </aside>

          {/* Kit details */}
          <div className="space-y-4">
            {isMultiPhase ? (
              <Section title="Kit">
                <KitPhases character={character} />
              </Section>
            ) : (
              <>
            <Section title="Skills">
              <div className="space-y-3">
                {character.skills.map((skill, index) => (
                  <SkillBlock
                    key={skill.skillName}
                    skill={skill}
                    tag={`S${index + 1}`}
                  />
                ))}
                {character.ultimate ? (
                  <SkillBlock skill={character.ultimate} tag="ULT" />
                ) : null}
              </div>
            </Section>

            <Section
              title="Passive"
              subtitle={
                passive?.name ? (
                  <span className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                    {passive.name}
                  </span>
                ) : undefined
              }
            >
              <div className="space-y-3">
                {passiveBlocks.map((block, index) => (
                  <div
                    key={`passive-block-${index}`}
                    className={`border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 ${block.isConditional ? "ml-4 border-l-2 border-l-amber-400/50" : ""}`}
                  >
                    <p className={UI.fieldLabel}>
                      {block.isConditional ? "Conditional — " : ""}
                      Trigger
                    </p>
                    <KeyworkHighlighter
                      text={block.trigger}
                      className={UI.textValue}
                    />
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
            </Section>
              </>
            )}

            <Section
              title="Damage Preview"
              subtitle={
                <span className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
                  vs dummy: {DAMAGE_PREVIEW_DUMMY.atk} ATK /{" "}
                  {DAMAGE_PREVIEW_DUMMY.def} DEF / {DAMAGE_PREVIEW_DUMMY.hp} HP
                </span>
              }
            >
              <div className="border border-zinc-800">
                <Table className="text-zinc-200">
                  <TableHeader className="bg-zinc-900/60">
                    <TableRow>
                      <TableHead className="text-zinc-500">Ability</TableHead>
                      <TableHead className="text-zinc-500">Tier</TableHead>
                      <TableHead className="text-zinc-500">Mult</TableHead>
                      <TableHead className="text-zinc-500">Scenario</TableHead>
                      <TableHead className="text-zinc-500">Result</TableHead>
                      <TableHead className="text-zinc-500">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="align-top font-heading text-sm tracking-wider text-zinc-100">
                          {row.abilityName}
                        </TableCell>
                        <TableCell className="align-top font-body text-sm">
                          {row.rankLabel}
                        </TableCell>
                        <TableCell className="align-top font-body text-sm">
                          {row.multiplierLabel}
                        </TableCell>
                        <TableCell className="align-top font-body text-sm">
                          {row.scenarioLabel}
                        </TableCell>
                        <TableCell className="align-top font-body text-sm font-semibold text-amber-200">
                          {row.resultLabel}
                        </TableCell>
                        <TableCell className="max-w-70 align-top whitespace-normal">
                          <KeyworkHighlighter
                            text={row.notes || "No additional modifiers."}
                            className="font-body text-xs leading-5 text-zinc-400"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}

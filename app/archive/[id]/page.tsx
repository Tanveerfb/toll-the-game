import { Card, Chip, Table } from "@heroui/react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import KeyworkHighlighter from "@/components/ui/KeyworkHighlighter";
import {
  characterIds,
  getCharacterById,
  type CharacterSkillData,
} from "@/lib/game/characterCatalog";
import {
  buildRankedSkillDescriptions,
  buildSingleDescription,
  getMechanicTypes,
} from "@/lib/game/descriptionTranslator";
import {
  buildCharacterDamagePreview,
  DAMAGE_PREVIEW_DUMMY,
} from "@/lib/game/damagePreview";

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
  trigger?: string;
  description?: string;
  mechanics?: PassiveMechanicEntry[];
}

const UI = {
  fieldLabel: "font-body text-xs uppercase tracking-[0.14em] text-muted",
  textValue: "font-body text-sm text-foreground",
  statValue: "font-heading text-3xl text-foreground",
  sectionTitle: "font-heading text-2xl tracking-[0.08em] text-foreground",
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

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function MechanicsTags({ skill }: { skill: CharacterSkillData }): ReactNode {
  const types = getMechanicTypes(skill);

  if (types.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {types.map((type) => (
        <Chip
          key={`${skill.skillName}-${type}`}
          variant="secondary"
          className="rounded-none"
        >
          <Chip.Label className="text-foreground">
            {toTitleCase(type)}
          </Chip.Label>
        </Chip>
      ))}
    </div>
  );
}

function SkillRanksSection({
  skills,
}: {
  skills: CharacterSkillData[];
}): ReactNode {
  return (
    <Card
      variant="secondary"
      className="rounded-none border border-border bg-surface-secondary"
    >
      <Card.Header className="border-b border-border px-5 py-4">
        <Card.Title className="font-heading text-2xl tracking-[0.08em] text-foreground">
          Skills
        </Card.Title>
      </Card.Header>
      <Card.Content className="space-y-4 p-5">
        {skills.map((skill) => {
          const rankedLines = buildRankedSkillDescriptions(skill);

          return (
            <Card
              key={skill.skillName}
              variant="secondary"
              className="rounded-none border border-border bg-surface"
            >
              <Card.Content className="space-y-3 p-4">
                <p className="font-heading text-xl tracking-[0.06em] text-foreground">
                  {skill.skillName}
                </p>

                <MechanicsTags skill={skill} />

                <div className="space-y-2">
                  {rankedLines.map((line, index) => (
                    <p
                      key={`${skill.skillName}-rank-${index + 1}`}
                      className={UI.textValue}
                    >
                      <span className="mr-2 font-semibold text-foreground">
                        Rank {index + 1} -
                      </span>
                      <KeyworkHighlighter
                        text={line}
                        className={UI.textValue}
                      />
                    </p>
                  ))}
                </div>
              </Card.Content>
            </Card>
          );
        })}
      </Card.Content>
    </Card>
  );
}

function UltimateSection({
  ultimate,
}: {
  ultimate?: CharacterSkillData;
}): ReactNode {
  return (
    <Card
      variant="secondary"
      className="rounded-none border border-border bg-surface-secondary"
    >
      <Card.Header className="border-b border-border px-5 py-4">
        <Card.Title className={UI.sectionTitle}>Ultimate</Card.Title>
      </Card.Header>

      <Card.Content className="space-y-3 p-5">
        {!ultimate ? (
          <p className={UI.textValue}>To be added</p>
        ) : (
          <Card
            variant="secondary"
            className="rounded-none border border-border bg-surface"
          >
            <Card.Content className="space-y-3 p-4">
              <p className="font-heading text-xl tracking-[0.06em] text-foreground">
                {ultimate.skillName}
              </p>
              <MechanicsTags skill={ultimate} />
              <p className={UI.textValue}>
                <KeyworkHighlighter
                  text={buildSingleDescription(ultimate)}
                  className={UI.textValue}
                />
              </p>
            </Card.Content>
          </Card>
        )}
      </Card.Content>
    </Card>
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
  if (!stat) {
    return "stats";
  }

  if (stat.toLowerCase() === "all") {
    return "all stats";
  }

  if (stat.toLowerCase() === "damagedealt") {
    return "damage dealt";
  }

  return stat.toUpperCase();
}

function getSynergyBlocks(passive?: CharacterPassiveView): string[] {
  if (!Array.isArray(passive?.mechanics)) {
    return [];
  }

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

function PassiveSection({
  passive,
}: {
  passive?: CharacterPassiveView;
}): ReactNode {
  const passiveBlocks = getPassiveBlocks(passive);
  const synergyBlocks = getSynergyBlocks(passive);

  return (
    <Card
      variant="secondary"
      className="rounded-none border border-border bg-surface-secondary"
    >
      <Card.Header className="border-b border-border px-5 py-4">
        <Card.Title className={UI.sectionTitle}>Passive</Card.Title>
      </Card.Header>

      <Card.Content className="p-5">
        <Card
          variant="secondary"
          className="rounded-none border border-border bg-surface"
        >
          <Card.Content className="space-y-4 p-4">
            {passiveBlocks.map((block, index) => (
              <div
                key={`passive-block-${index}`}
                className={
                  block.isConditional
                    ? "ml-4 border-l border-border pl-4"
                    : index > 0
                      ? "border-t border-border pt-4"
                      : ""
                }
              >
                {block.isConditional ? (
                  <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                    if condition met {"{"}
                  </p>
                ) : null}

                <p className={UI.fieldLabel}>Trigger Condition</p>
                <p className={UI.textValue}>
                  <KeyworkHighlighter
                    text={block.trigger}
                    className={UI.textValue}
                  />
                </p>

                <p className={`${UI.fieldLabel} mt-3`}>Description</p>
                <p className={UI.textValue}>
                  <KeyworkHighlighter
                    text={block.description}
                    className={UI.textValue}
                  />
                </p>

                {block.isConditional ? (
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                    {"}"}
                  </p>
                ) : null}
              </div>
            ))}

            {synergyBlocks.length > 0 ? (
              <div className="border-t border-border pt-4">
                <p className={UI.fieldLabel}>Synergy</p>

                <div className="mt-3 space-y-2">
                  {synergyBlocks.map((synergyLine, index) => (
                    <p key={`synergy-${index}`} className={UI.textValue}>
                      <KeyworkHighlighter
                        text={synergyLine}
                        className={UI.textValue}
                      />
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </Card.Content>
        </Card>
      </Card.Content>
    </Card>
  );
}

function DamagePreviewSection({
  character,
}: {
  character: ReturnType<typeof getCharacterById> extends infer T
    ? Exclude<T, undefined>
    : never;
}): ReactNode {
  const previewRows = buildCharacterDamagePreview(character);

  return (
    <Card
      variant="secondary"
      className="rounded-none border border-border bg-surface-secondary"
    >
      <Card.Header className="border-b border-border px-5 py-4">
        <Card.Title className={UI.sectionTitle}>Damage Preview</Card.Title>
        <Card.Description className="mt-2 font-body text-sm text-muted">
          Dummy enemy baseline: {DAMAGE_PREVIEW_DUMMY.atk} ATK /{" "}
          {DAMAGE_PREVIEW_DUMMY.def} DEF / {DAMAGE_PREVIEW_DUMMY.hp} HP.
        </Card.Description>
      </Card.Header>

      <Card.Content className="space-y-4 p-5">
        <p className={UI.textValue}>
          This table uses each character&apos;s current skill multipliers,
          passive hooks, and mechanic-specific scenarios to show sample output.
        </p>

        <Table
          variant="secondary"
          className="rounded-none border border-border"
        >
          <Table.ScrollContainer>
            <Table.Content
              aria-label={`${character.name} damage preview`}
              className="min-w-245 text-foreground"
            >
              <Table.Header className="bg-surface">
                <Table.Column isRowHeader className="text-muted">
                  Ability
                </Table.Column>
                <Table.Column className="text-muted">Tier</Table.Column>
                <Table.Column className="text-muted">Multiplier</Table.Column>
                <Table.Column className="text-muted">Scenario</Table.Column>
                <Table.Column className="text-muted">Result</Table.Column>
                <Table.Column className="text-muted">Notes</Table.Column>
              </Table.Header>

              <Table.Body>
                {previewRows.map((row) => (
                  <Table.Row key={row.id} id={row.id}>
                    <Table.Cell className="align-top font-heading text-sm tracking-wider text-foreground">
                      {row.abilityName}
                    </Table.Cell>
                    <Table.Cell className="align-top font-body text-sm text-foreground">
                      {row.rankLabel}
                    </Table.Cell>
                    <Table.Cell className="align-top font-body text-sm text-foreground">
                      {row.multiplierLabel}
                    </Table.Cell>
                    <Table.Cell className="align-top font-body text-sm text-foreground">
                      {row.scenarioLabel}
                    </Table.Cell>
                    <Table.Cell className="align-top font-body text-sm font-semibold text-foreground">
                      {row.resultLabel}
                    </Table.Cell>
                    <Table.Cell className="align-top">
                      <KeyworkHighlighter
                        text={row.notes || "No additional modifiers."}
                        className={`${UI.textValue} leading-6`}
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Card.Content>
    </Card>
  );
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

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-zinc-950"
      style={{
        backgroundImage:
          "radial-gradient(70% 45% at 90% 0%, rgba(56,189,248,0.15), transparent 75%), radial-gradient(65% 45% at 0% 100%, rgba(245,158,11,0.18), transparent 72%), linear-gradient(155deg, #09090b 0%, #0f172a 52%, #0a0a0a 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[38px_38px] opacity-25" />

      <section className="relative z-10 mx-auto w-full max-w-6xl space-y-6 px-6 py-8 md:px-10 md:py-10">
        <Card
          variant="tertiary"
          className="rounded-none border-2 border-border bg-surface"
        >
          <Card.Header className="border-b border-border px-6 py-6">
            <p className={UI.fieldLabel}>Name</p>
            <Card.Title className="mt-1 font-heading text-5xl tracking-[0.12em] text-foreground md:text-6xl">
              {character.name}
            </Card.Title>
            <Card.Description className="mt-1 font-body text-sm uppercase tracking-[0.16em] text-muted">
              {character.id}
            </Card.Description>
          </Card.Header>

          <Card.Content className="space-y-6 p-6">
            <div>
              <Card
                variant="secondary"
                className="rounded-none border border-border bg-surface-secondary"
              >
                <Card.Header className="border-b border-border px-5 py-4">
                  <Card.Title className={UI.sectionTitle}>Stats</Card.Title>
                </Card.Header>
                <Card.Content className="grid grid-cols-3 gap-4 p-5 text-center">
                  <div>
                    <p className={UI.fieldLabel}>ATK</p>
                    <p className={UI.statValue}>{character.atk}</p>
                  </div>
                  <div>
                    <p className={UI.fieldLabel}>DEF</p>
                    <p className={UI.statValue}>{character.def}</p>
                  </div>
                  <div>
                    <p className={UI.fieldLabel}>HP</p>
                    <p className={UI.statValue}>{character.hp}</p>
                  </div>
                </Card.Content>
              </Card>
            </div>

            <Card
              variant="secondary"
              className="rounded-none border border-border bg-surface-secondary"
            >
              <Card.Header className="border-b border-border px-5 py-4">
                <Card.Title className={UI.sectionTitle}>Overview</Card.Title>
              </Card.Header>

              <Card.Content className="p-5">
                <p className={UI.textValue}>
                  <KeyworkHighlighter
                    text={character.lore?.trim() || "To be added"}
                    className={UI.textValue}
                  />
                </p>
              </Card.Content>
            </Card>

            <SkillRanksSection skills={character.skills} />
            <UltimateSection ultimate={character.ultimate} />
            <PassiveSection passive={character.passive} />
            <DamagePreviewSection character={character} />
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}

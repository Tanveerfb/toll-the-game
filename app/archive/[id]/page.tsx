import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import KeyworkHighlighter from "@/components/ui/KeyworkHighlighter";
import { Badge } from "@/components/ui/badge";
import { PROSE, ProseSection, ProseTable } from "@/components/ui/prose";
import SkillDocument from "@/components/game/SkillDocument";
import {
  characterIds,
  getCharacterById,
  getCharacterPhases,
} from "@/lib/game/characterCatalog";
import KitPhases from "@/components/game/KitPhases";
import PreviewButton from "@/components/game/PreviewButton";
import CharacterProgressionPanel from "@/components/game/CharacterProgressionPanel";
import { PassiveProse, type KitPassiveView } from "@/components/game/KitDetails";
import {
  buildCharacterDamagePreview,
  DAMAGE_PREVIEW_DUMMY,
} from "@/lib/game/damagePreview";
import { getCharacterArt } from "@/lib/game/characterArt";

interface CharacterPageProps {
  params: Promise<{ id: string }>;
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
  const passive = character.passive as KitPassiveView | undefined;
  // Multi-phase kits return rows tagged with their phase; group them so each
  // phase gets its own table rather than one undifferentiated list.
  const previewRows = buildCharacterDamagePreview(character);
  const previewGroups: Array<{
    phaseLabel?: string;
    rows: typeof previewRows;
  }> = [];
  for (const row of previewRows) {
    const last = previewGroups[previewGroups.length - 1];
    if (last && last.phaseLabel === row.phaseLabel) last.rows.push(row);
    else previewGroups.push({ phaseLabel: row.phaseLabel, rows: [row] });
  }
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

            <PreviewButton characterId={character.id} />
            {/* Growth is ownership-gated and modal — story-only NPC kits have
                no progression, and an unowned character gets a one-line note
                instead of controls. */}
            <CharacterProgressionPanel
              characterId={character.id}
              storyOnly={character.storyOnly === true}
            />

            {character.lore ? (
              <div className="border-2 border-zinc-800 bg-black/45 px-4 py-3">
                <p className={UI.fieldLabel}>Lore</p>
                <p className="mt-1 font-body text-sm leading-relaxed text-zinc-300">
                  {character.lore}
                </p>
              </div>
            ) : null}
          </aside>

          {/* Kit details — a document, not a stack of cards. Same typography
              as /news via components/ui/prose.tsx. */}
          <div className="border-2 border-zinc-800 bg-black/45 px-4 pb-5 pt-1 md:px-6">
            {isMultiPhase ? (
              <ProseSection title="Kit">
                <KitPhases character={character} variant="document" />
              </ProseSection>
            ) : (
              <>
                <ProseSection title="Skills">
                  {character.skills.map((skill, index) => (
                    <SkillDocument
                      key={skill.skillName}
                      skill={skill}
                      slot={`S${index + 1}`}
                    />
                  ))}
                  {character.ultimate ? (
                    <SkillDocument skill={character.ultimate} slot="ULT" />
                  ) : null}
                </ProseSection>

                <ProseSection title="Passive" note={passive?.name}>
                  <PassiveProse passive={passive} showName={false} />
                </ProseSection>
              </>
            )}

            <ProseSection
              title="Kit Preview"
              note={`vs dummy: ${DAMAGE_PREVIEW_DUMMY.atk} ATK / ${DAMAGE_PREVIEW_DUMMY.def} DEF / ${DAMAGE_PREVIEW_DUMMY.hp} HP`}
            >
              {previewGroups.map(({ phaseLabel, rows }) => (
                <div key={phaseLabel ?? "base"}>
                  {phaseLabel ? (
                    <h3 className={PROSE.h3}>{phaseLabel}</h3>
                  ) : null}
                  <ProseTable>
                    <thead>
                      <tr>
                        <th className={PROSE.th}>Ability</th>
                        <th className={PROSE.th}>Tier</th>
                        <th className={PROSE.th}>Mult</th>
                        <th className={PROSE.th}>Scenario</th>
                        <th className={PROSE.th}>Result</th>
                        <th className={PROSE.th}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td
                            className={`${PROSE.td} font-heading text-sm tracking-wider text-zinc-100`}
                          >
                            {row.abilityName}
                          </td>
                          <td className={PROSE.td}>{row.rankLabel}</td>
                          <td className={PROSE.td}>{row.multiplierLabel}</td>
                          <td className={PROSE.td}>{row.scenarioLabel}</td>
                          <td
                            className={`${PROSE.td} font-semibold text-amber-200`}
                          >
                            <KeyworkHighlighter
                              text={row.resultLabel}
                              className="font-body text-[13px] font-semibold text-amber-200"
                            />
                          </td>
                          <td className={`${PROSE.td} max-w-70 whitespace-normal`}>
                            <KeyworkHighlighter
                              text={row.notes || "—"}
                              className="font-body text-xs leading-5 text-zinc-400"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </ProseTable>
                </div>
              ))}
            </ProseSection>
          </div>
        </div>
      </div>
    </main>
  );
}

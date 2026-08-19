import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import KeyworkHighlighter from "@/components/ui/KeyworkHighlighter";
import { PROSE, ProseSection, ProseTable } from "@/components/ui/prose";
import SkillDocument from "@/components/game/SkillDocument";
import {
  characterIds,
  getCharacterById,
  getCharacterPhases,
  getPlayableCharacters,
} from "@/lib/game/characterCatalog";
import KitPhases from "@/components/game/KitPhases";
import PreviewButton from "@/components/game/PreviewButton";
import CharacterProgressionPanel from "@/components/game/CharacterProgressionPanel";
import UltimateDocument from "@/components/game/UltimateDocument";
import CharacterStatBars from "@/components/game/CharacterStatBars";
import { PassiveProse, type KitPassiveView } from "@/components/game/KitDetails";
import {
  buildCharacterDamagePreview,
  DAMAGE_PREVIEW_DUMMY,
} from "@/lib/game/damagePreview";
import { getCharacterArt } from "@/lib/game/characterArt";

interface CharacterPageProps {
  params: Promise<{ id: string }>;
}

const EL_HUE: Record<string, string> = {
  light: "var(--color-el-light)",
  red: "var(--color-el-red)",
  blue: "var(--color-el-blue)",
  green: "var(--color-el-green)",
  dark: "var(--color-el-dark)",
};
const EL_CODE: Record<string, string> = {
  light: "LGT",
  red: "RED",
  blue: "BLU",
  green: "GRN",
  dark: "DRK",
};

// Stat bars read against the playable roster's peak, not against this
// character — a 245 ATK bar meaning "middling attacker" is the thing a raw
// number never told you. NPC/boss kits sit above the playable ceiling, so the
// fill clamps at 100% and their bar honestly reads as off the scale.
const ROSTER_PEAK = (() => {
  const roster = getPlayableCharacters();
  const peak = (pick: (c: (typeof roster)[number]) => number) =>
    Math.max(1, ...roster.map(pick));
  return {
    hp: peak((c) => c.hp),
    atk: peak((c) => c.atk),
    def: peak((c) => c.def),
  };
})();

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

  const hue = EL_HUE[character.color] ?? EL_HUE.light;
  const art = getCharacterArt(character.id);
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
    <main className="terminal-grid min-h-dvh bg-void">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
        <Link
          href="/archive"
          className="chamfer inline-block border border-edge px-3 py-2 font-body text-[11px] font-bold uppercase tracking-[0.2em] text-readout-dim transition-colors hover:border-edge-strong hover:text-signal"
        >
          ← Character archive
        </Link>

        <div className="mt-3 grid gap-3.5 lg:grid-cols-[290px_minmax(0,1fr)]">
          {/* Identity rail. Sticky so the statline stays beside whatever
              multiplier you're reading further down a long kit. */}
          <aside className="flex flex-col gap-2.5 lg:sticky lg:top-4 lg:self-start">
            <div className="chamfer-lg border border-edge bg-panel">
              <div className="relative aspect-square overflow-hidden bg-inset">
                {art ? (
                  <Image
                    src={art}
                    alt={character.name}
                    width={1024}
                    height={1024}
                    priority
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-heading text-8xl text-readout-dim">
                    {character.name.charAt(0)}
                  </span>
                )}
                <span
                  className="absolute left-0 top-0 px-2 py-0.5 font-body text-[11px] font-bold tracking-[0.14em] text-void"
                  style={{ backgroundColor: hue }}
                >
                  {EL_CODE[character.color] ?? character.color}
                </span>
              </div>

              <div className="border-t border-hairline px-3 py-2.5">
                <h1 className="font-heading text-4xl leading-none tracking-[0.06em] text-readout-strong">
                  {character.name}
                </h1>
                <p className="mt-0.5 font-body text-[11px] font-bold uppercase tracking-[0.2em] text-readout-muted">
                  {character.id}
                </p>
                {Array.isArray(character.tags) && character.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {character.tags.map((tag) => (
                      <span
                        key={tag}
                        className="chamfer border border-edge px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-readout-dim"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Client island: the numbers carry the player's own level and
                  ascension, which this statically-generated page can't see. */}
              <div className="border-t border-hairline px-3 py-2.5">
                <CharacterStatBars
                  characterId={character.id}
                  base={{
                    hp: character.hp,
                    atk: character.atk,
                    def: character.def,
                  }}
                  peak={ROSTER_PEAK}
                  hue={hue}
                />
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
              <div className="chamfer-lg border border-edge bg-panel px-3 py-2.5">
                <p className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-readout-muted">
                  Lore
                </p>
                <p className="mt-1 font-body text-sm leading-relaxed text-readout-dim">
                  {character.lore}
                </p>
              </div>
            ) : null}
          </aside>

          {/* Kit details — a document, not a stack of cards. Same typography
              as /news via components/ui/prose.tsx. */}
          <div className="chamfer-lg border border-edge bg-panel px-4 pb-5 pt-1 md:px-6">
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
                    <UltimateDocument
                      characterId={character.id}
                      ultimate={character.ultimate}
                      storyOnly={character.storyOnly}
                    />
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
                            className={`${PROSE.td} font-heading text-sm tracking-wider text-readout-strong`}
                          >
                            {row.abilityName}
                          </td>
                          <td className={PROSE.td}>{row.rankLabel}</td>
                          <td className={PROSE.td}>{row.multiplierLabel}</td>
                          <td className={PROSE.td}>{row.scenarioLabel}</td>
                          {/* The result is the one number the whole row exists
                              to produce, so it carries the element hue — the
                              only place on this page besides the identity chip
                              where the element speaks. */}
                          <td className={PROSE.td} style={{ color: hue }}>
                            <KeyworkHighlighter
                              text={row.resultLabel}
                              className="font-body text-[13px] font-bold tabular-nums"
                            />
                          </td>
                          <td className={`${PROSE.td} max-w-70 whitespace-normal`}>
                            <KeyworkHighlighter
                              text={row.notes || "—"}
                              className="font-body text-xs leading-5 text-readout-muted"
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

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProseSection } from "@/components/ui/prose";
import SkillDocument from "@/components/game/SkillDocument";
import {
  characterCardNumbers,
  getCharacterByCardNumber,
  getCharacterPhases,
  getPlayableCharacters,
} from "@/lib/game/characterCatalog";
import KitPhases from "@/components/game/KitPhases";
import KitNumbers from "@/components/game/KitNumbers";
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
import { Screen } from "@/components/ui/Screen";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { panelVariants } from "@/components/ui/Panel";
import { cn } from "@/lib/utils";

/** Every block on this page that holds text is a paper panel (ruling #154):
 *  the identity rail, the lore and the kit document. */
const PAPER = panelVariants({ surface: "paper", density: "none", lift: "slab" });

interface CharacterPageProps {
  /**
   * The card's public number, not its `id`.
   *
   * `id` is a name (`duke`, `batra`) and Tanveer asked for the opposite -
   * *"the url would show the char id, not the names"* (2026-09-17). It is
   * also the key every save's `roster` holds, so it could not simply be
   * renumbered; `cardNumber` is a second, immutable identifier that exists to
   * be shown. `lib/game/characterCatalog.ts` resolves it back.
   */
  params: Promise<{ cardNumber: string }>;
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

export function generateStaticParams(): Array<{ cardNumber: string }> {
  return characterCardNumbers.map((cardNumber) => ({
    cardNumber: String(cardNumber),
  }));
}

export default async function CharacterDetailPage({
  params,
}: CharacterPageProps): Promise<ReactNode> {
  const { cardNumber } = await params;
  const character = getCharacterByCardNumber(cardNumber);

  if (!character) {
    notFound();
  }

  const hue = EL_HUE[character.color] ?? EL_HUE.light;
  const art = getCharacterArt(character.id);
  const passive = character.passive as KitPassiveView | undefined;
  const previewRows = buildCharacterDamagePreview(character);
  // Multi-phase kits (bosses, and later playable transformations) get a phase
  // switcher instead of the flat Skills + Passive sections.
  const isMultiPhase = getCharacterPhases(character).length > 1;

  return (
    // `app`, not `read`, deliberately. Plans/2026-09-17-layout-system.md files
    // "kit pages" under `read` (42rem), but that was written before this screen
    // gained its 290px stat sidebar: at 42rem the main column resolves to
    // 368px, narrower than the content area of a 390px phone. `app` gives it
    // 592px. Flagged for Tanveer — it is a one-word change if he wants `read`.
    <Screen width="app">
        <Link
          href="/archive"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start")}
        >
          ← Character archive
        </Link>

        {/* `grid-cols-1` is not decoration — without it this screen scrolled
            sideways 86px at 395px (browser audit, 2026-09-01), which ruling
            #107 makes a blocker rather than a bug.

            A `grid` with no column declared gets one implicit **`auto`** track,
            and an auto track is allowed to exceed its container: here it sized
            to 453px inside 351px, dragging the whole aside — portrait, name,
            stat bars — past the right edge. `grid-cols-1` is
            `repeat(1, minmax(0, 1fr))`, and the `0` floor is the part doing the
            work. The `lg:` override below is unaffected. */}
        <div className="mt-3 grid grid-cols-1 gap-3.5 lg:grid-cols-[290px_minmax(0,1fr)]">
          {/* Identity rail. Sticky so the statline stays beside whatever
              multiplier you're reading further down a long kit. */}
          <aside className="flex flex-col gap-2.5 lg:sticky lg:top-4 lg:self-start">
            <div className={PAPER}>
              <div className="relative aspect-square overflow-hidden border-b-2 border-border bg-muted">
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
                  <span className="flex h-full w-full items-center justify-center font-heading text-8xl text-muted-foreground">
                    {character.name.charAt(0)}
                  </span>
                )}
                <span
                  className="absolute left-0 top-0 border-b-2 border-r-2 border-border px-2 py-0.5 font-body text-caption font-bold tracking-label text-card-foreground"
                  style={{ backgroundColor: hue }}
                >
                  {EL_CODE[character.color] ?? character.color}
                </span>
              </div>

              <div className="px-3 py-2.5">
                {/* Heading above the name, the way ruling #141 describes it:
                    every version of a character keeps the same NAME and is
                    told apart by the heading. Tanveer confirmed the archive
                    entry page as a place it belongs (2026-09-17) and ruled it
                    out of the battle UI. */}
                {character.heading ? (
                  <p className="font-body text-caption font-bold uppercase tracking-eyebrow text-muted-foreground">
                    {character.heading}
                  </p>
                ) : null}
                <h1 className="font-heading text-4xl leading-none tracking-title">
                  {character.name}
                </h1>
                {/* The card number, not `id`. `id` is a name (`duke`,
                    `batra`), and printing it here put the thing the URL was
                    just changed to hide back on the page. */}
                <p className="mt-0.5 font-body text-caption font-bold uppercase tracking-eyebrow text-muted-foreground tabular-nums">
                  No. {character.cardNumber}
                </p>
                {Array.isArray(character.tags) && character.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {character.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Client island: the numbers carry the player's own level and
                  ascension, which this statically-generated page can't see. */}
              <div className="border-t border-rule px-3 py-2.5">
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
              <div className={cn(PAPER, "px-3 py-2.5")}>
                <p className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
                  Lore
                </p>
                <p className="mt-1 font-body text-sm leading-relaxed">
                  {character.lore}
                </p>
              </div>
            ) : null}
          </aside>

          {/* Kit details — a document, not a stack of cards. Same typography
              as /news via components/ui/prose.tsx. One paper sheet: the kit's
              keyword marker is drawn for paper (his pick, 2026-09-26). */}
          <div className={cn(PAPER, "px-4 pb-5 pt-1 md:px-6")}>
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
                  <PassiveProse passive={passive} showName={false} bare />
                </ProseSection>
              </>
            )}

            <ProseSection
              title="Kit Numbers"
              note={`vs dummy: ${DAMAGE_PREVIEW_DUMMY.atk} ATK / ${DAMAGE_PREVIEW_DUMMY.def} DEF / ${DAMAGE_PREVIEW_DUMMY.hp} HP`}
            >
              {/* One button per ability, numbers behind an overlay. The old
                  six-column table (Ability / Tier / Mult / Scenario / Result /
                  Notes, with a sentence in the last one) was unreadable at
                  390px - Tanveer, 2026-09-17: *"on a mobile width it is very
                  squeezed"*. The Scenario column is gone outright: every row
                  is computed at one baseline now, so it said "Standard" all
                  the way down. */}
              <KitNumbers rows={previewRows} />
            </ProseSection>
          </div>
        </div>
    </Screen>
  );
}

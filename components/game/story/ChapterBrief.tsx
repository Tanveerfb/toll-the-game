"use client";

import React from "react";
import Image from "next/image";
import TeamPicker from "@/components/game/TeamPicker";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById, type CharacterData } from "@/lib/game/characterCatalog";
import { materialLabel } from "@/lib/game/materials";
import {
  describeStageEffect,
  groupStageEffects,
} from "@/lib/game/stageEffects";
import type { StageEffect } from "@/types/stageEffects";
import { STAMINA_CAP } from "@/lib/game/stamina";
import { storyAttemptCost } from "@/lib/game/storyRewards";
import {
  defaultTrialSelection,
  storyAnchors,
  storyOpenSlots,
  storyTrialIds,
  trialProgression,
} from "@/lib/game/storyTeam";
import { BASE_PROGRESSION } from "@/lib/game/progression";
import { usePlayerStore } from "@/store/playerStore";
import type { StoryChapter } from "@/types/story";

/**
 * The pre-fight screen, arranged as a decision rather than a document
 * (Tanveer, 2026-08-11).
 *
 * Team select leads because on a replay it is the only thing the player
 * actually changes; everything else is reference. The four stacked bordered
 * boxes this replaced each held one label and one value, so the screen spent
 * four borders saying four short facts and pushed the only interactive control
 * below the fold.
 */

/**
 * The team rule, short enough for the fact strip.
 *
 * It used to be a full sentence in unlabelled prose above the picker, while
 * the strip spent a whole cell on the chapter's scene count — a number that
 * changes nothing the player does here. The rule earns the cell; the count
 * didn't. The picker itself carries the detail the sentence used to: anchors
 * render fixed and can't be removed, which shows the rule better than telling
 * it does.
 */
const TEAM_MODE_LABEL: Record<StoryChapter["teamMode"], string> = {
  canon: "Story fixed",
  anchored: "Leads fixed",
  free: "Your pick",
};

/** "300–800 Coin" / "2 Training Manual" — the brief advertises what a run pays
 *  before the player spends stamina on it. */
function rangeLabel(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

function useRewardLines(chapter: StoryChapter, cleared: boolean): string[] {
  return React.useMemo(() => {
    const lines: string[] = [];
    if (!cleared) {
      const { gems, coin, permanentTicket, materials } = chapter.rewards.firstClear;
      if (gems) lines.push(`${gems} Gems`);
      if (coin) lines.push(`${coin} Coin`);
      if (permanentTicket) lines.push(`${permanentTicket} Permanent Ticket`);
      for (const [id, qty] of Object.entries(materials ?? {})) {
        if (qty) lines.push(`${qty} ${materialLabel(id)}`);
      }
      return lines;
    }
    const { coin, materials } = chapter.rewards.repeat;
    if (coin) lines.push(`${rangeLabel(coin.min, coin.max)} Coin`);
    for (const [id, range] of Object.entries(materials ?? {})) {
      lines.push(`${rangeLabel(range.min, range.max)} ${materialLabel(id)}`);
    }
    return lines;
  }, [chapter, cleared]);
}

/** One cell of the fact strip. Opposition isn't here — it has portraits of its
 *  own below, and printing the same names twice was what made the old stack of
 *  boxes feel padded. */
function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="bg-panel px-3 py-2.5">
      <p className="font-body text-[9px] font-bold uppercase tracking-[0.22em] text-readout-muted">
        {label}
      </p>
      <p className="mt-0.5 font-heading text-lg leading-tight tracking-[0.04em] text-readout-strong">
        {children}
      </p>
    </div>
  );
}

export default function ChapterBrief({
  chapter,
  chapterNumber,
  partOrder,
  cleared,
  ownedIds,
  currentStamina,
  onStart,
  onBack,
}: {
  chapter: StoryChapter;
  chapterNumber: number;
  /** Shown in the header line — the index leads with the part, so the brief
   *  shouldn't quietly drop it. */
  partOrder?: number;
  cleared: boolean;
  ownedIds: string[];
  currentStamina: number;
  /** `picks` are player-chosen character ids; anchors are resolved downstream
   *  by `resolveStoryTeam` so this component never assembles a battle team. */
  onStart: (picks: string[], skipScenes: boolean, useTrialFor: string[]) => void;
  onBack: () => void;
}): React.JSX.Element {
  const [picked, setPicked] = React.useState<CharacterData[]>([]);

  // Which owned anchors are being fielded as the story's version. Seeded from
  // `defaultTrialSelection` so a player is never silently handed the weaker of
  // the two copies, then fully theirs to override.
  const progress = usePlayerStore((s) => s.characters);
  const progressOf = React.useCallback(
    (id: string) =>
      progress[id] ?? { level: BASE_PROGRESSION.level, ascension: BASE_PROGRESSION.ascension },
    [progress],
  );
  // Explicit taps only. The effective set is derived from these plus the
  // default, rather than being seeded into state — a seeded copy would go
  // stale when the roster or progression arrives late from the cloud, and
  // re-seeding it from an effect is the setState-in-effect trap.
  const [override, setOverride] = React.useState<Record<string, boolean>>({});
  const defaults = React.useMemo(
    () => defaultTrialSelection(chapter, ownedIds, progressOf),
    [chapter, ownedIds, progressOf],
  );
  const lentByChoice = React.useMemo(() => {
    const anchorIds = new Set(storyAnchors(chapter).map((a) => a.id));
    const set = new Set(defaults);
    for (const [id, lent] of Object.entries(override)) {
      if (!anchorIds.has(id)) continue;
      if (lent) set.add(id);
      else set.delete(id);
    }
    return [...set];
  }, [chapter, defaults, override]);

  const toggleLent = React.useCallback(
    (id: string) => {
      const nowLent = !lentByChoice.includes(id);
      setOverride((prev) => ({ ...prev, [id]: nowLent }));
    },
    [lentByChoice],
  );

  const trial = trialProgression(chapter);
  const anchorNote = React.useCallback(
    (id: string, lent: boolean) => {
      if (lent) return `Lv${trial.level}`;
      const own = progressOf(id);
      return `Lv${own.level}`;
    },
    [trial.level, progressOf],
  );

  const anchors = React.useMemo(
    () =>
      storyAnchors(chapter)
        .map((pick) => getCharacterById(pick.id))
        .filter((c): c is CharacterData => Boolean(c)),
    [chapter],
  );
  const openSlots = storyOpenSlots(chapter);
  const trialIds = React.useMemo(
    () => storyTrialIds(chapter, ownedIds),
    [chapter, ownedIds],
  );
  const cost = storyAttemptCost(chapter.rewards, cleared);
  const affordable = currentStamina >= cost;
  const rewardLines = useRewardLines(chapter, cleared);

  const enemies = (chapter.battle?.enemyTeam ?? []).map((pick) => ({
    id: pick.id,
    name: getCharacterById(pick.id)?.name ?? pick.id,
    art: getCharacterArt(pick.id),
  }));

  // Stage effects keep their three groupings (Tanveer, 2026-08-10) but move
  // off hardcoded rose/zinc/emerald onto the role tokens: a debuff on you is
  // aggression, a boon for you is restoration.
  const stage = groupStageEffects(chapter.stageEffects);
  const stageSections: {
    label: string;
    tone: string;
    effects: StageEffect[];
  }[] = [
    {
      label: "Enemy",
      tone: "border-role-attack/50 text-role-attack",
      effects: stage.enemy,
    },
    {
      label: "Both sides",
      tone: "border-edge text-readout-dim",
      effects: stage.both,
    },
    {
      label: "Your team",
      tone: "border-role-heal/50 text-role-heal",
      effects: stage.player,
    },
  ].filter((section) => section.effects.length > 0);

  const start = (skipScenes: boolean) => {
    if (!affordable) return;
    onStart(picked.map((c) => c.id), skipScenes, lentByChoice);
  };

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <button
        type="button"
        onClick={onBack}
        className="chamfer border border-edge px-3 py-2 font-body text-[11px] font-bold uppercase tracking-[0.2em] text-readout-dim transition-colors hover:border-edge-strong hover:text-signal"
      >
        {/* Named for where it lands. It used to say "Chapter select", which is
            the modal — this goes to the story index. */}
        ← Story index
      </button>

      <header className="mt-4 border-l-2 border-signal pl-3">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.28em] text-signal">
          {partOrder ? `Part ${partOrder} · ` : ""}Chapter {chapterNumber}
          {cleared ? " · Cleared" : ""}
        </p>
        <h1 className="mt-0.5 font-heading text-3xl leading-none tracking-[0.06em] text-readout-strong md:text-4xl">
          {chapter.title}
        </h1>
      </header>

      {chapter.battle ? (
      <div className="mt-4">
        <TeamPicker
          ownedIds={ownedIds}
          team={picked}
          onChange={setPicked}
          anchors={anchors}
          openSlots={openSlots}
          trialIds={trialIds}
          lentByChoiceIds={lentByChoice}
          onToggleLent={toggleLent}
          anchorNote={anchorNote}
          title={openSlots === 0 ? "Story team" : "Your team"}
        />
      </div>
      ) : null}

      {/* Opposition and the stage rules read as one block: both describe what
          you're walking into rather than what you bring. A scene-only chapter
          has neither, so the whole block goes rather than rendering an empty
          "Against" header. */}
      {chapter.battle ? (
      <div className="mt-2.5 border border-edge bg-panel px-3 py-2.5">
        <p className="font-body text-[9px] font-bold uppercase tracking-[0.22em] text-readout-muted">
          Against
        </p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {enemies.map((enemy, index) => (
            <span
              key={`${enemy.id}-${index}`}
              className="w-14 text-center"
            >
              <span className="block h-14 w-14 overflow-hidden border border-role-attack bg-inset">
                {enemy.art ? (
                  <Image
                    src={enemy.art}
                    alt=""
                    width={128}
                    height={128}
                    className="h-full w-full object-cover object-top"
                  />
                ) : null}
              </span>
              <span className="mt-0.5 block truncate font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-dim">
                {enemy.name}
              </span>
            </span>
          ))}
        </div>

        {stageSections.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-hairline pt-2.5">
            {stageSections.map((section) =>
              section.effects.map((effect: StageEffect, i: number) => (
                <span
                  key={`${section.label}-${i}`}
                  className={`border px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-[0.12em] ${section.tone}`}
                >
                  {section.label}: {describeStageEffect(effect)}
                </span>
              )),
            )}
          </div>
        ) : null}
      </div>
      ) : (
        <p className="mt-2.5 border-l-2 border-signal bg-panel px-3 py-2.5 font-body text-[11px] leading-relaxed text-readout-dim">
          No battle in this chapter — it plays as scenes, and still pays its
          first-clear rewards.
        </p>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-px border border-edge bg-edge sm:grid-cols-3">
        <Fact label="Stamina">
          {cost === 0 ? (
            "Free"
          ) : (
            <>
              −{cost}
              <span className="ml-2 font-body text-xs font-semibold tabular-nums text-readout-muted">
                {currentStamina} / {STAMINA_CAP}
              </span>
            </>
          )}
        </Fact>
        <Fact label={cleared ? "Drops per clear" : "First clear bonus"}>
          {rewardLines.length === 0 ? "Nothing" : rewardLines.join(" · ")}
        </Fact>
        {/* A scene-only chapter has no picker, so the team rule has nothing to
            describe — the strip drops to two cells rather than printing a rule
            for a fight that doesn't happen. */}
        {chapter.battle ? (
          <Fact label="Team">{TEAM_MODE_LABEL[chapter.teamMode]}</Fact>
        ) : null}
      </div>

      {!affordable ? (
        <p className="mt-2.5 border border-role-attack/50 bg-role-attack/8 px-3 py-2 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-role-attack">
          Not enough stamina — wait for it to regenerate.
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!affordable}
          onClick={() => start(false)}
          className="chamfer h-12 flex-1 border border-signal bg-signal font-heading text-xl tracking-[0.12em] text-void transition-opacity disabled:pointer-events-none disabled:opacity-40"
        >
          {chapter.battle ? (cleared ? "Replay" : "Begin") : "Read"}
          {cost > 0 ? ` · ${cost} stamina` : ""}
        </button>
        {/* Farming a cleared chapter through eight VN panels every run would
            make the loop unusable — skipping is offered only once the player
            has actually seen the scenes. */}
        {cleared ? (
          <button
            type="button"
            disabled={!affordable}
            onClick={() => start(true)}
            className="chamfer h-12 border border-edge px-6 font-heading text-lg tracking-[0.12em] text-readout-dim transition-colors hover:border-edge-strong hover:text-signal disabled:pointer-events-none disabled:opacity-40"
          >
            Skip story
          </button>
        ) : null}
      </div>
    </section>
  );
}

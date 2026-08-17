"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import TeamPicker from "@/components/game/TeamPicker";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById, type CharacterData } from "@/lib/game/characterCatalog";
import { BASE_PROGRESSION } from "@/lib/game/progression";
import { describeStageEffect } from "@/lib/game/stageEffects";
import { missionKey } from "@/lib/game/stageMissions";
import { describeFarm, describeFirstClear } from "@/lib/game/storyRewards";
import {
  defaultTrialSelection,
  storyAnchors,
  storyOpenSlots,
  storyTrialIds,
  trialProgression,
} from "@/lib/game/storyTeam";
import { usePlayerStore } from "@/store/playerStore";
import type { StoryChapter, StoryStage } from "@/types/story";

/**
 * Stage brief — the last screen before a stage is entered.
 *
 * The wave rail is the pitch: several fights, **one HP pool**, no heal between.
 * That is what makes team-building the decision v1's board only pretended to be,
 * and why the rail leads the screen rather than sitting under the team.
 *
 * Missions state what they pay *before* the run, since a mission the player learns
 * about afterwards is a mission they didn't get to play toward.
 */
export default function StageBrief({
  chapter,
  stage,
  label,
  cleared,
  claimedMissions,
  stamina,
  onStart,
  onBack,
}: {
  chapter: StoryChapter;
  stage: StoryStage;
  /** `1-5`. */
  label: string;
  cleared: boolean;
  claimedMissions: Record<string, boolean>;
  /** Stamina the player currently has, for the affordability gate. */
  stamina: number;
  onStart: (picks: string[], skipScenes: boolean, useTrialFor: string[]) => void;
  onBack: () => void;
}): React.JSX.Element {
  const [picked, setPicked] = React.useState<CharacterData[]>([]);

  const roster = usePlayerStore((s) => s.roster);
  const progress = usePlayerStore((s) => s.characters);
  const ownedIds = roster;
  const progressOf = React.useCallback(
    (id: string) =>
      progress[id] ?? {
        level: BASE_PROGRESSION.level,
        ascension: BASE_PROGRESSION.ascension,
      },
    [progress],
  );

  // Which owned anchors are fielded as the story's lent copy. Explicit taps only:
  // the effective set is derived from the default plus overrides rather than
  // seeded into state, because a seeded copy goes stale when the roster arrives
  // late from the cloud (ruling #93's picker).
  const [override, setOverride] = React.useState<Record<string, boolean>>({});
  const defaults = React.useMemo(
    () => defaultTrialSelection(stage, ownedIds, progressOf),
    [stage, ownedIds, progressOf],
  );
  const lentByChoice = React.useMemo(() => {
    const anchorIds = new Set(storyAnchors(stage).map((a) => a.id));
    const set = new Set(defaults);
    for (const [id, lent] of Object.entries(override)) {
      if (!anchorIds.has(id)) continue;
      if (lent) set.add(id);
      else set.delete(id);
    }
    return [...set];
  }, [stage, defaults, override]);

  const toggleLent = React.useCallback(
    (id: string) => setOverride((prev) => ({ ...prev, [id]: !lentByChoice.includes(id) })),
    [lentByChoice],
  );

  const trial = trialProgression(stage);
  const anchorNote = React.useCallback(
    (id: string, lent: boolean) =>
      lent ? `Lv${trial.level}` : `Lv${progressOf(id).level}`,
    [trial.level, progressOf],
  );

  const anchors = React.useMemo(
    () =>
      storyAnchors(stage)
        .map((pick) => getCharacterById(pick.id))
        .filter((c): c is CharacterData => Boolean(c)),
    [stage],
  );
  const openSlots = storyOpenSlots(stage);
  const trialIds = React.useMemo(
    () => storyTrialIds(stage, ownedIds),
    [stage, ownedIds],
  );

  const firstClear = describeFirstClear(stage.rewards);
  const farm = describeFarm(stage.rewards);
  const affordable = stamina >= stage.stamina;

  return (
    <div className="mx-auto w-full max-w-md px-3 pt-3 pb-40">
      <header className="pb-3">
        <p className="text-[11px] tracking-[0.22em] text-signal">
          CHAPTER {chapter.number} · STAGE {label}
        </p>
        <h1 className="font-heading text-2xl tracking-wide text-readout-strong">
          {stage.name}
        </h1>
      </header>

      {stage.waves.length > 0 ? (
        <section className="chamfer mb-2.5 border border-edge bg-panel p-2.5">
          <h2 className="pb-1.5 text-[10px] tracking-[0.2em] text-readout-muted uppercase">
            Opposition · {stage.waves.length} wave
            {stage.waves.length === 1 ? "" : "s"} · HP carries over
          </h2>
          <div className="flex items-center gap-1.5">
            {stage.waves.map((wave, index) => {
              const last = index === stage.waves.length - 1;
              return (
                <React.Fragment key={index}>
                  {index > 0 ? (
                    <span aria-hidden className="text-readout-muted">
                      ›
                    </span>
                  ) : null}
                  <div
                    className={`min-w-0 flex-1 border bg-inset p-1.5 ${
                      last && stage.kind === "boss" ? "border-el-red" : "border-edge"
                    }`}
                  >
                    <p
                      className={`text-[9.5px] tracking-[0.16em] ${
                        last && stage.kind === "boss"
                          ? "text-el-red"
                          : "text-readout-muted"
                      }`}
                    >
                      WAVE {index + 1}
                    </p>
                    <div className="flex gap-1 pt-1">
                      {wave.enemies.map((enemy, slot) => (
                        <EnemyFace key={slot} id={enemy.id} level={enemy.level} />
                      ))}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <p className="pt-2 text-xs leading-relaxed text-readout-dim">
            No healing between waves. Units that fall stay down. A wipe restarts the
            stage and charges stamina again.
          </p>
          {stage.waves
            .flatMap((wave) => wave.stageEffects ?? [])
            .map((effect, index) => (
              <p key={index} className="pt-1 text-xs text-el-light">
                {describeStageEffect(effect)}
              </p>
            ))}
        </section>
      ) : null}

      {stage.missions.length > 0 ? (
        <section className="chamfer mb-2.5 border border-edge bg-panel p-2.5">
          <h2 className="pb-1 text-[10px] tracking-[0.2em] text-readout-muted uppercase">
            Missions · optional · one-time
          </h2>
          <ul>
            {stage.missions.map((mission) => {
              const done =
                claimedMissions[missionKey(chapter.id, stage.id, mission.id)] === true;
              return (
                <li
                  key={mission.id}
                  className={`flex items-center gap-2.5 border-b border-gridline py-1.5 text-[13.5px] last:border-b-0 ${
                    done ? "text-readout-muted" : "text-readout"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`h-4 w-4 shrink-0 border ${
                      done ? "border-el-light bg-el-light" : "border-edge-strong"
                    }`}
                  />
                  <span className="min-w-0">{mission.label}</span>
                  <span
                    className={`ml-auto shrink-0 text-xs tracking-[0.06em] ${
                      done ? "text-readout-muted" : "text-el-blue"
                    }`}
                  >
                    {done
                      ? "Claimed"
                      : describeFirstClear({ firstClear: mission.reward }).join(" · ")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="chamfer mb-2.5 grid grid-cols-2 gap-2 border border-edge bg-panel p-2.5">
        <div>
          <p className="text-[9.5px] tracking-[0.18em] text-readout-muted uppercase">
            First clear {cleared ? "· banked" : ""}
          </p>
          <p
            className={`pt-1 text-[13px] ${
              cleared ? "text-readout-muted line-through" : "text-readout"
            }`}
          >
            {firstClear.length > 0 ? firstClear.join(" · ") : "—"}
          </p>
        </div>
        <div>
          <p className="text-[9.5px] tracking-[0.18em] text-readout-muted uppercase">
            Farmable
          </p>
          <p className="pt-1 text-[13px] text-readout">
            {farm.length > 0 ? farm.join(" · ") : "—"}
          </p>
        </div>
      </section>

      {stage.team.length > 0 ? (
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
      ) : null}

      {/* Primaries in the thumb-reachable lower third, and pinned so the picker
          above can grow without pushing BEGIN off the screen (ruling #107). */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-[linear-gradient(180deg,transparent,rgba(6,9,12,0.96)_40%)] px-3 pt-5 pb-3">
        <div className="mx-auto flex w-full max-w-md items-stretch gap-2">
          <div className="flex-1">
            <Button
              className="chamfer h-12 w-full font-heading text-xl tracking-[0.09em]"
              disabled={!affordable}
              onClick={() => onStart(picked.map((c) => c.id), false, lentByChoice)}
            >
              {affordable ? "Begin" : "Not enough stamina"}
            </Button>
            <p className="pt-1 text-center text-[11px] tracking-[0.1em] text-readout-dim">
              COSTS {stage.stamina} STAMINA · EVERY ATTEMPT
            </p>
          </div>
          {cleared && stage.waves.length > 0 ? (
            <Button
              variant="ghost"
              className="chamfer h-12 w-24 text-xs leading-tight"
              disabled={!affordable}
              onClick={() => onStart(picked.map((c) => c.id), true, lentByChoice)}
            >
              Skip
              <br />
              scenes
            </Button>
          ) : null}
        </div>
        <div className="mx-auto w-full max-w-md pt-2">
          <Button variant="ghost" className="chamfer w-full" onClick={onBack}>
            ← Stages
          </Button>
        </div>
      </div>
    </div>
  );
}

function EnemyFace({ id, level }: { id: string; level?: number }): React.JSX.Element {
  const character = getCharacterById(id);
  const art = getCharacterArt(id);
  return (
    <span
      title={`${character?.name ?? id}${level ? ` · Lv${level}` : ""}`}
      className="relative grid h-8 w-8 place-items-center overflow-hidden border border-edge-strong bg-inset text-[10px] text-readout-dim"
    >
      {art ? (
        <Image src={art} alt="" fill sizes="32px" className="object-cover object-top" />
      ) : (
        (character?.name ?? id).slice(0, 3).toUpperCase()
      )}
      <span className="sr-only">
        {character?.name ?? id}
        {level ? `, level ${level}` : ""}
      </span>
    </span>
  );
}

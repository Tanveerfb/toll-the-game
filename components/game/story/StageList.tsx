"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { describeFarm, describeFirstClear } from "@/lib/game/storyRewards";
import type { StoryIndexChapter, StoryIndexStage } from "@/lib/game/storyCatalog";
import type { StoryChapter } from "@/types/story";

/**
 * Stage list — story mode's farming surface.
 *
 * Every stage is reachable in one tap. v1 made the player re-walk a board to
 * reach the fight they wanted to repeat, which is the single biggest reason it
 * didn't survive contact with farming.
 *
 * A row answers the three questions a returning player has, in this order: what
 * does it cost, what have I not claimed, and what does it still pay. First-clear
 * loot is struck through once banked so the two reward columns teach the rule —
 * one-time versus farmable — without a line of copy explaining it.
 */
export default function StageList({
  index,
  chapter,
  onSelectStage,
  onBack,
}: {
  index: StoryIndexChapter;
  chapter: StoryChapter;
  onSelectStage: (stageId: string) => void;
  onBack: () => void;
}): React.JSX.Element {
  const cover = getCharacterArt(chapter.coverCharacterId);

  return (
    <div className="mx-auto w-full max-w-md pb-8">
      <header className="relative flex h-28 flex-col justify-end overflow-hidden border-b border-edge px-3 pb-2">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(max-width: 480px) 100vw, 448px"
            className="object-cover object-top opacity-45"
          />
        ) : null}
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,transparent_18%,rgba(6,9,12,0.92))]"
        />
        <span className="relative text-[11px] tracking-[0.22em] text-signal">
          CHAPTER {index.number}
        </span>
        <h1 className="relative font-heading text-2xl tracking-wide text-readout-strong">
          {index.title}
        </h1>
        <p className="relative text-xs tracking-[0.08em] text-readout-dim">
          {index.totalStages} STAGES · {index.missionsClaimed}/{index.missionsTotal}{" "}
          MISSIONS CLAIMED
        </p>
      </header>

      <ul className="flex flex-col gap-2.5 px-3 pt-3">
        {index.stages.map((stage) => (
          <li key={stage.id}>
            <StageRow
              stage={stage}
              rewards={
                chapter.stages.find((s) => s.id === stage.id)?.rewards ?? {
                  firstClear: {},
                }
              }
              onSelect={onSelectStage}
            />
          </li>
        ))}
      </ul>

      <div className="px-3 pt-4">
        <Button variant="ghost" className="chamfer w-full" onClick={onBack}>
          ← Chapters
        </Button>
      </div>
    </div>
  );
}

const KIND_CHIP: Record<StoryIndexStage["kind"], { label: string; className: string }> =
  {
    story: { label: "Scene", className: "border-el-dark/50 text-el-dark" },
    battle: { label: "Battle", className: "border-edge text-readout-dim" },
    boss: { label: "Boss", className: "border-el-red/50 text-el-red" },
  };

const KIND_BORDER: Record<StoryIndexStage["kind"], string> = {
  story: "border-l-el-dark",
  battle: "border-l-edge-strong",
  boss: "border-l-el-red",
};

function StageRow({
  stage,
  rewards,
  onSelect,
}: {
  stage: StoryIndexStage;
  rewards: StoryChapter["stages"][number]["rewards"];
  onSelect: (stageId: string) => void;
}): React.JSX.Element {
  const sealed = stage.state === "sealed";
  const cleared = stage.state === "cleared";
  const chip = KIND_CHIP[stage.kind];
  const firstClear = describeFirstClear(rewards);
  const farm = describeFarm(rewards);

  if (sealed) {
    return (
      <div className="chamfer flex min-h-[64px] items-center gap-3 border border-edge border-l-2 border-l-edge bg-inset px-3 py-3">
        <span className="font-heading text-base tracking-[0.08em] text-readout-muted">
          {stage.label}
        </span>
        <span
          aria-hidden
          className="h-2.5 w-36 bg-[repeating-linear-gradient(90deg,var(--color-hairline)_0_8px,transparent_8px_13px)]"
        />
        <span className="ml-auto text-[10px] tracking-[0.18em] text-readout-muted uppercase">
          Sealed
        </span>
        <span className="sr-only">Stage {stage.number} is not unlocked yet</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(stage.id)}
      className={`chamfer w-full border border-edge border-l-[3px] bg-panel px-3 py-2.5 text-left ${KIND_BORDER[stage.kind]}`}
    >
      <span className="flex items-baseline gap-2">
        <span className="font-heading text-lg tracking-[0.08em] text-signal">
          {stage.label}
        </span>
        <span className="text-[15px] font-semibold text-readout-strong">
          {stage.name}
        </span>
        <span
          className={`ml-auto border px-1.5 py-0.5 text-[10px] tracking-[0.16em] uppercase ${chip.className}`}
        >
          {chip.label}
        </span>
      </span>

      <span className="flex items-center gap-2 pt-1.5 text-xs tracking-[0.06em] text-readout-dim">
        {stage.waves.length > 0 ? (
          <WaveRail waves={stage.waves} boss={stage.kind === "boss"} />
        ) : (
          <span>No battle</span>
        )}
        <span aria-hidden>·</span>
        <span>STA {stage.stamina}</span>
        {stage.missionsTotal > 0 ? (
          <span className="ml-auto flex gap-1" aria-hidden>
            {Array.from({ length: stage.missionsTotal }).map((_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 border ${
                  i < stage.missionsClaimed
                    ? "border-el-light bg-el-light"
                    : "border-edge-strong"
                }`}
              />
            ))}
          </span>
        ) : null}
        {stage.missionsTotal > 0 ? (
          <span className="sr-only">
            {stage.missionsClaimed} of {stage.missionsTotal} missions claimed
          </span>
        ) : null}
      </span>

      <span className="mt-2 grid grid-cols-2 gap-2 border-t border-gridline pt-1.5">
        <span className="block">
          <span className="block text-[9.5px] tracking-[0.18em] text-readout-muted uppercase">
            First clear
          </span>
          <span
            className={`block text-xs ${
              cleared ? "text-readout-muted line-through" : "text-readout"
            }`}
          >
            {firstClear.length > 0 ? firstClear.join(" · ") : "—"}
          </span>
        </span>
        <span className="block">
          <span className="block text-[9.5px] tracking-[0.18em] text-readout-muted uppercase">
            Farm
          </span>
          <span className="block text-xs text-readout">
            {farm.length > 0 ? farm.join(" · ") : "—"}
          </span>
        </span>
      </span>
    </button>
  );
}

/** `2 › 2 › 1` — how many enemies each wave brings, boss wave flagged. The rail
 *  is the row's whole pitch: a stage is a run of fights, not one fight. */
function WaveRail({
  waves,
  boss,
}: {
  waves: string[][];
  boss: boolean;
}): React.JSX.Element {
  return (
    <span className="flex items-center gap-1 text-readout">
      {waves.map((enemies, i) => {
        const last = i === waves.length - 1;
        const names = enemies
          .map((id) => getCharacterById(id)?.name ?? id)
          .join(", ");
        return (
          <React.Fragment key={i}>
            {i > 0 ? (
              <span aria-hidden className="text-readout-muted">
                ›
              </span>
            ) : null}
            <span
              title={names}
              className={`grid h-[15px] w-[15px] place-items-center border text-[9.5px] ${
                boss && last ? "border-el-red text-el-red" : "border-edge-strong"
              }`}
            >
              {enemies.length}
            </span>
          </React.Fragment>
        );
      })}
      <span className="sr-only">
        {waves.length} wave{waves.length === 1 ? "" : "s"}
      </span>
    </span>
  );
}

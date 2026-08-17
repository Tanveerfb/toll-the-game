"use client";

import React from "react";
import Image from "next/image";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";
import type { StoryIndexChapter } from "@/lib/game/storyCatalog";

/**
 * One chapter, as a card in the chapter carousel.
 *
 * The anatomy is Dokkan's stage-list row (Tanveer's reference, 2026-08-17):
 * a status banner, the numbered title, the stamina cost, then two reward
 * columns — what a first clear pays, and what farming it pays. He described the
 * second as "a preview of farmable stuff from that stage", which is the thing
 * the old chapter row never showed: you had to open the brief to find out
 * whether a chapter was worth repeating.
 *
 * A **sealed** chapter keeps its number and its shape and loses everything else.
 * `REDACTED_TITLE` is fixed-width on purpose — blocking a title out
 * character-for-character leaks its length, and "Nine Years" versus "The World
 * That Toll Built" is most of the guess. Enemy slots render as `?` boxes so the
 * count is public but the identities are not.
 */
export const REDACTED_TITLE = "████████ █████";

function EnemyThumbs({
  ids,
  hidden,
}: {
  ids: string[];
  hidden: boolean;
}): React.JSX.Element | null {
  if (ids.length === 0) return null;
  return (
    <span className="flex shrink-0 gap-1">
      {ids.slice(0, 4).map((id, index) => {
        const art = hidden ? null : getCharacterArt(id);
        return (
          <span
            key={`${id}-${index}`}
            className="block h-7 w-7 overflow-hidden border border-role-attack/60 bg-inset"
            title={hidden ? undefined : (getCharacterById(id)?.name ?? id)}
          >
            {art ? (
              <Image
                src={art}
                alt=""
                width={64}
                height={64}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-heading text-xs text-readout-muted">
                ?
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export default function EntryCard({
  chapter,
  cleared,
  staminaCost,
  clearReward,
  farmable,
  ribbon,
  focused,
  onSelect,
}: {
  chapter: StoryIndexChapter;
  cleared: boolean;
  staminaCost: number;
  /** One-time bundle lines — what finishing it the first time pays. */
  clearReward: string[];
  /** Repeat-drop lines — what farming it pays. */
  farmable: string[];
  /** A Bureau Order this chapter satisfies, if any. */
  ribbon?: { label: string; claimed: boolean } | null;
  focused: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  const sealed = chapter.state === "sealed";

  const frame = `chamfer relative w-full overflow-hidden border bg-panel text-left transition-[transform,opacity,border-color] duration-200 ${
    focused ? "scale-100 opacity-100" : "scale-[0.97] opacity-45 grayscale"
  } ${sealed ? "border-dashed border-edge" : focused ? "border-signal" : "border-edge"}`;

  const body = (
    <>
      {cleared ? (
        <span className="absolute left-0 top-0 bg-role-heal px-2 py-0.5 font-heading text-xs tracking-[0.14em] text-void">
          CLEARED
        </span>
      ) : null}

      <div
        className={`flex items-baseline justify-between gap-3 border-b border-hairline px-3 pb-2 ${cleared ? "pt-6" : "pt-2.5"}`}
      >
        <span className="min-w-0 truncate font-heading text-lg tracking-[0.04em] text-readout-strong">
          {chapter.number}.{" "}
          {sealed ? (
            <span aria-hidden className="text-readout-muted">
              {REDACTED_TITLE}
            </span>
          ) : (
            chapter.title
          )}
        </span>
        <span className="shrink-0 border border-el-light/50 px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-[0.14em] tabular-nums text-el-light">
          {staminaCost === 0 ? "Free" : `STA ${staminaCost}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-hairline">
        <div className="bg-panel-raised px-3 py-2">
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.22em] text-readout-muted">
            {cleared ? "Cleared" : "Clear reward"}
          </p>
          <p className="mt-1 font-body text-[11px] leading-snug text-readout">
            {sealed ? "—" : cleared ? "Done" : (clearReward.join(" · ") || "—")}
          </p>
        </div>
        <div className="bg-panel-raised px-3 py-2">
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.22em] text-readout-muted">
            Farmable
          </p>
          <p className="mt-1 font-body text-[11px] leading-snug text-readout">
            {sealed ? "—" : (farmable.join(" · ") || "Nothing")}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <EnemyThumbs ids={chapter.enemyIds} hidden={sealed} />
        {sealed ? (
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
            Sealed
          </span>
        ) : null}
        {ribbon ? (
          <span
            className={`ml-auto shrink-0 px-2 py-0.5 font-heading text-sm tracking-[0.1em] ${
              ribbon.claimed
                ? "bg-edge text-readout-muted"
                : "bg-el-light text-void"
            }`}
          >
            ◈ {ribbon.label}
            {ribbon.claimed ? " ✓" : ""}
          </span>
        ) : null}
      </div>
    </>
  );

  // A sealed chapter is not a control. It keeps the card's shape so the list
  // reads as continuous, but nothing about it is actionable.
  if (sealed) {
    return (
      <div
        className={frame}
        aria-label={`Chapter ${chapter.number}, sealed`}
        role="group"
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Chapter ${chapter.number}, ${chapter.title}${cleared ? ", cleared" : ""}. ${staminaCost === 0 ? "Free" : `${staminaCost} stamina`}.`}
      className={frame}
    >
      {body}
    </button>
  );
}

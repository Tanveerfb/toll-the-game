"use client";

import React from "react";
import Image from "next/image";
import { m } from "framer-motion";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";
import type { StoryTeamPick } from "@/types/story";

const HOLD_MS = 1600;

/**
 * The beat between the scenes and the arena.
 *
 * Previously the fight simply appeared — the single biggest hole in the story
 * experience. This is the stakes moment: who is standing against whom, before
 * a single card is played. It also covers the battle's start-up, which is why
 * it stays on the SKIP STORY path even though the scenes don't.
 *
 * Tap to skip. Uses existing character art — no new assets.
 */
export default function VersusSplash({
  playerTeam,
  enemyTeam,
  chapterTitle,
  onDone,
}: {
  playerTeam: StoryTeamPick[];
  enemyTeam: StoryTeamPick[];
  chapterTitle: string;
  onDone: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    const timer = window.setTimeout(onDone, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onDone}
      aria-label="Start battle"
      className="relative flex h-full w-full flex-1 cursor-pointer items-center justify-center overflow-hidden"
    >
      <TeamSide picks={playerTeam} side="left" />
      <TeamSide picks={enemyTeam} side="right" />

      {/* Diagonal split; the two sides read as colliding rather than sitting
          side by side. */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(55,166,255,0.18)_0%,transparent_45%,transparent_55%,rgba(255,90,78,0.18)_100%)]" />

      <m.div
        initial={{ opacity: 0, scale: 1.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        className="relative z-20 text-center"
      >
        <p className="font-heading text-7xl tracking-[0.06em] text-role-ultimate drop-shadow-[0_6px_24px_rgba(0,0,0,0.9)] md:text-9xl">
          VS
        </p>
        <p className="mt-2 font-body text-[11px] font-bold uppercase tracking-[0.26em] text-readout-dim">
          {chapterTitle}
        </p>
      </m.div>

      {/* Impact flash on the same beat the VS lands */}
      <m.div
        initial={{ opacity: 0.85 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.45 }}
        className="pointer-events-none absolute inset-0 z-30 bg-white"
      />

      <p className="pointer-events-none absolute inset-x-0 bottom-4 z-20 text-center font-body text-[10px] font-bold uppercase tracking-[0.22em] text-readout-muted">
        Tap to begin ▸
      </p>
    </div>
  );
}

function TeamSide({
  picks,
  side,
}: {
  picks: StoryTeamPick[];
  side: "left" | "right";
}): React.JSX.Element {
  const isLeft = side === "left";
  // Only the first three read at this size; a 4-unit team would shrink each
  // portrait past recognisability.
  const shown = picks.slice(0, 3);

  return (
    <m.div
      initial={{ opacity: 0, x: isLeft ? -60 : 60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`absolute inset-y-0 z-10 flex w-1/2 items-center gap-1 ${
        isLeft ? "left-0 justify-start pl-2" : "right-0 flex-row-reverse justify-start pr-2"
      }`}
    >
      {shown.map((pick, index) => {
        const character = getCharacterById(pick.id);
        const art = getCharacterArt(pick.id);
        if (!art) return null;
        return (
          <div
            key={`${pick.id}-${index}`}
            className="relative h-56 w-32 shrink-0 overflow-hidden md:h-80 md:w-48"
            style={{ zIndex: shown.length - index }}
          >
            <Image
              src={art}
              alt={character?.name ?? pick.id}
              width={512}
              height={512}
              priority
              className="h-full w-full object-cover object-top"
            />
            <div
              className={`absolute inset-0 ${
                isLeft
                  ? "bg-[linear-gradient(to_right,transparent_40%,#06090c_100%)]"
                  : "bg-[linear-gradient(to_left,transparent_40%,#06090c_100%)]"
              }`}
            />
            <div className="absolute inset-x-0 bottom-0 bg-void/75 px-1 py-0.5 text-center font-heading text-[10px] tracking-[0.06em] text-readout">
              {character?.name ?? pick.id}
            </div>
          </div>
        );
      })}
    </m.div>
  );
}

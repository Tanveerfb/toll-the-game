"use client";

import React from "react";
import Image from "next/image";
import { ChevronRight, Lock } from "lucide-react";

import { getCharacterArt } from "@/lib/game/characterArt";
import { Badge } from "@/components/ui/badge";
import { panelVariants } from "@/components/ui/Panel";
import { cn } from "@/lib/utils";
import { eventPhaseCount, type GameEvent } from "@/lib/game/events";

/** A pill on the card's bottom row: the outline badge, in the card's ink. */
export function Chip({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <Badge variant="outline">{children}</Badge>;
}

/**
 * One row on the operations board, whatever it opens.
 *
 * Extracted from `EventCard` so the Epic Battles arcs wear the same row as the
 * events above them (ruling #139: one look for one job) instead of a second,
 * near-identical card. The caller supplies the words and the chips; the row
 * owns the layout, the portrait frame and the lock treatment.
 */
export function EventRowCard({
  art,
  kicker,
  title,
  summary,
  chips,
  locked = false,
  onSelect,
}: {
  /** Portrait URL, or null for the skull placeholder. */
  art: string | null;
  kicker: string;
  title: string;
  summary: string;
  /** The pills on the bottom row. */
  chips: React.ReactNode;
  locked?: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onSelect}
      className={cn(
        panelVariants({ surface: "paper", density: "none", press: !locked }),
        "flex items-stretch gap-3 p-2.5",
        locked && "opacity-55",
      )}
    >
      <span className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden border-2 border-border bg-muted">
        {art ? (
          <Image
            src={art}
            alt=""
            fill
            sizes="72px"
            className="object-cover object-top"
          />
        ) : (
          // Only reached by an event with no authored encounter — the two
          // ascension trials. Every fightable enemy resolves art, bosses
          // included (`getCharacterArt` maps NPC ids to `public/npc/`).
          //
          // Always the skull, never a lock. The right-hand slot below carries
          // that, and it is the slot that answers "where does this row take
          // me"; this one is a portrait placeholder, and a lock here says
          // nothing about the enemy. The two always coincided — the fallback
          // fires only for the trials, which are the only locked events — so a
          // locked trial drew two locks and a reason chip for one fact
          // (browser audit, 2026-09-01).
          <span className="font-heading text-2xl text-muted-foreground">☠</span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
          {kicker}
        </span>
        <span className="font-heading text-xl leading-tight tracking-title">
          {title}
        </span>
        <span className="font-body text-xs text-muted-foreground">
          {summary}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">{chips}</span>
      </span>

      <span className="flex shrink-0 items-center text-muted-foreground">
        {locked ? (
          <Lock className="h-4 w-4" strokeWidth={2} />
        ) : (
          <ChevronRight className="h-5 w-5" strokeWidth={2} />
        )}
      </span>
    </button>
  );
}

/** One row on the operations board. */
export default function EventCard({
  event,
  lockReason,
  onSelect,
}: {
  event: GameEvent;
  lockReason: string | null;
  onSelect: () => void;
}): React.JSX.Element {
  const art = event.enemyId ? getCharacterArt(event.enemyId) : null;
  const phases = eventPhaseCount(event);
  const locked = lockReason !== null;
  return (
    <EventRowCard
      art={art}
      kicker={event.kicker}
      title={event.name}
      summary={event.summary}
      locked={locked}
      onSelect={onSelect}
      chips={
        locked ? (
          <Chip>{lockReason}</Chip>
        ) : (
          <>
            <Chip>{event.staminaCost} stamina</Chip>
            <Chip>{event.repeatable ? "Repeatable" : "One clear"}</Chip>
            {phases > 1 ? <Chip>{phases} phases</Chip> : null}
          </>
        )
      }
    />
  );
}

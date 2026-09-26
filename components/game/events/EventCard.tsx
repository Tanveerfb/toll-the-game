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
function Chip({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Badge variant="outline">{children}</Badge>;
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
          {event.kicker}
        </span>
        <span className="font-heading text-xl leading-tight tracking-title">
          {event.name}
        </span>
        <span className="font-body text-xs text-muted-foreground">
          {event.summary}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {locked ? (
            <Chip>{lockReason}</Chip>
          ) : (
            <>
              <Chip>{event.staminaCost} stamina</Chip>
              <Chip>{event.repeatable ? "Repeatable" : "One clear"}</Chip>
              {phases > 1 ? <Chip>{phases} phases</Chip> : null}
            </>
          )}
        </span>
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

"use client";

import React from "react";

import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import EventCard from "@/components/game/events/EventCard";
import { STAMINA_CAP } from "@/lib/game/stamina";
import type { GameEvent } from "@/lib/game/events";

/**
 * The operations board: every event the player may currently *see*.
 *
 * Visibility and enterability are two different questions and this screen only
 * answers the first — `lockReason` arrives already computed, so the board never
 * re-derives a rule the event module owns (ruling #127).
 */
export default function EventsBoard({
  events,
  lockReasonFor,
  stamina,
  accountRank,
  worldLevel,
  onSelect,
}: {
  events: GameEvent[];
  lockReasonFor: (event: GameEvent) => string | null;
  stamina: number;
  accountRank: number;
  worldLevel: number;
  onSelect: (event: GameEvent) => void;
}): React.JSX.Element {
  return (
    <Screen width="app">
      <SectionHeader eyebrow="Operations board" title="Events">
        <p className="mt-1 font-body text-[11px] text-readout-muted">
          Stamina {stamina} / {STAMINA_CAP} · account rank {accountRank} · world
          level {worldLevel}
        </p>
      </SectionHeader>

      {events.length === 0 ? (
        /**
         * QOL, his definition: a list screen states why it is empty rather
         * than rendering nothing. Not currently reachable — the world boss is
         * visible from rank 1 — but a future gated event set could empty this
         * board, and an empty page with a header reads as a bug.
         */
        <p className="border border-hairline bg-panel px-3 py-6 text-center font-body text-xs text-readout-muted">
          No events are open to you yet. Climb account ranks to open them.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              lockReason={lockReasonFor(event)}
              onSelect={() => onSelect(event)}
            />
          ))}
        </div>
      )}
    </Screen>
  );
}

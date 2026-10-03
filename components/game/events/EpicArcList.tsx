"use client";

import React from "react";

import { Chip, EventRowCard } from "@/components/game/events/EventCard";
import { getCharacterArt } from "@/lib/game/characterArt";
import { arcLabel, type EpicArc } from "@/lib/game/epicBattles";

/**
 * The Epic Battles tab of the events board: one row per arc.
 *
 * Reuses the events' own row (`EventRowCard`) so an arc looks like the events
 * beside it. Nothing here is ever locked - every arc and stage is open from
 * rank 1 (Tanveer, 2026-10-03) - and nothing here shows progress: the only chip
 * is the stage count. Clears are recorded (`epicClears`) but never displayed,
 * his call: *"less is more for the players"*.
 */
export default function EpicArcList({
  arcs,
  onSelectArc,
}: {
  arcs: readonly EpicArc[];
  onSelectArc: (arc: EpicArc) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {arcs.map((arc) => {
        const lead = arc.stages[0]?.encounter.fights[0]?.enemies[0]?.id;
        return (
          <EventRowCard
            key={arc.id}
            art={lead ? getCharacterArt(lead) : null}
            kicker={arc.collection}
            title={arcLabel(arc)}
            summary={arc.summary}
            onSelect={() => onSelectArc(arc)}
            chips={<Chip>{arc.stages.length} stages</Chip>}
          />
        );
      })}
    </div>
  );
}

"use client";

import React from "react";

import { Alert } from "@/components/ui/alert";
import BackLink from "@/components/ui/BackLink";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Chip, EventRowCard } from "@/components/game/events/EventCard";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  arcLabel,
  type EpicArc,
  type EpicStage,
} from "@/lib/game/epicBattles";

/** "Lv 20" - the level of the stage's first fight; empty when none is authored.
 *  The name is not repeated: the page title already carries it. */
export function stageLevelLine(stage: EpicStage): string {
  return (stage.encounter.fights[0]?.enemies ?? [])
    .filter((pick) => pick.isSub !== true && pick.level)
    .map((pick) => `Lv ${pick.level}`)
    .join(", ");
}

/**
 * An arc's stage list: every stage open, in order. It shows no progress -
 * clears are recorded but not displayed (Tanveer, 2026-10-03).
 *
 * No lock and no "next stage" gating anywhere in here - stages are not
 * sequential (Tanveer, 2026-10-03). The note about team strength is the only
 * gate the player is shown, because difficulty is the gate.
 */
export default function EpicArcScreen({
  arc,
  onBack,
  onSelectStage,
}: {
  arc: EpicArc;
  onBack: () => void;
  onSelectStage: (stage: EpicStage) => void;
}): React.JSX.Element {
  return (
    <Screen width="app">
      <BackLink label="Events" onClick={onBack} />
      <SectionHeader eyebrow={arc.collection} title={arcLabel(arc)}>
        <p className="mt-2 font-body text-caption text-ground-dim">
          {arc.summary}
        </p>
      </SectionHeader>

      <Alert variant="info" className="mb-3">
        Recommended: strong, levelled teams. These are endgame fights.
      </Alert>

      <div className="flex flex-col gap-2">
        {arc.stages.map((stage) => {
          const lead = stage.encounter.fights[0]?.enemies[0];
          return (
            <EventRowCard
              key={stage.id}
              art={lead ? getCharacterArt(lead.id) : null}
              kicker={`Stage ${stage.order}`}
              title={stage.name}
              summary={stage.caption}
              onSelect={() => onSelectStage(stage)}
              chips={lead?.level ? <Chip>Lv {lead.level}</Chip> : null}
            />
          );
        })}
      </div>
    </Screen>
  );
}

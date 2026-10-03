"use client";

import React from "react";
import { ChevronLeft } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Chip, EventRowCard } from "@/components/game/events/EventCard";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";
import {
  arcLabel,
  type EpicArc,
  type EpicStage,
} from "@/lib/game/epicBattles";

/** "Master Tao · Lv 20" - who the stage's first fight is against. */
export function stageEnemyLine(stage: EpicStage): string {
  return (stage.encounter.fights[0]?.enemies ?? [])
    .filter((pick) => pick.isSub !== true)
    .map((pick) => {
      const name = getCharacterById(pick.id)?.name ?? pick.id;
      return pick.level ? `${name} · Lv ${pick.level}` : name;
    })
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
      <Button variant="link" size="xs" onClick={onBack} className="gap-1 px-0">
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.6} />
        Events
      </Button>
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

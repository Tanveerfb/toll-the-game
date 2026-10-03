"use client";

import React from "react";

import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { panelVariants } from "@/components/ui/Panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import EventCard from "@/components/game/events/EventCard";
import EpicArcList from "@/components/game/events/EpicArcList";
import { EVENTS_TABS, isEventsTab, splitEventsByTab, type EventsTab } from "@/lib/game/eventTabs";
import type { EpicArc } from "@/lib/game/epicBattles";
import { STAMINA_CAP } from "@/lib/game/stamina";
import type { GameEvent } from "@/lib/game/events";

/**
 * The operations board: three tabs - World Boss, Epic Battles, Trials (option A
 * of `docs/design/mockups/events-redesign.html`, Tanveer's pick).
 *
 * The tab labels carry no counts and no sub-labels, and no row shows progress:
 * *"less is more for the players. let them explore on their own."*
 *
 * Visibility and enterability are two different questions and this screen only
 * answers the first - `lockReason` arrives already computed, so the board never
 * re-derives a rule the event module owns (ruling #127). Which events fill
 * which tab is `splitEventsByTab`, by `GameEvent.kind`.
 */
export default function EventsBoard({
  events,
  lockReasonFor,
  stamina,
  accountRank,
  worldLevel,
  onSelect,
  epic,
  tab,
  onTabChange,
}: {
  events: GameEvent[];
  lockReasonFor: (event: GameEvent) => string | null;
  stamina: number;
  accountRank: number;
  worldLevel: number;
  onSelect: (event: GameEvent) => void;
  /** The Epic Battles tab's arcs. */
  epic: {
    arcs: readonly EpicArc[];
    onSelectArc: (arc: EpicArc) => void;
  };
  tab: EventsTab;
  onTabChange: (tab: EventsTab) => void;
}): React.JSX.Element {
  const { boss, trials } = splitEventsByTab(events);

  const rows = (list: GameEvent[]) => (
    <div className="flex flex-col gap-2">
      {list.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          lockReason={lockReasonFor(event)}
          onSelect={() => onSelect(event)}
        />
      ))}
    </div>
  );

  /**
   * QOL, his definition: a list states why it is empty rather than rendering
   * nothing. The world boss is visible from rank 1 so its tab is never empty
   * today, but a trial list can be: the Second Ascension Trial is withheld until
   * the First is cleared, and a future rank-gated set could empty either tab.
   */
  const empty = (line: string) => (
    <p
      className={cn(
        panelVariants({ surface: "paper", density: "none" }),
        "px-3 py-6 text-center font-body text-xs text-muted-foreground",
      )}
    >
      {line}
    </p>
  );

  return (
    <Screen width="app">
      <SectionHeader eyebrow="Operations board" title="Events">
        <p className="mt-2 font-body text-caption text-ground-dim">
          Stamina {stamina} / {STAMINA_CAP} · account rank {accountRank} · world
          level {worldLevel}
        </p>
      </SectionHeader>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isEventsTab(value)) onTabChange(value);
        }}
      >
        <TabsList>
          {EVENTS_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="boss">
          {boss.length > 0
            ? rows(boss)
            : empty("No world boss is open to you yet. Climb account ranks to open one.")}
        </TabsContent>
        <TabsContent value="epic">
          <EpicArcList arcs={epic.arcs} onSelectArc={epic.onSelectArc} />
        </TabsContent>
        <TabsContent value="trials">
          {trials.length > 0
            ? rows(trials)
            : empty("No trials are open to you yet. Climb account ranks to open them.")}
        </TabsContent>
      </Tabs>
    </Screen>
  );
}

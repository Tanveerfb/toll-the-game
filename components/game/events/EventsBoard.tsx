"use client";

import React from "react";

import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventCard from "@/components/game/events/EventCard";
import EpicArcList from "@/components/game/events/EpicArcList";
import {
  EVENTS_TABS,
  isEventsTab,
  resolveEventsTab,
  splitEventsByTab,
  visibleEventsTabs,
  type EventsTab,
} from "@/lib/game/eventTabs";
import type { EpicArc } from "@/lib/game/epicBattles";
import type { GameEvent } from "@/lib/game/events";

/**
 * The operations board: up to three tabs - World Boss, Epic Battles, Trials
 * (option A of `docs/design/mockups/events-redesign.html`, Tanveer's pick).
 *
 * The tab labels carry no counts and no sub-labels, and no row shows progress:
 * *"less is more for the players. let them explore on their own."* A tab with
 * nothing visible is hidden, not drawn empty (`visibleEventsTabs`), and the
 * remembered tab falls back to the first one that remains.
 *
 * Visibility and enterability are two different questions and this screen only
 * answers the first - `lockReason` arrives already computed, so the board never
 * re-derives a rule the event module owns (ruling #127). Which events fill
 * which tab is `splitEventsByTab`, by `GameEvent.kind`.
 */
export default function EventsBoard({
  events,
  lockReasonFor,
  onSelect,
  epic,
  tab,
  onTabChange,
}: {
  events: GameEvent[];
  lockReasonFor: (event: GameEvent) => string | null;
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
  const visible = visibleEventsTabs(events, epic.arcs.length);
  const active = resolveEventsTab(tab, visible);

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

  return (
    <Screen width="app">
      <SectionHeader eyebrow="Operations board" title="Events" />

      {active ? (
        <Tabs
          value={active}
          onValueChange={(value) => {
            if (isEventsTab(value)) onTabChange(value);
          }}
        >
          <TabsList>
            {EVENTS_TABS.filter((t) => visible.includes(t.id)).map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="boss">{rows(boss)}</TabsContent>
          <TabsContent value="epic">
            <EpicArcList arcs={epic.arcs} onSelectArc={epic.onSelectArc} />
          </TabsContent>
          <TabsContent value="trials">{rows(trials)}</TabsContent>
        </Tabs>
      ) : null}
    </Screen>
  );
}

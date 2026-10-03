import type { GameEvent } from "@/lib/game/events";

/**
 * The tabs of the events board (Tanveer picked option A of
 * `docs/design/mockups/events-redesign.html`, 2026-10-03): World Boss, Epic
 * Battles, Trials. The labels carry no counts - his words, *"less is more for
 * the players. let them explore on their own."*
 */
export const EVENTS_TABS = [
  { id: "boss", label: "World Boss" },
  { id: "epic", label: "Epic Battles" },
  { id: "trials", label: "Trials" },
] as const;

export type EventsTab = (typeof EVENTS_TABS)[number]["id"];

export const DEFAULT_EVENTS_TAB: EventsTab = "boss";

export function isEventsTab(value: unknown): value is EventsTab {
  return EVENTS_TABS.some((tab) => tab.id === value);
}

/**
 * Which events fill the two event tabs, by `GameEvent.kind` - never by id, so a
 * second boss or a third trial lands in the right tab with no change here. The
 * Epic Battles tab is not made of events (an arc is not a `GameEvent`).
 */
export function splitEventsByTab(events: readonly GameEvent[]): {
  boss: GameEvent[];
  trials: GameEvent[];
} {
  return {
    boss: events.filter((event) => event.kind === "boss"),
    trials: events.filter((event) => event.kind === "trial"),
  };
}

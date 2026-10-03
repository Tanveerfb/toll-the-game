import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_EVENTS_TAB,
  EVENTS_TABS,
  isEventsTab,
  splitEventsByTab,
} from "@/lib/game/eventTabs";
import { GAME_EVENTS } from "@/lib/game/events";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * The events board is three tabs (option A of events-redesign.html). Tanveer's
 * rules for it: no counts in the tab labels, and nothing on the Epic Battles
 * screens that shows progress - *"less is more for the players"*. Clears are
 * recorded (`epicClears`) and never displayed.
 */

/** Source with comments removed, so a rule about what is DISPLAYED is not
 *  tripped by the comment explaining it. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const read = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("the tabs", () => {
  it("are World Boss, Epic Battles and Trials, in that order, defaulting to the first", () => {
    expect(EVENTS_TABS.map((t) => t.label)).toEqual([
      "World Boss",
      "Epic Battles",
      "Trials",
    ]);
    expect(DEFAULT_EVENTS_TAB).toBe("boss");
    expect(useSettingsStore.getState().eventsTab).toBe("boss");
  });

  it("carry no count or sub-label in their text", () => {
    for (const tab of EVENTS_TABS) {
      expect(tab.label, tab.id).not.toMatch(/\d|\(|·|of /);
    }
    // The board renders the label and nothing else inside a trigger.
    expect(read("components/game/events/EventsBoard.tsx")).toMatch(
      /<TabsTrigger key=\{t\.id\} value=\{t\.id\}>\s*\{t\.label\}\s*<\/TabsTrigger>/,
    );
  });

  it("recognises only its own ids", () => {
    expect(isEventsTab("epic")).toBe(true);
    expect(isEventsTab("missions")).toBe(false);
    expect(isEventsTab(undefined)).toBe(false);
  });

  it("is a device preference: remembered, and never part of the cloud save", () => {
    useSettingsStore.getState().setEventsTab("epic");
    expect(useSettingsStore.getState().eventsTab).toBe("epic");
    useSettingsStore.getState().setEventsTab(DEFAULT_EVENTS_TAB);
    expect(read("lib/game/cloudSave.ts")).not.toMatch(/eventsTab/);
  });
});

describe("splitEventsByTab", () => {
  it("splits by kind, never by id", () => {
    const { boss, trials } = splitEventsByTab(GAME_EVENTS);
    expect(boss.length + trials.length).toBe(GAME_EVENTS.length);
    expect(boss.every((e) => e.kind === "boss")).toBe(true);
    expect(trials.every((e) => e.kind === "trial")).toBe(true);
    expect(boss.map((e) => e.id)).toContain("molvarr");
    expect(trials.length).toBeGreaterThan(0);
  });

  it("puts a boss-kind event in the boss tab whatever it is called", () => {
    const invented = { ...GAME_EVENTS[0], id: "a-brand-new-boss", kind: "boss" as const };
    expect(splitEventsByTab([invented]).boss).toEqual([invented]);
    expect(splitEventsByTab([]).trials).toEqual([]);
  });
});

describe("Epic Battles shows no progress", () => {
  it("the arc row's only chip is the stage count", () => {
    const src = code("components/game/events/EpicArcList.tsx");
    expect(src).toMatch(/stages<\/Chip>/);
    expect(src).not.toMatch(/cleared|Cleared|epicClears|clears/);
  });

  it("the stage rows show the level and no clear record", () => {
    const src = code("components/game/events/EpicArcScreen.tsx");
    expect(src).toMatch(/Lv \{lead\.level\}/);
    expect(src).not.toMatch(/cleared|Cleared|bestTurns|epicClears|clears/);
  });

  it("the result shows this fight's turns, not counts or bests", () => {
    const src = code("components/game/events/ClearSummary.tsx");
    const epic = src.slice(
      src.indexOf("export function EpicClearSummary"),
      src.indexOf("export function TrialClearSummary"),
    );
    expect(epic).toMatch(/Turns/);
    expect(epic).not.toMatch(/Times cleared|totalClears|bestTurns|clears/);
  });

  it("still records every clear", () => {
    expect(read("components/game/events/EpicBattlesFlow.tsx")).toMatch(
      /recordEpicClear\(/,
    );
  });
});

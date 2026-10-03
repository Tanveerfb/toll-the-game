import { describe, expect, it } from "vitest";
import {
  filterAndSort,
  type RosterFilterItem,
  type RosterFilterState,
} from "@/lib/game/rosterFilter";

const item = (over: Partial<RosterFilterItem> & { id: string }): RosterFilterItem => ({
  name: over.id,
  color: "red",
  atk: 100,
  def: 100,
  hp: 3000,
  ...over,
});

const base: RosterFilterState = {
  search: "",
  color: "all",
  sortField: "none",
  sortDir: "desc",
  tags: new Set(),
  mechanics: new Set(),
};

const items = [
  item({ id: "ann", name: "Ann", level: 5, tags: ["Human"] }),
  item({ id: "bo", name: "Bo", color: "blue" }),
  item({ id: "cy", name: "Cy", level: 20, atk: 300 }),
  item({ id: "di", name: "Di", level: 1 }),
];

describe("filterAndSort", () => {
  it("searches name, id and tag", () => {
    expect(filterAndSort(items, { ...base, search: "ann" }).map((i) => i.id)).toEqual(["ann"]);
    expect(filterAndSort(items, { ...base, search: "BO" }).map((i) => i.id)).toEqual(["bo"]);
    expect(filterAndSort(items, { ...base, search: "human" }).map((i) => i.id)).toEqual(["ann"]);
  });

  it("filters by element", () => {
    expect(filterAndSort(items, { ...base, color: "blue" }).map((i) => i.id)).toEqual(["bo"]);
  });

  it("sorts by level with unowned (no level) last in both directions", () => {
    const desc = filterAndSort(items, { ...base, sortField: "level", sortDir: "desc" });
    expect(desc.map((i) => i.id)).toEqual(["cy", "ann", "di", "bo"]);
    const asc = filterAndSort(items, { ...base, sortField: "level", sortDir: "asc" });
    expect(asc.map((i) => i.id)).toEqual(["di", "ann", "cy", "bo"]);
  });

  it("sorts by a stat", () => {
    const rows = filterAndSort(items, { ...base, sortField: "atk", sortDir: "desc" });
    expect(rows[0].id).toBe("cy");
  });
});

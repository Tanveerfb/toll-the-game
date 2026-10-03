"use client";

import React from "react";
import {
  filterAndSort,
  type RosterColor,
  type RosterFilterItem,
  type SortDir,
  type SortField,
} from "@/lib/game/rosterFilter";

export interface RosterFilters<T extends RosterFilterItem> {
  search: string;
  setSearch: (value: string) => void;
  color: "all" | RosterColor;
  setColor: (value: "all" | RosterColor) => void;
  sortField: SortField;
  sortDir: SortDir;
  /** Picks a field, or flips the direction when it is already the one in force. */
  onSort: (field: Exclude<SortField, "none">) => void;
  tags: ReadonlySet<string>;
  toggleTag: (tag: string) => void;
  mechanics: ReadonlySet<string>;
  toggleMechanic: (mechanic: string) => void;
  /** Every tag / mechanic the list carries, for the sheet's chips. */
  allTags: string[];
  allMechanics: string[];
  /** The items after search, filters and sort. */
  filtered: T[];
  /** Filters set inside the sheet (element, sort, tags, mechanics). */
  sheetCount: number;
  /** Anything to clear: a filter, a sort or a search. */
  isFiltered: boolean;
  clearAll: () => void;
}

function toggled(set: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/**
 * The state behind a searchable, sortable, filterable roster: the archive's
 * grid and the team picker's sheet. Ownership is not here; it is one screen's
 * concern, so a caller narrows `filtered` itself.
 */
export function useRosterFilters<T extends RosterFilterItem>(
  items: readonly T[],
): RosterFilters<T> {
  const [search, setSearch] = React.useState("");
  const [color, setColor] = React.useState<"all" | RosterColor>("all");
  const [sortField, setSortField] = React.useState<SortField>("none");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [tags, setTags] = React.useState<ReadonlySet<string>>(new Set());
  const [mechanics, setMechanics] = React.useState<ReadonlySet<string>>(new Set());

  const allTags = React.useMemo(
    () => [...new Set(items.flatMap((c) => c.tags ?? []))].sort(),
    [items],
  );
  const allMechanics = React.useMemo(
    () => [...new Set(items.flatMap((c) => c.mechanics ?? []))].sort(),
    [items],
  );

  const filtered = React.useMemo(
    () => filterAndSort(items, { search, color, sortField, sortDir, tags, mechanics }),
    [items, search, color, sortField, sortDir, tags, mechanics],
  );

  const onSort = (field: Exclude<SortField, "none">) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sheetCount =
    tags.size + mechanics.size + (color !== "all" ? 1 : 0) + (sortField !== "none" ? 1 : 0);

  return {
    search,
    setSearch,
    color,
    setColor,
    sortField,
    sortDir,
    onSort,
    tags,
    toggleTag: (tag) => setTags((s) => toggled(s, tag)),
    mechanics,
    toggleMechanic: (m) => setMechanics((s) => toggled(s, m)),
    allTags,
    allMechanics,
    filtered,
    sheetCount,
    isFiltered: sheetCount > 0 || search !== "",
    clearAll: () => {
      setTags(new Set());
      setMechanics(new Set());
      setColor("all");
      setSortField("none");
      setSearch("");
    },
  };
}

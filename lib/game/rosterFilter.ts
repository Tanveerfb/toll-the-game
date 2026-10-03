/**
 * Search, filter and sort for a list of characters: the pure half of the
 * archive and the team picker's roster sheet, which share it (audit 4.1,
 * 2026-10-03). The React half is `hooks/useRosterFilters`; the controls are
 * `components/game/RosterToolbar`.
 */

export type RosterColor = "light" | "red" | "blue" | "green" | "dark";

export type SortField = "none" | "level" | "atk" | "def" | "hp";
export type SortDir = "asc" | "desc";

/** What a list needs to carry to be searched, filtered and sorted. */
export interface RosterFilterItem {
  id: string;
  name: string;
  color: RosterColor;
  atk: number;
  def: number;
  hp: number;
  tags?: string[];
  mechanics?: string[];
  /** Set only for a unit the player owns. A unit without one sorts last under
   *  the Level sort, in either direction. */
  level?: number;
}

export interface RosterFilterState {
  search: string;
  color: "all" | RosterColor;
  sortField: SortField;
  sortDir: SortDir;
  tags: ReadonlySet<string>;
  mechanics: ReadonlySet<string>;
}

export const SORT_LABELS: Record<Exclude<SortField, "none">, string> = {
  level: "Level",
  atk: "ATK",
  def: "DEF",
  hp: "HP",
};

/** Matches name, id or tag; blank matches everything. */
export function matchesSearch(item: RosterFilterItem, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (q.length === 0) return true;
  return (
    item.name.toLowerCase().includes(q) ||
    item.id.toLowerCase().includes(q) ||
    (item.tags ?? []).some((t) => t.toLowerCase().includes(q))
  );
}

/** Applies the state's search, element, tag and mechanic filters, then its sort. */
export function filterAndSort<T extends RosterFilterItem>(
  items: readonly T[],
  state: RosterFilterState,
): T[] {
  const rows = items.filter(
    (item) =>
      matchesSearch(item, state.search) &&
      (state.color === "all" || item.color === state.color) &&
      // A facet matches if the item carries ANY of the selected values.
      (state.tags.size === 0 || (item.tags ?? []).some((t) => state.tags.has(t))) &&
      (state.mechanics.size === 0 ||
        (item.mechanics ?? []).some((m) => state.mechanics.has(m))),
  );

  const { sortField, sortDir } = state;
  if (sortField === "none") return rows;
  const dir = sortDir === "asc" ? 1 : -1;
  if (sortField === "level") {
    return rows.sort((a, b) => {
      if (a.level === undefined && b.level === undefined) return 0;
      if (a.level === undefined) return 1;
      if (b.level === undefined) return -1;
      return (a.level - b.level) * dir;
    });
  }
  return rows.sort((a, b) => (a[sortField] - b[sortField]) * dir);
}

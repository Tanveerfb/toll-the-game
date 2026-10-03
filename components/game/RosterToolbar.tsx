"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PanelSheet from "@/components/ui/PanelSheet";
import { Toggle } from "@/components/ui/toggle";
import type { RosterFilters } from "@/hooks/useRosterFilters";
import { EL_HUE } from "@/lib/game/elementStyle";
import {
  SORT_LABELS,
  type RosterFilterItem,
  type SortField,
} from "@/lib/game/rosterFilter";

/**
 * The search box, the filter sheet and the "sort in force / Clear" line for a
 * roster, driven by `useRosterFilters`. The archive's grid and the team
 * picker's character sheet both mount it, so the two cannot drift (audit 4.1,
 * 2026-10-03; it was inline in `CharacterBrowser` until then).
 *
 * Search, and everything else behind one button. Measured on the live build
 * 2026-09-01: the furniture above the first character card ran to 553px on an
 * 844px screen, 65% of the phone, because nine controls sat in the open. The
 * sheet is the pattern battle already uses for exactly this reason (ruling
 * #118). It is the shadcn `Sheet` (ruling #154), which portals to <body>
 * itself, so it also opens from inside a dialog.
 */

const COLOR_OPTIONS: Array<{ id: "all" | keyof typeof EL_HUE; label: string }> = [
  { id: "all", label: "All" },
  { id: "light", label: "Light" },
  { id: "red", label: "Red" },
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
  { id: "dark", label: "Dark" },
];

function toTitleCase(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One labelled row of chips inside the filter sheet. */
export function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <p className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * One filter chip: the shadcn `Toggle` (ruling #154). On, it is the action
 * yellow; an element chip is on in its own hue instead, which is a fill with
 * ink on it and so reads on the paper sheet it sits in.
 */
export function FilterChip({
  active,
  hue,
  onClick,
  children,
}: {
  active: boolean;
  hue?: string;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={active}
      onPressedChange={onClick}
      // `color:` is required: without the hint `bg-(--tint)` is ambiguous
      // between a colour and an image, and emitted nothing that painted.
      className={hue ? "data-[state=on]:bg-(color:--tint)" : undefined}
      style={hue ? ({ "--tint": hue } as React.CSSProperties) : undefined}
    >
      {children}
    </Toggle>
  );
}

export default function RosterToolbar<T extends RosterFilterItem>({
  filters,
  sortFields,
  extraGroups,
  extraCount = 0,
  surface = "ground",
}: {
  filters: RosterFilters<T>;
  /** The sorts on offer: a screen with no levels to show leaves Level out. */
  sortFields: Array<Exclude<SortField, "none">>;
  /** Filter groups only this screen has (the archive's owned-only toggle). */
  extraGroups?: React.ReactNode;
  /** How many of those are on, so the Filters badge and Clear see them. */
  extraCount?: number;
  /** What the toolbar sits on, which decides the status line's text colour
   *  (light on the ground, ink on paper; never the other way round). */
  surface?: "ground" | "paper";
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const { sortField, sortDir } = filters;
  // What the Filters button reports. Wider than tags and mechanics on purpose:
  // element and sort are inside the sheet too, so a count that ignored them
  // would leave the list visibly filtered with the button reading zero.
  const sheetCount = filters.sheetCount + extraCount;
  const showClear = filters.isFiltered || extraCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={filters.search}
          onChange={(event) => filters.setSearch(event.target.value)}
          // Still matches name, id and tag; the box does not advertise "id".
          placeholder="Search"
          aria-label="Search characters"
          className="min-w-0 flex-1"
        />
        <PanelSheet
          open={open}
          onOpenChange={setOpen}
          title="Filter & sort"
          // Done in the thumb third, not only the corner X.
          closeLabel="Done"
          trigger={
            // The count rides a yellow badge while any filter is on, so a
            // filtered list never passes for the whole roster.
            <Button variant="secondary" size="sm" className="shrink-0">
              Filters
              {sheetCount > 0 ? <Badge>{sheetCount}</Badge> : null}
            </Button>
          }
        >
          <FilterGroup label="Element">
            {COLOR_OPTIONS.map((option) => (
              <FilterChip
                key={option.id}
                active={filters.color === option.id}
                hue={option.id === "all" ? undefined : EL_HUE[option.id]}
                onClick={() => filters.setColor(option.id)}
              >
                {option.label}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label="Sort">
            {sortFields.map((field) => (
              <FilterChip
                key={field}
                active={sortField === field}
                onClick={() => filters.onSort(field)}
              >
                {SORT_LABELS[field]}
                {sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
              </FilterChip>
            ))}
          </FilterGroup>

          {extraGroups}

          {filters.allTags.length > 0 ? (
            <FilterGroup label="Tags">
              {filters.allTags.map((tag) => (
                <FilterChip
                  key={tag}
                  active={filters.tags.has(tag)}
                  onClick={() => filters.toggleTag(tag)}
                >
                  {tag}
                </FilterChip>
              ))}
            </FilterGroup>
          ) : null}

          {filters.allMechanics.length > 0 ? (
            <FilterGroup label="Mechanics">
              {filters.allMechanics.map((mech) => (
                <FilterChip
                  key={mech}
                  active={filters.mechanics.has(mech)}
                  onClick={() => filters.toggleMechanic(mech)}
                >
                  {toTitleCase(mech)}
                </FilterChip>
              ))}
            </FilterGroup>
          ) : null}
        </PanelSheet>
      </div>

      {/* The sort in force, and the way out of every filter. */}
      {sortField !== "none" || showClear ? (
        <div
          className={`flex items-baseline justify-between gap-2 font-body text-caption font-bold uppercase tracking-label ${surface === "ground" ? "text-ground-dim" : "text-muted-foreground"}`}
        >
          <span>
            {sortField !== "none"
              ? `${SORT_LABELS[sortField]} ${sortDir === "asc" ? "↑" : "↓"}`
              : ""}
          </span>
          {showClear ? (
            <Button variant="link" size="sm" onClick={filters.clearAll}>
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { panelVariants } from "@/components/ui/Panel";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { getCharacterArt } from "@/lib/game/characterArt";
import { archiveHref } from "@/lib/game/characterCatalog";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { progressedStats } from "@/lib/game/progression";

type CharacterColor = "light" | "red" | "blue" | "green" | "dark";

export interface CharacterBrowserItem {
  id: string;
  /** The archive URL's public handle - see `archiveHref`. */
  cardNumber: number;
  /** The title above the name (ruling #141). */
  heading?: string;
  name: string;
  color: CharacterColor;
  atk: number;
  def: number;
  hp: number;
  tags?: string[];
  mechanics?: string[];
}

interface CharacterBrowserProps {
  characters: CharacterBrowserItem[];
  /**
   * Whether these characters can be owned at all.
   *
   * `false` for the NPC index: story-only kits are never acquirable, so
   * Locked badges, the grayscale treatment, the level/ascension pip and the
   * owned-only filter are all answering a question that doesn't apply to them.
   */
  ownership?: boolean;
}

const COLOR_OPTIONS: Array<{ id: "all" | CharacterColor; label: string }> = [
  { id: "all", label: "All" },
  { id: "light", label: "Light" },
  { id: "red", label: "Red" },
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
  { id: "dark", label: "Dark" },
];

type SortField = "none" | "hp" | "atk" | "def";
type SortDir = "asc" | "desc";
const SORT_FIELDS: Array<{ id: Exclude<SortField, "none">; label: string }> = [
  { id: "atk", label: "ATK" },
  { id: "def", label: "DEF" },
  { id: "hp", label: "HP" },
];

// One hue per element, and nothing else in the UI is allowed to use them —
// system chrome is the action yellow (ruling #154). The 3-letter codes ride in the tile corner
// where the word wouldn't fit at a 5-column density.
const EL_HUE: Record<CharacterColor, string> = {
  light: "var(--color-el-light)",
  red: "var(--color-el-red)",
  blue: "var(--color-el-blue)",
  green: "var(--color-el-green)",
  dark: "var(--color-el-dark)",
};
const EL_CODE: Record<CharacterColor, string> = {
  light: "LGT",
  red: "RED",
  blue: "BLU",
  green: "GRN",
  dark: "DRK",
};

function toTitleCase(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}



/** One labelled row of chips inside the filter sheet. */
function FilterGroup({
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
function FilterChip({
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

/** Labelled micro-bar. The raw number stays — the bar only adds the shape. */
function StatBar({
  label,
  value,
  barValue = value,
  max,
  hue,
}: {
  label: string;
  /** The number shown — the player's progressed stat on an owned unit. */
  value: number;
  /** What the bar fills from; the catalog base, so the roster comparison
   *  stays level-invariant. See CharacterStatBars for the full reasoning. */
  barValue?: number;
  max: number;
  hue: string;
}): React.JSX.Element {
  return (
    // 26px, the same label column `CharacterStatBars` uses: "ATK" at the
    // 10px floor is 24px wide and clipped the old 22px column.
    <div className="mt-0.5 grid grid-cols-[26px_1fr_auto] items-center gap-1.5">
      <span className="font-body text-label font-bold uppercase tracking-label text-muted-foreground">
        {label}
      </span>
      <span className="block h-1 bg-muted">
        <span
          className="block h-full"
          style={{
            width: `${Math.min(100, Math.round((barValue / max) * 100))}%`,
            backgroundColor: hue,
          }}
        />
      </span>
      <span className="font-body text-caption font-bold tabular-nums">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

export default function CharacterBrowser({
  characters,
  ownership = true,
}: CharacterBrowserProps): React.JSX.Element {
  const [searchValue, setSearchValue] = React.useState("");
  const [selectedColor, setSelectedColor] = React.useState<
    "all" | CharacterColor
  >("all");
  const [sortField, setSortField] = React.useState<SortField>("none");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [selectedTags, setSelectedTags] = React.useState<Set<string>>(
    new Set(),
  );
  const [selectedMechs, setSelectedMechs] = React.useState<Set<string>>(
    new Set(),
  );
  // The filter sheet is the shadcn `Sheet` (2026-09-26, ruling #154). It
  // portals to <body> itself, which is what `tests/overlayStacking` exists
  // for, and brings Escape, the backdrop, the focus trap and focus return.
  const [showFilters, setShowFilters] = React.useState(false);

  const roster = usePlayerStore((s) => s.roster);
  const characterProgress = usePlayerStore((s) => s.characters);
  const hasHydratedStore = usePlayerStore((s) => s.hasHydrated);
  // The archive took over the roster listing from `/profile`, so by default it
  // shows what you own. Unowned units are one click away, not gone.
  const showUnownedSetting = useSettingsStore((s) => s.showUnownedCharacters);
  const setShowUnowned = useSettingsStore((s) => s.setShowUnownedCharacters);
  const ownedIds = React.useMemo(() => new Set(roster), [roster]);

  // The NPC index lists story-only kits, which **cannot be acquired**. Running
  // them through the ownership treatment marked every one Locked and greyed
  // them out — a permanent lock on something that was never a lock, and the
  // owned-only default hid the entire page behind a toggle (Tanveer,
  // 2026-08-13).
  //
  // Collapsing the two flags here rather than branching at every use keeps the
  // rest of the component honest: with ownership off, nothing is unowned, so
  // no filter runs, no toggle renders and no tile dims.
  const showUnowned = ownership ? showUnownedSetting : true;
  const hasHydrated = ownership ? hasHydratedStore : false;

  const allTags = React.useMemo(() => {
    const s = new Set<string>();
    characters.forEach((c) => (c.tags ?? []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [characters]);
  const allMechs = React.useMemo(() => {
    const s = new Set<string>();
    characters.forEach((c) => (c.mechanics ?? []).forEach((m) => s.add(m)));
    return [...s].sort();
  }, [characters]);

  // Bars are scaled against the whole population, never the filtered view —
  // otherwise every filter click silently rescales the bars and a unit looks
  // stronger just because the tanks were filtered out.
  const statMax = React.useMemo(() => {
    const peak = (pick: (c: CharacterBrowserItem) => number) =>
      Math.max(1, ...characters.map(pick));
    return {
      hp: peak((c) => c.hp),
      atk: peak((c) => c.atk),
      def: peak((c) => c.def),
    };
  }, [characters]);

  const toggleIn = (
    set: Set<string>,
    setter: (s: Set<string>) => void,
    value: string,
  ) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const activeFilterCount = selectedTags.size + selectedMechs.size;
  // What the Filters button reports. Wider than `activeFilterCount` on
  // purpose: element, sort and show-locked are inside the sheet now, so a
  // count that ignored them would leave the grid visibly filtered with the
  // button reading zero.
  const sheetCount =
    activeFilterCount +
    (selectedColor !== "all" ? 1 : 0) +
    (sortField !== "none" ? 1 : 0) +
    (ownership && showUnowned ? 1 : 0);

  const filtered = React.useMemo(() => {
    const normalized = searchValue.trim().toLowerCase();
    const rows = characters.filter((character) => {
      const matchesSearch =
        normalized.length === 0 ||
        character.name.toLowerCase().includes(normalized) ||
        character.id.toLowerCase().includes(normalized) ||
        (character.tags ?? []).some((t) =>
          t.toLowerCase().includes(normalized),
        );
      const matchesColor =
        selectedColor === "all" || character.color === selectedColor;
      // A facet matches if the item carries ANY of the selected values.
      const matchesTags =
        selectedTags.size === 0 ||
        (character.tags ?? []).some((t) => selectedTags.has(t));
      const matchesMechs =
        selectedMechs.size === 0 ||
        (character.mechanics ?? []).some((m) => selectedMechs.has(m));
      // Ownership can only be judged once the store has rehydrated; before
      // that everything shows, same reason the tiles hold back their state
      // label rather than flashing "Locked" on a unit you own.
      const matchesOwned =
        showUnowned || !hasHydrated || ownedIds.has(character.id);
      return (
        matchesSearch &&
        matchesColor &&
        matchesTags &&
        matchesMechs &&
        matchesOwned
      );
    });

    if (sortField !== "none") {
      const dir = sortDir === "asc" ? 1 : -1;
      rows.sort((a, b) => (a[sortField] - b[sortField]) * dir);
    }
    return rows;
  }, [
    characters,
    searchValue,
    selectedColor,
    selectedTags,
    selectedMechs,
    sortField,
    sortDir,
    showUnowned,
    hasHydrated,
    ownedIds,
  ]);

  const hiddenByOwnership =
    hasHydrated && !showUnowned
      ? characters.filter((c) => !ownedIds.has(c.id)).length
      : 0;

  const onSort = (field: Exclude<SortField, "none">) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const clearAll = () => {
    setSelectedTags(new Set());
    setSelectedMechs(new Set());
    setSelectedColor("all");
    setSortField("none");
    setSearchValue("");
  };

  return (
    <section className="space-y-3">
      {/* Toolbar — search, and everything else behind one button.
          Measured on the live build 2026-09-01: the furniture above the first
          character card ran to **553px on an 844px screen**, 65% of the phone,
          because nine controls sat in the open and three of them wrapped to a
          row of their own. The sheet is the pattern battle already uses for
          exactly this reason (ruling #118), so this is reuse rather than a new
          idea. */}
      <div className="flex items-center gap-2">
        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Query name, id, tag"
          aria-label="Search characters"
          className="min-w-0 flex-1"
        />
        <Sheet open={showFilters} onOpenChange={setShowFilters}>
          <SheetTrigger asChild>
            {/* The count rides a yellow badge while any filter is on, so a
                filtered grid never passes for the whole roster. */}
            <Button variant="secondary" size="sm" className="shrink-0">
              Filters
              {sheetCount > 0 ? <Badge>{sheetCount}</Badge> : null}
            </Button>
          </SheetTrigger>
          <SheetContent aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>Filter &amp; sort</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 px-4">
              <FilterGroup label="Element">
                {COLOR_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.id}
                    active={selectedColor === option.id}
                    hue={option.id === "all" ? undefined : EL_HUE[option.id]}
                    onClick={() => setSelectedColor(option.id)}
                  >
                    {option.label}
                  </FilterChip>
                ))}
              </FilterGroup>

              <FilterGroup label="Sort">
                {SORT_FIELDS.map((f) => (
                  <FilterChip
                    key={f.id}
                    active={sortField === f.id}
                    onClick={() => onSort(f.id)}
                  >
                    {f.label}
                    {sortField === f.id ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </FilterChip>
                ))}
              </FilterGroup>

              {/* Owned-only is the default view, so the control that changes it
                  says what it would reveal rather than what it currently is.
                  Absent entirely where nothing can be owned. */}
              {ownership ? (
                <FilterGroup label="Show">
                  <FilterChip
                    active={showUnowned}
                    onClick={() => setShowUnowned(!showUnowned)}
                  >
                    {showUnowned
                      ? "Owned only"
                      : `Locked units${hiddenByOwnership > 0 ? ` (${hiddenByOwnership})` : ""}`}
                  </FilterChip>
                </FilterGroup>
              ) : null}

              {allTags.length > 0 ? (
                <FilterGroup label="Tags">
                  {allTags.map((tag) => (
                    <FilterChip
                      key={tag}
                      active={selectedTags.has(tag)}
                      onClick={() => toggleIn(selectedTags, setSelectedTags, tag)}
                    >
                      {tag}
                    </FilterChip>
                  ))}
                </FilterGroup>
              ) : null}

              {allMechs.length > 0 ? (
                <FilterGroup label="Mechanics">
                  {allMechs.map((mech) => (
                    <FilterChip
                      key={mech}
                      active={selectedMechs.has(mech)}
                      onClick={() => toggleIn(selectedMechs, setSelectedMechs, mech)}
                    >
                      {toTitleCase(mech)}
                    </FilterChip>
                  ))}
                </FilterGroup>
              ) : null}
            </div>
            {/* Done in the thumb third, not only the corner X. */}
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="secondary">Done</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* What the toolbar used to say by showing every control at once. */}
      <div className="flex items-baseline justify-between gap-2 font-body text-caption font-bold uppercase tracking-label text-ground-dim">
        <span className="tabular-nums">
          <b className="font-bold text-primary">{filtered.length}</b> /{" "}
          {hasHydrated && !showUnowned ? ownedIds.size : characters.length}{" "}
          units
          {sortField !== "none"
            ? ` · ${sortField.toUpperCase()} ${sortDir === "asc" ? "↑" : "↓"}`
            : ""}
        </span>
        {sheetCount > 0 || searchValue ? (
          <Button variant="link" size="sm" onClick={clearAll}>
            Clear
          </Button>
        ) : null}
      </div>


      {/* Unit grid */}
      {filtered.length === 0 ? (
        <div
          className={cn(
            panelVariants({ surface: "paper", density: "none" }),
            "flex flex-col items-center gap-3 py-10 text-center",
          )}
        >
          <p className="font-body text-sm font-bold uppercase tracking-eyebrow text-muted-foreground">
            No units match this query.
          </p>
          {/* Without this, an empty grid on a fresh account reads as a bug
              rather than as "you own one character and it's filtered out". */}
          {hiddenByOwnership > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowUnowned(true)}
            >
              {hiddenByOwnership} locked unit
              {hiddenByOwnership === 1 ? " is" : "s are"} hidden — show them
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((character) => {
            const hue = EL_HUE[character.color];
            const art = getCharacterArt(character.id);
            const owned = hasHydrated && ownedIds.has(character.id);
            const progress = characterProgress[character.id];
            const ultLevel = progress?.ultLevel ?? 1;
            const level = progress?.level ?? 1;
            const ascension = progress?.ascension ?? 0;
            // Pre-hydration we don't know what's owned, so the tile shows no
            // state label at all rather than flashing "Locked" on an owned unit.
            const locked = hasHydrated && !owned;
            // The tile's numbers are what this unit actually fights at. Sort
            // and the bar fills stay on base stats — one progression curve
            // scales all three equally, so ordering never changes, and mixing
            // owned and locked units on one axis would.
            const shown =
              owned && progress ? progressedStats(character, progress) : character;
            return (
              // `hover:border-(--el)` emits nothing: `border-` is ambiguous
              // between width and colour, so the `color:` hint is required.
              // `text-(--el)` below needs no hint — it defaults to colour.
              <Link
                key={character.id}
                href={archiveHref(character)}
                className={cn(
                  panelVariants({ surface: "paper", density: "none", press: true }),
                  "group flex flex-col hover:border-(color:--el)",
                )}
                style={{ "--el": hue } as React.CSSProperties}
              >
                <div className="relative aspect-square overflow-hidden border-b-2 border-border bg-muted">
                  {art ? (
                    <Image
                      src={art}
                      alt={character.name}
                      width={512}
                      height={512}
                      className={`h-full w-full object-cover transition-transform group-hover:scale-105 ${
                        locked ? "grayscale brightness-50" : ""
                      }`}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-heading text-6xl text-muted-foreground">
                      {character.name.charAt(0)}
                    </span>
                  )}
                  <span
                    className="absolute left-0 top-0 border-b-2 border-r-2 border-border px-1.5 py-0.5 font-body text-label font-bold tracking-label text-card-foreground"
                    style={{ backgroundColor: hue }}
                  >
                    {EL_CODE[character.color]}
                  </span>
                  {/* This corner used to read "Active" — true but useless.
                      The archive is the roster screen now, so it carries the
                      investment: level, ascension band, ult rank. */}
                  {hasHydrated ? (
                    <span
                      aria-label={
                        owned
                          ? `Level ${level}${ascension > 0 ? `, ascension ${ascension}` : ""}${ultLevel > 1 ? `, ultimate ${ultLevel}` : ""}`
                          : "Not yet recruited"
                      }
                      // An ink label on the art, lettered in the element's
                      // hue: it sits on the picture, not on paper, so the hue
                      // reads as text here.
                      className="absolute bottom-0 right-0 border-l-2 border-t-2 border-border bg-card-foreground/90 px-1.5 py-0.5 font-body text-label font-bold uppercase tracking-label tabular-nums"
                      style={{
                        color: owned ? hue : "var(--ground-dim)",
                      }}
                    >
                      {owned
                        ? `Lv ${level}${ascension > 0 ? ` · A${ascension}` : ""}${ultLevel > 1 ? ` · U${ultLevel}` : ""}`
                        : "Locked"}
                    </span>
                  ) : null}
                </div>

                <div className="px-2 py-2">
                  {/* Heading above the name (#141). This tile has a dedicated
                      text block under the art, so the line costs ~10px and
                      crowds nothing. */}
                  {character.heading ? (
                    <p className="truncate font-body text-label font-bold uppercase tracking-label text-muted-foreground">
                      {character.heading}
                    </p>
                  ) : null}
                  <p className="truncate font-heading text-lg tracking-title">
                    {character.name}
                  </p>
                  <StatBar
                    label="Hp"
                    value={shown.hp}
                    barValue={character.hp}
                    max={statMax.hp}
                    hue={hue}
                  />
                  <StatBar
                    label="Atk"
                    value={shown.atk}
                    barValue={character.atk}
                    max={statMax.atk}
                    hue={hue}
                  />
                  <StatBar
                    label="Def"
                    value={shown.def}
                    barValue={character.def}
                    max={statMax.def}
                    hue={hue}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

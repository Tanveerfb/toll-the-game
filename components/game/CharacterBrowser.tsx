"use client";

import { Button } from "@/components/ui/button";
import React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { getCharacterArt } from "@/lib/game/characterArt";
import { archiveHref } from "@/lib/game/characterCatalog";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { progressedStats } from "@/lib/game/progression";
import { useEscapeKey, scrimProps } from "@/hooks/useEscapeKey";

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
// system chrome is `signal` cyan. The 3-letter codes ride in the tile corner
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

/** Never resubscribes — it exists only so the server snapshot and the client
 *  snapshot differ, which is how a client-only branch stays hydration-safe. */
const NO_SUBSCRIBE = () => () => {};

const CHIP_BASE =
  "chamfer min-h-11 min-w-11 border px-3 py-1.5 font-body text-[11px] font-bold uppercase tracking-label transition-colors";
const CHIP_OFF =
  "border-edge bg-void/60 text-readout-dim hover:border-edge-strong hover:text-readout";

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
      <p className="font-body text-[10px] font-bold uppercase tracking-eyebrow text-readout-muted">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Toggle({
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
  const tint = hue ?? "var(--color-signal)";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${CHIP_BASE} ${active ? "text-void" : CHIP_OFF}`}
      style={
        active ? { backgroundColor: tint, borderColor: tint } : undefined
      }
    >
      {children}
    </button>
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
    <div className="mt-0.5 grid grid-cols-[22px_1fr_auto] items-center gap-1.5">
      <span className="font-body text-[9px] font-bold uppercase tracking-label text-readout-muted">
        {label}
      </span>
      <span className="block h-[3px] bg-hairline">
        <span
          className="block h-full"
          style={{
            width: `${Math.min(100, Math.round((barValue / max) * 100))}%`,
            backgroundColor: hue,
          }}
        />
      </span>
      <span className="font-body text-[11px] font-semibold tabular-nums text-readout-dim">
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
  const [showFilters, setShowFilters] = React.useState(false);
  // Portalled to <body> rather than rendered in place: `tests/overlayStacking`
  // exists because the Growth modal once rendered *behind* the kit document,
  // trapped by an `lg:sticky` ancestor that established a containing block.
  // Nothing failed then either — it just looked broken.
  const mountedInDom = React.useSyncExternalStore(
    NO_SUBSCRIBE,
    () => true,
    () => false,
  );
  useEscapeKey(() => setShowFilters(false), showFilters);

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
        {/* `dark:bg-input/30` ships inside the shadcn Input and the app is
            permanently in dark mode, so the panel fill has to be restated as a
            dark: variant or the plain utility loses the merge. */}
        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Query name, id, tag"
          aria-label="Search characters"
          className="chamfer h-11 min-w-0 flex-1 rounded-none border border-edge bg-panel font-body text-readout placeholder:text-readout-muted focus-visible:border-signal focus-visible:ring-0 dark:bg-panel"
        />
        <Toggle
          active={sheetCount > 0}
          onClick={() => setShowFilters(true)}
        >
          Filters{sheetCount > 0 ? ` (${sheetCount})` : ""}
        </Toggle>
      </div>

      {/* What the toolbar used to say by showing every control at once. */}
      <div className="flex items-baseline justify-between gap-2 font-body text-[11px] font-bold uppercase tracking-label text-readout-muted">
        <span className="tabular-nums">
          <b className="font-bold text-signal">{filtered.length}</b> /{" "}
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

      {/* The sheet. Bottom-anchored for the same reason battle's is: every
          control in it is one a thumb has to reach. */}
      {showFilters && mountedInDom
        ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter and sort"
          className="fixed inset-0 z-50 flex flex-col justify-end bg-void/70 backdrop-blur-sm"
          {...scrimProps(() => setShowFilters(false))}
        >
          <div className="pb-safe max-h-[85dvh] overflow-y-auto border-t border-edge-strong bg-panel px-3 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.7)]">
            <span className="mx-auto mb-3 block h-1 w-11 bg-edge-strong" />
            <div className="mb-3 flex items-center justify-between">
              <p className="font-body text-[10px] font-bold uppercase tracking-eyebrow text-readout-muted">
                Filter &amp; sort
              </p>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="min-h-11 px-2 font-body text-[11px] font-bold uppercase tracking-label text-signal"
              >
                Done
              </button>
            </div>

            <div className="space-y-3">
              <FilterGroup label="Element">
                {COLOR_OPTIONS.map((option) => (
                  <Toggle
                    key={option.id}
                    active={selectedColor === option.id}
                    hue={option.id === "all" ? undefined : EL_HUE[option.id]}
                    onClick={() => setSelectedColor(option.id)}
                  >
                    {option.label}
                  </Toggle>
                ))}
              </FilterGroup>

              <FilterGroup label="Sort">
                {SORT_FIELDS.map((f) => (
                  <Toggle
                    key={f.id}
                    active={sortField === f.id}
                    onClick={() => onSort(f.id)}
                  >
                    {f.label}
                    {sortField === f.id ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </Toggle>
                ))}
              </FilterGroup>

              {/* Owned-only is the default view, so the control that changes it
                  says what it would reveal rather than what it currently is.
                  Absent entirely where nothing can be owned. */}
              {ownership ? (
                <FilterGroup label="Show">
                  <Toggle
                    active={showUnowned}
                    onClick={() => setShowUnowned(!showUnowned)}
                  >
                    {showUnowned
                      ? "Owned only"
                      : `Locked units${hiddenByOwnership > 0 ? ` (${hiddenByOwnership})` : ""}`}
                  </Toggle>
                </FilterGroup>
              ) : null}

              {allTags.length > 0 ? (
                <FilterGroup label="Tags">
                  {allTags.map((tag) => (
                    <Toggle
                      key={tag}
                      active={selectedTags.has(tag)}
                      onClick={() => toggleIn(selectedTags, setSelectedTags, tag)}
                    >
                      {tag}
                    </Toggle>
                  ))}
                </FilterGroup>
              ) : null}

              {allMechs.length > 0 ? (
                <FilterGroup label="Mechanics">
                  {allMechs.map((mech) => (
                    <Toggle
                      key={mech}
                      active={selectedMechs.has(mech)}
                      onClick={() => toggleIn(selectedMechs, setSelectedMechs, mech)}
                    >
                      {toTitleCase(mech)}
                    </Toggle>
                  ))}
                </FilterGroup>
              ) : null}
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}

      {/* Unit grid */}
      {filtered.length === 0 ? (
        <div className="chamfer-lg flex flex-col items-center gap-3 border border-edge bg-panel py-10 text-center">
          <p className="font-body text-sm font-bold uppercase tracking-eyebrow text-readout-muted">
            No units match this query.
          </p>
          {/* Without this, an empty grid on a fresh account reads as a bug
              rather than as "you own one character and it's filtered out". */}
          {hiddenByOwnership > 0 ? (
            <button
              type="button"
              onClick={() => setShowUnowned(true)}
              className="chamfer border border-edge px-3 py-1.5 font-body text-[11px] font-bold uppercase tracking-label text-signal transition-colors hover:border-signal"
            >
              {hiddenByOwnership} locked unit
              {hiddenByOwnership === 1 ? " is" : "s are"} hidden — show them
            </button>
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
                className="chamfer-lg group flex flex-col border border-edge bg-panel transition-colors hover:border-(color:--el)"
                style={{ "--el": hue } as React.CSSProperties}
              >
                <div className="relative aspect-square overflow-hidden bg-inset">
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
                    <span className="flex h-full w-full items-center justify-center font-heading text-6xl text-readout-dim">
                      {character.name.charAt(0)}
                    </span>
                  )}
                  <span
                    className="absolute left-0 top-0 px-1.5 py-0.5 font-body text-[10px] font-bold tracking-label text-void"
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
                      className="absolute bottom-0 right-0 border-l border-t border-edge bg-void/85 px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-label tabular-nums"
                      style={{
                        color: owned ? hue : "var(--color-readout-muted)",
                      }}
                    >
                      {owned
                        ? `Lv ${level}${ascension > 0 ? ` · A${ascension}` : ""}${ultLevel > 1 ? ` · U${ultLevel}` : ""}`
                        : "Locked"}
                    </span>
                  ) : null}
                </div>

                <div className="border-t border-hairline px-2 py-2">
                  {/* Heading above the name (#141). This tile has a dedicated
                      text block under the art, so the line costs ~10px and
                      crowds nothing. */}
                  {character.heading ? (
                    <p className="truncate font-body text-[9px] font-bold uppercase tracking-label text-readout-muted">
                      {character.heading}
                    </p>
                  ) : null}
                  <p className="truncate font-heading text-lg tracking-title text-readout group-hover:text-(--el)">
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

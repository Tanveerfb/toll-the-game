"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { getCharacterArt } from "@/lib/game/characterArt";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { progressedStats } from "@/lib/game/progression";

type CharacterColor = "light" | "red" | "blue" | "green" | "dark";

export interface CharacterBrowserItem {
  id: string;
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

const CHIP_BASE =
  "chamfer min-h-11 border px-3 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-colors";
const CHIP_OFF =
  "border-edge bg-void/60 text-readout-dim hover:border-edge-strong hover:text-readout";

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
      <span className="font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-muted">
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

  const roster = usePlayerStore((s) => s.roster);
  const characterProgress = usePlayerStore((s) => s.characters);
  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  // The archive took over the roster listing from `/profile`, so by default it
  // shows what you own. Unowned units are one click away, not gone.
  const showUnowned = useSettingsStore((s) => s.showUnownedCharacters);
  const setShowUnowned = useSettingsStore((s) => s.setShowUnownedCharacters);
  const ownedIds = React.useMemo(() => new Set(roster), [roster]);

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
      {/* Query + element */}
      <div className="flex flex-wrap items-center gap-2">
        {/* `dark:bg-input/30` ships inside the shadcn Input and the app is
            permanently in dark mode, so the panel fill has to be restated as a
            dark: variant or the plain utility loses the merge. */}
        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Query name, id, tag"
          aria-label="Search characters"
          className="chamfer h-11 w-full max-w-52 rounded-none border border-edge bg-panel font-body text-readout placeholder:text-readout-muted focus-visible:border-signal focus-visible:ring-0 dark:bg-panel"
        />
        <div className="flex flex-wrap gap-1.5">
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
        </div>
        <span className="ml-auto font-body text-[11px] font-bold uppercase tracking-[0.2em] tabular-nums text-readout-muted">
          <b className="font-bold text-signal">{filtered.length}</b> /{" "}
          {hasHydrated && !showUnowned ? ownedIds.size : characters.length}{" "}
          units
        </span>
      </div>

      {/* Sort + filter controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-body text-[10px] font-bold uppercase tracking-[0.22em] text-readout-muted">
          Sort
        </span>
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
        <Toggle
          active={showFilters || activeFilterCount > 0}
          onClick={() => setShowFilters((v) => !v)}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Toggle>
        {/* Owned-only is the default view, so the control that changes it says
            what it would reveal rather than what it currently is. */}
        <Toggle
          active={showUnowned}
          onClick={() => setShowUnowned(!showUnowned)}
        >
          {showUnowned
            ? "Owned only"
            : `Show locked${hiddenByOwnership > 0 ? ` (${hiddenByOwnership})` : ""}`}
        </Toggle>
        {(activeFilterCount > 0 ||
          selectedColor !== "all" ||
          sortField !== "none" ||
          searchValue) && (
          <Toggle active={false} onClick={clearAll}>
            Clear
          </Toggle>
        )}
      </div>

      {/* Expandable tag + mechanic filters */}
      {showFilters ? (
        <div className="chamfer-lg space-y-3 border border-edge bg-panel p-3">
          {allTags.length > 0 ? (
            <div className="space-y-1.5">
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-readout-muted">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <Toggle
                    key={tag}
                    active={selectedTags.has(tag)}
                    onClick={() =>
                      toggleIn(selectedTags, setSelectedTags, tag)
                    }
                  >
                    {tag}
                  </Toggle>
                ))}
              </div>
            </div>
          ) : null}
          {allMechs.length > 0 ? (
            <div className="space-y-1.5">
              <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-readout-muted">
                Mechanics
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allMechs.map((mech) => (
                  <Toggle
                    key={mech}
                    active={selectedMechs.has(mech)}
                    onClick={() =>
                      toggleIn(selectedMechs, setSelectedMechs, mech)
                    }
                  >
                    {toTitleCase(mech)}
                  </Toggle>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Unit grid */}
      {filtered.length === 0 ? (
        <div className="chamfer-lg flex flex-col items-center gap-3 border border-edge bg-panel py-10 text-center">
          <p className="font-body text-sm font-bold uppercase tracking-[0.2em] text-readout-muted">
            No units match this query.
          </p>
          {/* Without this, an empty grid on a fresh account reads as a bug
              rather than as "you own one character and it's filtered out". */}
          {hiddenByOwnership > 0 ? (
            <button
              type="button"
              onClick={() => setShowUnowned(true)}
              className="chamfer border border-edge px-3 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-signal transition-colors hover:border-signal"
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
                href={`/archive/${character.id}`}
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
                    className="absolute left-0 top-0 px-1.5 py-0.5 font-body text-[10px] font-bold tracking-[0.14em] text-void"
                    style={{ backgroundColor: hue }}
                  >
                    {EL_CODE[character.color]}
                  </span>
                  {/* This corner used to read "Active" — true but useless.
                      The archive is the roster screen now, so it carries the
                      investment: level, ascension band, ult rank. */}
                  {hasHydrated ? (
                    <span
                      title={
                        owned
                          ? `Level ${level}${ascension > 0 ? `, ascension ${ascension}` : ""}${ultLevel > 1 ? `, ultimate ${ultLevel}` : ""}`
                          : "Not yet recruited"
                      }
                      className="absolute bottom-0 right-0 border-l border-t border-edge bg-void/85 px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.14em] tabular-nums"
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
                  <p className="truncate font-heading text-lg tracking-[0.06em] text-readout group-hover:text-(--el)">
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

"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { getCharacterArt } from "@/lib/game/characterArt";

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

const COLOR_STYLES: Record<
  CharacterColor,
  { frame: string; gradient: string; chip: string }
> = {
  light: {
    frame: "border-amber-200/70",
    gradient: "from-amber-200/25 to-transparent",
    chip: "bg-amber-200 text-zinc-900",
  },
  red: {
    frame: "border-red-500/70",
    gradient: "from-red-600/30 to-transparent",
    chip: "bg-red-500 text-zinc-950",
  },
  blue: {
    frame: "border-sky-500/70",
    gradient: "from-sky-600/30 to-transparent",
    chip: "bg-sky-500 text-zinc-950",
  },
  green: {
    frame: "border-emerald-500/70",
    gradient: "from-emerald-600/30 to-transparent",
    chip: "bg-emerald-500 text-zinc-950",
  },
  dark: {
    frame: "border-violet-500/70",
    gradient: "from-violet-600/30 to-transparent",
    chip: "bg-violet-500 text-zinc-950",
  },
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
  "border-2 px-3 py-1.5 font-body text-xs uppercase tracking-[0.12em] transition-colors";
const CHIP_ON = "border-amber-300 bg-amber-300/15 text-amber-200";
const CHIP_OFF =
  "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200";

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CHIP_BASE} ${active ? CHIP_ON : CHIP_OFF}`}
    >
      {children}
    </button>
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
      return matchesSearch && matchesColor && matchesTags && matchesMechs;
    });

    if (sortField !== "none") {
      const dir = sortDir === "asc" ? 1 : -1;
      rows.sort((a, b) => (a[sortField] - b[sortField]) * dir);
    }
    return rows;
  }, [characters, searchValue, selectedColor, selectedTags, selectedMechs, sortField, sortDir]);

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
    <section className="space-y-4">
      {/* Search + element + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search name, id, or tag…"
          className="h-9 w-full max-w-60 rounded-none border-2 border-zinc-700 bg-black/40 text-zinc-100 placeholder:text-zinc-500"
        />
        <div className="flex flex-wrap gap-1">
          {COLOR_OPTIONS.map((option) => (
            <Toggle
              key={option.id}
              active={selectedColor === option.id}
              onClick={() => setSelectedColor(option.id)}
            >
              {option.label}
            </Toggle>
          ))}
        </div>
        <span className="ml-auto font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
          {filtered.length} / {characters.length} units
        </span>
      </div>

      {/* Sort + filter controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-body text-[10px] uppercase tracking-[0.16em] text-zinc-500">
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
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`${CHIP_BASE} ml-2 ${showFilters || activeFilterCount > 0 ? CHIP_ON : CHIP_OFF}`}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
        {(activeFilterCount > 0 ||
          selectedColor !== "all" ||
          sortField !== "none" ||
          searchValue) && (
          <button
            type="button"
            onClick={clearAll}
            className={`${CHIP_BASE} ${CHIP_OFF}`}
          >
            Clear
          </button>
        )}
      </div>

      {/* Expandable tag + mechanic filters */}
      {showFilters ? (
        <div className="space-y-3 border-2 border-zinc-800 bg-black/40 p-3">
          {allTags.length > 0 ? (
            <div className="space-y-1.5">
              <p className="font-body text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                Tags
              </p>
              <div className="flex flex-wrap gap-1">
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
              <p className="font-body text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                Mechanics
              </p>
              <div className="flex flex-wrap gap-1">
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
        <p className="border border-zinc-800 bg-black/40 py-10 text-center font-body text-sm uppercase tracking-[0.14em] text-zinc-500">
          No characters found.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((character) => {
            const style = COLOR_STYLES[character.color];
            return (
              <Link
                key={character.id}
                href={`/archive/${character.id}`}
                className={`group flex flex-col border-2 ${style.frame} bg-zinc-950/80 transition-transform hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.6)]`}
              >
                <div
                  className={`relative flex aspect-square items-center justify-center overflow-hidden bg-linear-to-b ${style.gradient}`}
                >
                  {getCharacterArt(character.id) ? (
                    <Image
                      src={getCharacterArt(character.id)!}
                      alt={character.name}
                      width={512}
                      height={512}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <span className="font-heading text-6xl text-white/85 drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]">
                      {character.name.charAt(0)}
                    </span>
                  )}
                  <span
                    className={`absolute left-1.5 top-1.5 px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-widest ${style.chip}`}
                  >
                    {character.color}
                  </span>
                </div>

                <div className="border-t border-zinc-800 px-2 py-1.5">
                  <p className="truncate font-heading text-lg tracking-[0.05em] text-zinc-100 group-hover:text-amber-200">
                    {character.name}
                  </p>
                  <div className="mt-0.5 grid grid-cols-3 gap-1 font-body text-[10px] uppercase tracking-wider text-zinc-400">
                    <span>
                      <span className="text-zinc-600">ATK </span>
                      {character.atk}
                    </span>
                    <span>
                      <span className="text-zinc-600">DEF </span>
                      {character.def}
                    </span>
                    <span>
                      <span className="text-zinc-600">HP </span>
                      {character.hp}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

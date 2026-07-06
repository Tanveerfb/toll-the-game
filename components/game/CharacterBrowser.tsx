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

export default function CharacterBrowser({
  characters,
}: CharacterBrowserProps): React.JSX.Element {
  const [searchValue, setSearchValue] = React.useState("");
  const [selectedColor, setSelectedColor] = React.useState<
    "all" | CharacterColor
  >("all");

  const filtered = React.useMemo(() => {
    const normalized = searchValue.trim().toLowerCase();
    return characters.filter((character) => {
      const matchesSearch =
        normalized.length === 0 ||
        character.name.toLowerCase().includes(normalized) ||
        character.id.toLowerCase().includes(normalized);
      const matchesColor =
        selectedColor === "all" || character.color === selectedColor;
      return matchesSearch && matchesColor;
    });
  }, [characters, searchValue, selectedColor]);

  return (
    <section className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search name or id…"
          className="h-9 w-full max-w-60 rounded-none border-2 border-zinc-700 bg-black/40 text-zinc-100 placeholder:text-zinc-500"
        />
        <div className="flex flex-wrap gap-1">
          {COLOR_OPTIONS.map((option) => {
            const active = selectedColor === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedColor(option.id)}
                className={`border-2 px-3 py-1.5 font-body text-xs uppercase tracking-[0.12em] transition-colors ${
                  active
                    ? "border-amber-300 bg-amber-300/15 text-amber-200"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <span className="ml-auto font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
          {filtered.length} / {characters.length} units
        </span>
      </div>

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

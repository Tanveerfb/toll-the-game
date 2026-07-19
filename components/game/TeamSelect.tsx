"use client";

import React from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { getCharacterArt } from "@/lib/game/characterArt";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TeamPick } from "@/hooks/BattleProvider";
import {
  getPlayableCharacters,
  getBossCharacters,
  type CharacterData,
} from "@/lib/game/characterCatalog";

const MAX_TEAM_SIZE = 4;

type Mode = "sandbox" | "boss";

/** Multi-phase bosses expose a `phases[]` array; count it for the card badge. */
function phaseCount(character: CharacterData): number {
  const phases = (character as { phases?: unknown[] }).phases;
  return Array.isArray(phases) ? phases.length : 1;
}

/** Battle format sets the field cap; members beyond it become subs. */
const FORMATS = {
  "4v4": { fieldCap: 4, label: "4v4", hint: "All four units on the field" },
  "3v3": {
    fieldCap: 3,
    label: "3v3",
    hint: "Three on the field — a 4th unit is the sub automatically",
  },
} as const;

type BattleFormat = keyof typeof FORMATS;
type Side = "player" | "enemy";

function colorSwatchClass(color: string): string {
  switch (color) {
    case "light":
      return "bg-zinc-100";
    case "red":
      return "bg-red-500";
    case "blue":
      return "bg-sky-500";
    case "green":
      return "bg-emerald-500";
    case "dark":
      return "bg-violet-500";
    default:
      return "bg-zinc-300";
  }
}

function TeamSlots({
  side,
  team,
  fieldCap,
  onOpenRoster,
}: {
  side: Side;
  team: CharacterData[];
  fieldCap: number;
  onOpenRoster: (side: Side) => void;
}): React.JSX.Element {
  const fieldCount = Math.min(team.length, fieldCap);
  const subCount = Math.max(0, team.length - fieldCap);

  return (
    <Card
      className={`rounded-none border-2 ${side === "player" ? "border-sky-400/70" : "border-rose-400/70"} bg-black/50 ring-0`}
    >
      <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <CardTitle
            className={`font-heading text-lg tracking-[0.12em] ${side === "player" ? "text-sky-200" : "text-rose-200"}`}
          >
            {side === "player" ? "PLAYER TEAM" : "ENEMY TEAM"}
          </CardTitle>
          <span className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
            {fieldCount} field{subCount > 0 ? ` + ${subCount} sub` : ""}
          </span>
        </div>
      </CardHeader>
      {/* Every slot opens the roster overlay for this side */}
      <CardContent className="grid grid-cols-4 gap-2 p-3">
        {Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => {
          const character = team[index];
          const isSubSlot = index >= fieldCap;

          if (!character) {
            return (
              <button
                key={`empty-${index}`}
                type="button"
                onClick={() => onOpenRoster(side)}
                title="Open roster"
                className={`flex h-24 cursor-pointer flex-col items-center justify-center border-2 border-dashed font-heading text-2xl transition-colors ${
                  isSubSlot
                    ? "border-amber-800/60 text-amber-900 hover:border-amber-500 hover:text-amber-500"
                    : "border-zinc-700 text-zinc-700 hover:border-zinc-400 hover:text-zinc-400"
                }`}
              >
                <span className="text-3xl leading-none">+</span>
                {isSubSlot ? (
                  <span className="font-body text-[10px] uppercase tracking-widest">
                    Sub
                  </span>
                ) : null}
              </button>
            );
          }

          const art = getCharacterArt(character.id);
          return (
            <button
              key={`${character.id}-${index}`}
              type="button"
              onClick={() => onOpenRoster(side)}
              title="Open roster"
              className={`group relative flex h-24 cursor-pointer flex-col items-center justify-end overflow-hidden border-2 ${
                isSubSlot
                  ? "border-amber-400/70 bg-amber-950/20"
                  : "border-zinc-600 bg-zinc-900/70"
              }`}
            >
              {art ? (
                <Image
                  src={art}
                  alt={character.name}
                  width={256}
                  height={256}
                  className="absolute inset-0 h-full w-full object-cover object-top opacity-90"
                />
              ) : null}
              <span className="relative z-10 w-full bg-black/60 px-1 py-0.5 text-center font-heading text-xs tracking-[0.06em] text-zinc-100">
                {character.name}
                {isSubSlot ? (
                  <span className="ml-1 font-body text-[9px] uppercase tracking-widest text-amber-300">
                    SUB★
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RosterOverlay({
  side,
  roster,
  team,
  onToggle,
  onDone,
}: {
  side: Side;
  roster: CharacterData[];
  team: CharacterData[];
  onToggle: (character: CharacterData) => void;
  onDone: () => void;
}): React.JSX.Element {
  const accent =
    side === "player"
      ? { border: "border-sky-400/70", text: "text-sky-200" }
      : { border: "border-rose-400/70", text: "text-rose-200" };
  const isFull = team.length >= MAX_TEAM_SIZE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm">
      <Card
        className={`flex max-h-full w-full max-w-4xl flex-col rounded-none border-2 ${accent.border} bg-zinc-950/95 ring-0`}
      >
        <CardHeader className="border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle
                className={`font-heading text-2xl tracking-[0.12em] ${accent.text}`}
              >
                {side === "player" ? "PLAYER TEAM" : "ENEMY TEAM"} ROSTER
              </CardTitle>
              <CardDescription className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
                Tap to add or remove • {team.length}/{MAX_TEAM_SIZE} picked
              </CardDescription>
            </div>
            <Button
              onClick={onDone}
              className="h-10 rounded-none border-2 border-amber-300 px-6 font-heading text-base tracking-[0.14em]"
            >
              DONE
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4">
          {roster.map((character) => {
            const pickIndex = team.findIndex((c) => c.id === character.id);
            const isPicked = pickIndex !== -1;
            const disabled = !isPicked && isFull;
            const art = getCharacterArt(character.id);
            return (
              <button
                key={character.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(character)}
                className={`group relative flex h-40 flex-col justify-end overflow-hidden border-2 text-left transition-all ${
                  isPicked
                    ? `${accent.border} ring-2 ${side === "player" ? "ring-sky-400/60" : "ring-rose-400/60"}`
                    : disabled
                      ? "cursor-not-allowed border-zinc-800 opacity-40"
                      : "border-zinc-700 hover:border-zinc-400"
                } bg-zinc-900/70`}
              >
                {art ? (
                  <Image
                    src={art}
                    alt={character.name}
                    width={256}
                    height={256}
                    className="absolute inset-0 h-full w-full object-cover object-top opacity-90"
                  />
                ) : (
                  <span
                    className={`absolute inset-0 ${colorSwatchClass(character.color)} opacity-20`}
                  />
                )}
                {isPicked ? (
                  <span
                    className={`absolute right-1 top-1 z-10 border px-1.5 py-0.5 font-heading text-xs ${accent.border} bg-black/70 ${accent.text}`}
                  >
                    ✓ {pickIndex + 1}
                  </span>
                ) : null}
                <span className="relative z-10 w-full bg-black/70 px-2 py-1">
                  <span className="block truncate font-heading text-base tracking-[0.06em] text-zinc-100">
                    {character.name}
                  </span>
                  <span className="mt-0.5 flex gap-1">
                    <Badge
                      variant="secondary"
                      className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest"
                    >
                      ATK {character.atk}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest"
                    >
                      DEF {character.def}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest"
                    >
                      HP {character.hp}
                    </Badge>
                  </span>
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function BossPicker({
  bosses,
  selectedId,
  onSelect,
}: {
  bosses: CharacterData[];
  selectedId: string | null;
  onSelect: (character: CharacterData) => void;
}): React.JSX.Element {
  return (
    <Card className="rounded-none border-2 border-rose-400/70 bg-black/50 ring-0">
      <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-lg tracking-[0.12em] text-rose-200">
            CHOOSE BOSS
          </CardTitle>
          <span className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
            {selectedId ? "1 selected" : "pick one"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        {bosses.map((character) => {
          const isPicked = character.id === selectedId;
          const art = getCharacterArt(character.id);
          const phases = phaseCount(character);
          return (
            <button
              key={character.id}
              type="button"
              onClick={() => onSelect(character)}
              className={`group relative flex h-40 flex-col justify-end overflow-hidden border-2 text-left transition-all ${
                isPicked
                  ? "border-rose-400/70 ring-2 ring-rose-400/60"
                  : "border-zinc-700 hover:border-zinc-400"
              } bg-zinc-900/70`}
            >
              {art ? (
                <Image
                  src={art}
                  alt={character.name}
                  width={256}
                  height={256}
                  className="absolute inset-0 h-full w-full object-cover object-top opacity-90"
                />
              ) : (
                <span
                  className={`absolute inset-0 ${colorSwatchClass(character.color)} opacity-20`}
                />
              )}
              {isPicked ? (
                <span className="absolute right-1 top-1 z-10 border border-rose-400/70 bg-black/70 px-1.5 py-0.5 font-heading text-xs text-rose-200">
                  ✓
                </span>
              ) : null}
              <span className="relative z-10 w-full bg-black/70 px-2 py-1">
                <span className="block truncate font-heading text-base tracking-[0.06em] text-zinc-100">
                  {character.name}
                </span>
                <span className="mt-0.5 flex gap-1">
                  <Badge
                    variant="secondary"
                    className="rounded-none border-amber-400/50 px-1 py-0 font-body text-[9px] uppercase tracking-widest text-amber-200"
                  >
                    Elite
                  </Badge>
                  {phases > 1 ? (
                    <Badge
                      variant="secondary"
                      className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest"
                    >
                      {phases} Phases
                    </Badge>
                  ) : null}
                </span>
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function TeamSelect({
  onStart,
}: {
  onStart: (playerPicks: TeamPick[], enemyPicks: TeamPick[]) => void;
}): React.JSX.Element {
  const roster = React.useMemo(() => getPlayableCharacters(), []);
  const bosses = React.useMemo(() => getBossCharacters(), []);
  const [mode, setMode] = React.useState<Mode>("sandbox");
  const [format, setFormat] = React.useState<BattleFormat>("4v4");
  const [playerTeam, setPlayerTeam] = React.useState<CharacterData[]>([]);
  const [enemyTeam, setEnemyTeam] = React.useState<CharacterData[]>([]);
  const [boss, setBoss] = React.useState<CharacterData | null>(null);
  const [rosterSide, setRosterSide] = React.useState<Side | null>(null);

  const fieldCap = FORMATS[format].fieldCap;
  const isBossMode = mode === "boss";

  const setTeam = (side: Side) =>
    side === "player" ? setPlayerTeam : setEnemyTeam;

  const toggleFor = (side: Side) => (character: CharacterData) => {
    setTeam(side)((team) => {
      if (team.some((c) => c.id === character.id)) {
        return team.filter((c) => c.id !== character.id);
      }
      return team.length < MAX_TEAM_SIZE ? [...team, character] : team;
    });
  };

  const selectBoss = (character: CharacterData) =>
    setBoss((current) => (current?.id === character.id ? null : character));

  // Sandbox: any 1-4 vs 1-4. Boss: a player team + one boss.
  const canStart = isBossMode
    ? playerTeam.length > 0 && boss !== null
    : playerTeam.length > 0 && enemyTeam.length > 0;

  const toPicks = (team: CharacterData[]): TeamPick[] =>
    team.map((c, index) => ({
      id: c.id,
      isSub: index >= fieldCap || undefined,
    }));

  const handleStart = () => {
    if (isBossMode) {
      if (boss) onStart(toPicks(playerTeam), [{ id: boss.id }]);
    } else {
      onStart(toPicks(playerTeam), toPicks(enemyTeam));
    }
  };

  const clearAll = () => {
    setPlayerTeam([]);
    setEnemyTeam([]);
    setBoss(null);
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-4xl tracking-[0.14em] text-zinc-100 md:text-5xl">
            {isBossMode ? "BOSS BATTLE" : "TEAM SELECT"}
          </h1>
          <p className="mt-1 font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
            {isBossMode
              ? "Build your team, then pick one boss to face. Bosses act three times a turn."
              : "Sandbox — tap a team slot to open the roster and pick 1–4 units."}{" "}
            {FORMATS[format].hint}. A sub&apos;s passive works from the bench; it
            enters at the start of a new turn after a teammate falls.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Sandbox | Boss Battle mode toggle */}
          <div className="flex border-2 border-zinc-700">
            {(["sandbox", "boss"] as Mode[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`px-4 py-2 font-heading text-sm tracking-[0.12em] transition-colors ${
                  mode === key
                    ? "bg-rose-400/15 text-rose-200"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {key === "sandbox" ? "SANDBOX" : "BOSS BATTLE"}
              </button>
            ))}
          </div>
          <div className="flex border-2 border-zinc-700">
            {(Object.keys(FORMATS) as BattleFormat[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFormat(key)}
                className={`px-4 py-2 font-heading text-sm tracking-[0.12em] transition-colors ${
                  format === key
                    ? "bg-amber-300/15 text-amber-200"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {FORMATS[key].label}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            disabled={
              playerTeam.length === 0 && enemyTeam.length === 0 && boss === null
            }
            onClick={clearAll}
            className="rounded-none border border-zinc-700 font-heading tracking-[0.12em] text-zinc-300"
          >
            CLEAR
          </Button>
          <Button
            size="lg"
            disabled={!canStart}
            onClick={handleStart}
            className="h-11 rounded-none border-2 border-amber-300 bg-[linear-gradient(90deg,#b45309_0%,#d97706_38%,#f59e0b_70%,#facc15_100%)] px-8 font-heading text-lg tracking-[0.14em] text-zinc-950"
          >
            {isBossMode ? "START BOSS BATTLE" : "START BATTLE"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TeamSlots
          side="player"
          team={playerTeam}
          fieldCap={fieldCap}
          onOpenRoster={setRosterSide}
        />
        {isBossMode ? (
          <BossPicker
            bosses={bosses}
            selectedId={boss?.id ?? null}
            onSelect={selectBoss}
          />
        ) : (
          <TeamSlots
            side="enemy"
            team={enemyTeam}
            fieldCap={fieldCap}
            onOpenRoster={setRosterSide}
          />
        )}
      </div>

      {/* Boss mode uses only the player roster overlay; enemy side is the picker */}
      {rosterSide && !(isBossMode && rosterSide === "enemy") ? (
        <RosterOverlay
          side={rosterSide}
          roster={roster}
          team={rosterSide === "player" ? playerTeam : enemyTeam}
          onToggle={toggleFor(rosterSide)}
          onDone={() => setRosterSide(null)}
        />
      ) : null}
    </section>
  );
}

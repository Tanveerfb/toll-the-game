"use client";

import React from "react";
import Image from "next/image";
import TeamPicker from "@/components/game/TeamPicker";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  getBossCharacters,
  type CharacterData,
} from "@/lib/game/characterCatalog";
import { FIELD_CAP, TEAM_CAP } from "@/lib/game/format";
import type { TeamPick } from "@/hooks/BattleProvider";

/**
 * The practice bench.
 *
 * This used to carry its own slot grid, its own roster overlay and its own
 * copy of the format rules — roughly 250 lines duplicating what every other
 * team screen also did slightly differently. It now composes two
 * `TeamPicker`s: picking your side and picking the opposing side are the same
 * job with a different source (Tanveer, 2026-08-11).
 *
 * What stays here is what's genuinely specific to a bench: choosing the
 * opposing side at all, boss mode, and the format switcher. Both pickers run
 * `source="catalog"` — testing a kit you haven't pulled is the point of this
 * screen — and the enemy side turns presets off, since "save this opposing
 * team as Main" is not a thing anyone wants.
 */

type Mode = "sandbox" | "boss";

/** Battle format sets the field cap; members beyond it become subs. The engine
 *  default is 3 (see `lib/game/format.ts`); the bench may override it, which
 *  is why `onStart` carries the choice. */
const FORMATS = {
  "3v3": {
    fieldCap: FIELD_CAP,
    label: "3v3",
    hint: "Three on the field — a 4th unit is the sub automatically",
  },
  "4v4": {
    fieldCap: TEAM_CAP,
    label: "4v4",
    hint: "All four units on the field",
  },
} as const;

type BattleFormat = keyof typeof FORMATS;

/** Multi-phase bosses expose a `phases[]` array; count it for the card badge. */
function phaseCount(character: CharacterData): number {
  const phases = (character as { phases?: unknown[] }).phases;
  return Array.isArray(phases) ? phases.length : 1;
}

const TOGGLE =
  "chamfer px-4 py-2 font-heading text-sm tracking-[0.12em] transition-colors";

function BossPicker({
  bosses,
  selected,
  onSelect,
}: {
  bosses: CharacterData[];
  selected: CharacterData | null;
  onSelect: (character: CharacterData) => void;
}): React.JSX.Element {
  return (
    <div className="chamfer-lg border border-role-attack bg-panel">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-3 py-2">
        <h3 className="font-heading text-lg tracking-[0.12em] text-role-attack">
          Boss
        </h3>
        <span className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-readout-muted">
          {selected ? selected.name : "None picked"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4">
        {bosses.map((boss) => {
          const art = getCharacterArt(boss.id);
          const active = selected?.id === boss.id;
          const phases = phaseCount(boss);
          return (
            <button
              key={boss.id}
              type="button"
              onClick={() => onSelect(boss)}
              className={`relative flex h-28 flex-col justify-end overflow-hidden border bg-inset text-left transition-colors ${
                active
                  ? "border-role-attack"
                  : "border-edge hover:border-edge-strong"
              }`}
            >
              {art ? (
                <Image
                  src={art}
                  alt=""
                  width={256}
                  height={256}
                  className="absolute inset-0 h-full w-full object-cover object-top"
                />
              ) : null}
              {phases > 1 ? (
                <span className="absolute right-0 top-0 z-10 bg-role-attack px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-widest text-void">
                  {phases} phases
                </span>
              ) : null}
              <span className="relative z-10 w-full bg-void/80 px-1.5 py-1 font-heading text-sm tracking-[0.06em] text-readout-strong">
                {boss.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TeamSelect({
  onStart,
}: {
  onStart: (
    playerPicks: TeamPick[],
    enemyPicks: TeamPick[],
    options?: { fieldCap?: number },
  ) => void;
}): React.JSX.Element {
  const bosses = React.useMemo(() => getBossCharacters(), []);
  const [mode, setMode] = React.useState<Mode>("sandbox");
  const [format, setFormat] = React.useState<BattleFormat>("3v3");
  const [playerTeam, setPlayerTeam] = React.useState<CharacterData[]>([]);
  const [enemyTeam, setEnemyTeam] = React.useState<CharacterData[]>([]);
  const [boss, setBoss] = React.useState<CharacterData | null>(null);

  const fieldCap = FORMATS[format].fieldCap;
  const isBossMode = mode === "boss";

  const canStart = isBossMode
    ? playerTeam.length > 0 && boss !== null
    : playerTeam.length > 0 && enemyTeam.length > 0;

  const toPicks = (team: CharacterData[]): TeamPick[] =>
    team.map((c) => ({ id: c.id }));

  const handleStart = () => {
    // The bench is the only caller that may differ from the engine default, so
    // it always states its board rather than inheriting one.
    if (isBossMode) {
      if (boss) onStart(toPicks(playerTeam), [{ id: boss.id }], { fieldCap });
    } else {
      onStart(toPicks(playerTeam), toPicks(enemyTeam), { fieldCap });
    }
  };

  const clearAll = () => {
    setPlayerTeam([]);
    setEnemyTeam([]);
    setBoss(null);
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-3 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <header className="border-l-2 border-signal pl-3">
          <span className="block font-body text-[10px] font-bold uppercase tracking-[0.34em] text-signal">
            Practice bench
          </span>
          <h1 className="font-heading text-4xl leading-none tracking-[0.1em] text-readout-strong">
            {isBossMode ? "Boss Battle" : "Team Select"}
          </h1>
          <p className="mt-1 max-w-[70ch] font-body text-[11px] leading-relaxed text-readout-dim">
            {isBossMode
              ? "Build a team, then pick one boss. Bosses act three times a turn."
              : "Any units, owned or not — this is the bench."}{" "}
            {FORMATS[format].hint}. A sub&apos;s passive works from the bench; it
            enters at the start of a new turn after a teammate falls.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {(["sandbox", "boss"] as Mode[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`${TOGGLE} border ${
                  mode === key
                    ? "border-role-attack bg-role-attack/15 text-role-attack"
                    : "border-edge text-readout-dim hover:text-readout"
                }`}
              >
                {key === "sandbox" ? "Sandbox" : "Boss"}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(Object.keys(FORMATS) as BattleFormat[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFormat(key)}
                className={`${TOGGLE} border ${
                  format === key
                    ? "border-signal bg-signal/15 text-signal"
                    : "border-edge text-readout-dim hover:text-readout"
                }`}
              >
                {FORMATS[key].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={
              playerTeam.length === 0 && enemyTeam.length === 0 && boss === null
            }
            onClick={clearAll}
            className={`${TOGGLE} border border-edge text-readout-dim hover:text-readout disabled:pointer-events-none disabled:opacity-40`}
          >
            Clear
          </button>
          <button
            type="button"
            disabled={!canStart}
            onClick={handleStart}
            className="chamfer h-11 border border-signal bg-signal px-8 font-heading text-lg tracking-[0.12em] text-void disabled:pointer-events-none disabled:opacity-40"
          >
            {isBossMode ? "Start boss battle" : "Start battle"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TeamPicker
          team={playerTeam}
          onChange={setPlayerTeam}
          source="catalog"
          title="Your team"
          fieldCap={fieldCap}
        />
        {isBossMode ? (
          <BossPicker bosses={bosses} selected={boss} onSelect={(c) =>
            setBoss((current) => (current?.id === c.id ? null : c))
          } />
        ) : (
          <TeamPicker
            team={enemyTeam}
            onChange={setEnemyTeam}
            source="catalog"
            title="Opposing team"
            showPresets={false}
            fieldCap={fieldCap}
          />
        )}
      </div>
    </section>
  );
}

"use client";

import React from "react";
import Image from "next/image";
import TeamPicker from "@/components/game/TeamPicker";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  getBossCharacters,
  getPlayableCharacters,
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
  "chamfer min-h-11 px-4 py-2 font-heading text-sm tracking-[0.12em] transition-colors";

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
  const catalog = React.useMemo(() => getPlayableCharacters(), []);
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
    <section className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8">
      {/* Masthead — the signal rule every other screen opens on. */}
      <header className="border-l-2 border-signal pl-3">
        <span className="block font-body text-[10px] font-bold uppercase tracking-[0.34em] text-signal">
          Practice bench
        </span>
        <h1 className="font-heading text-4xl leading-none tracking-[0.1em] text-readout-strong">
          {isBossMode ? "Boss Battle" : "Team Select"}
        </h1>
        <p className="mt-1.5 max-w-[68ch] font-body text-sm leading-relaxed text-readout-dim">
          {isBossMode
            ? "Build a team, then pick one boss. Bosses act three times a turn."
            : "Any character in the game, owned or not. Nothing here touches your save."}
        </p>
      </header>

      {/* Setup strip. Mode and format are settings, not actions — they used to
          sit in one undifferentiated row alongside Clear and Start, so four
          different kinds of control wore the same chip. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-hairline bg-inset/50 px-3 py-2">
        <Setting label="Mode">
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
        </Setting>

        <Setting label="Format">
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
        </Setting>

        <p className="min-w-[18rem] flex-1 font-body text-[11px] leading-snug text-readout-muted">
          {FORMATS[format].hint}. A sub&apos;s passive works from the bench; it
          enters at the start of a new turn after a teammate falls.
        </p>
      </div>

      {/* The matchup. Two identical pickers read as two equal teams, so a VS
          divider says which way the fight runs. */}
      <div className="mt-4 grid items-start gap-3 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col gap-2">
          <TeamPicker
            team={playerTeam}
            onChange={setPlayerTeam}
            source="catalog"
            title="Your team"
            fieldCap={fieldCap}
          />
          <QuickRow>
            <QuickAction
              onClick={() => setPlayerTeam(randomTeam(catalog, fieldCap))}
            >
              Randomise
            </QuickAction>
            <QuickAction
              onClick={() => setPlayerTeam([])}
              disabled={playerTeam.length === 0}
            >
              Empty
            </QuickAction>
          </QuickRow>
        </div>

        <div className="flex items-center justify-center py-2 lg:h-full lg:flex-col">
          <span className="hidden flex-1 border-l border-hairline lg:block" />
          <span className="px-3 py-1 font-heading text-2xl tracking-[0.14em] text-readout-muted">
            VS
          </span>
          <span className="hidden flex-1 border-l border-hairline lg:block" />
        </div>

        {isBossMode ? (
          <BossPicker
            bosses={bosses}
            selected={boss}
            onSelect={(c) =>
              setBoss((current) => (current?.id === c.id ? null : c))
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            <TeamPicker
              team={enemyTeam}
              onChange={setEnemyTeam}
              source="catalog"
              title="Opposing team"
              showPresets={false}
              fieldCap={fieldCap}
            />
            <QuickRow>
              <QuickAction
                onClick={() => setEnemyTeam(randomTeam(catalog, fieldCap))}
              >
                Randomise
              </QuickAction>
              {/* The bench's most-wanted shortcut: fight the thing you just
                  built, to see how a kit handles itself. */}
              <QuickAction
                onClick={() => setEnemyTeam([...playerTeam])}
                disabled={playerTeam.length === 0}
              >
                Mirror your team
              </QuickAction>
              <QuickAction
                onClick={() => setEnemyTeam([])}
                disabled={enemyTeam.length === 0}
              >
                Empty
              </QuickAction>
            </QuickRow>
          </div>
        )}
      </div>

      {/* Action bar, pinned. Start used to sit top-right — above the teams it
          starts and directly beside Clear, which is the one control you never
          want next to it. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-void/95 backdrop-blur-sm">
        {/* `pb-safe` replaces the bottom half of `py-3`: this bar is pinned to
            the screen edge, and START would otherwise sit under the iOS home
            indicator. */}
        <div className="pb-safe mx-auto flex w-full max-w-6xl items-center gap-3 px-4 pt-3 md:px-8">
          <span className="min-w-0 font-body text-[11px] leading-snug text-readout-muted">
            {canStart ? (
              <>
                <span className="text-readout-strong">{playerTeam.length}</span>{" "}
                vs{" "}
                <span className="text-readout-strong">
                  {isBossMode ? boss?.name : enemyTeam.length}
                </span>
                {" · "}
                {FORMATS[format].label}
              </>
            ) : (
              missingLabel(isBossMode, playerTeam.length, enemyTeam.length, boss)
            )}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            disabled={
              playerTeam.length === 0 && enemyTeam.length === 0 && boss === null
            }
            onClick={clearAll}
            className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-readout-muted transition-colors hover:text-el-red disabled:pointer-events-none disabled:opacity-40"
          >
            Clear all
          </button>
          <button
            type="button"
            disabled={!canStart}
            onClick={handleStart}
            className="chamfer h-11 shrink-0 border border-signal bg-signal px-8 font-heading text-lg tracking-[0.12em] text-void transition-opacity disabled:pointer-events-none disabled:opacity-40"
          >
            {isBossMode ? "Start boss battle" : "Start battle"}
          </button>
        </div>
      </div>
    </section>
  );
}

/** A labelled cluster in the setup strip. */
function Setting({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className="flex items-center gap-2">
      <span className="font-body text-[9px] font-bold uppercase tracking-[0.22em] text-readout-muted">
        {label}
      </span>
      <span className="flex gap-1">{children}</span>
    </span>
  );
}

function QuickRow({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function QuickAction({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="chamfer min-h-11 border border-edge bg-void/60 px-2.5 py-1 font-body text-[11px] font-bold uppercase tracking-[0.14em] text-readout-dim transition-colors hover:border-edge-strong hover:text-signal disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}

/** Says what's still missing rather than leaving a disabled button unexplained. */
function missingLabel(
  isBossMode: boolean,
  playerCount: number,
  enemyCount: number,
  boss: CharacterData | null,
): string {
  if (playerCount === 0) return "Pick at least one unit for your team";
  if (isBossMode && !boss) return "Pick a boss to fight";
  if (!isBossMode && enemyCount === 0) return "Pick at least one opponent";
  return "";
}

/** A random line-up for the bench — the fastest way to get into a fight when
 *  you only want to watch one kit work. */
function randomTeam(pool: CharacterData[], size: number): CharacterData[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(size, shuffled.length));
}

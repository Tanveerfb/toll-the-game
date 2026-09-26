"use client";

import React from "react";
import Image from "next/image";
import TeamPicker from "@/components/game/TeamPicker";
import { Button } from "@/components/ui/button";
import { panelVariants } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  getBossCharacters,
  getPlayableCharacters,
  type CharacterData,
} from "@/lib/game/characterCatalog";
import { FIELD_CAP, TEAM_CAP } from "@/lib/game/format";
import type { TeamPick } from "@/types/teamPick";

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
    <div className={panelVariants({ surface: "paper", density: "none", lift: "slab" })}>
      <div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2">
        <h3 className="font-heading text-lg tracking-label">Boss</h3>
        <span className="font-body text-caption font-bold uppercase tracking-label text-muted-foreground">
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
              aria-pressed={active}
              // Selected is the action yellow, as everywhere else.
              className={cn(
                "relative flex h-28 flex-col justify-end overflow-hidden border-2 bg-muted text-left transition-colors",
                active ? "border-border ink-slab-primary" : "border-rule hover:border-border",
              )}
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
                <span className="absolute right-0 top-0 z-10 border-b-2 border-l-2 border-border bg-role-attack px-1.5 py-0.5 font-body text-micro font-bold uppercase tracking-label text-card-foreground">
                  {phases} phases
                </span>
              ) : null}
              <span className="relative z-10 w-full bg-card-foreground/85 px-1.5 py-1 font-heading text-sm tracking-title text-card">
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
      {/* Masthead — the page header every other screen opens on. */}
      <SectionHeader
        eyebrow="Practice bench"
        title={isBossMode ? "Boss Battle" : "Team Select"}
      >
        <p className="mt-2 max-w-[68ch] font-body text-sm leading-relaxed text-ground-dim">
          {isBossMode
            ? "Build a team, then pick one boss. Bosses act three times a turn."
            : "Any character in the game, owned or not. Nothing here touches your save."}
        </p>
      </SectionHeader>

      {/* Setup strip. Mode and format are settings, not actions — they used to
          sit in one undifferentiated row alongside Clear and Start, so four
          different kinds of control wore the same chip. */}
      <div
        className={cn(
          panelVariants({ surface: "paper", density: "tight" }),
          "mt-4 flex flex-wrap items-center gap-x-5 gap-y-2",
        )}
      >
        {/* Settings, not actions: each is one choice out of two, which is the
            shadcn toggle group (ruling #154). */}
        <Setting label="Mode">
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={mode}
            onValueChange={(value) => {
              if (value) setMode(value as Mode);
            }}
            aria-label="Mode"
          >
            <ToggleGroupItem value="sandbox">Sandbox</ToggleGroupItem>
            <ToggleGroupItem value="boss">Boss</ToggleGroupItem>
          </ToggleGroup>
        </Setting>

        <Setting label="Format">
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={format}
            onValueChange={(value) => {
              if (value) setFormat(value as BattleFormat);
            }}
            aria-label="Format"
          >
            {(Object.keys(FORMATS) as BattleFormat[]).map((key) => (
              <ToggleGroupItem key={key} value={key}>
                {FORMATS[key].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Setting>

        <p className="min-w-[18rem] flex-1 font-body text-caption leading-snug text-muted-foreground">
          {FORMATS[format].hint}. A sub&apos;s passive works from the bench; it
          enters at the start of a new turn after a teammate falls.
        </p>
      </div>

      {/* The matchup. Two identical pickers read as two equal teams, so a VS
          divider says which way the fight runs. */}
      <div className="mt-4 grid grid-cols-1 items-start gap-3 lg:grid-cols-[1fr_auto_1fr]">
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
          <span className="hidden flex-1 border-l-2 border-ground-line lg:block" />
          {/* The manga's versus burst: the one loud mark between the teams. */}
          <span className="ink-skew bg-primary px-3 py-1 font-heading text-2xl tracking-label text-primary-foreground ink-slab-sm">
            VS
          </span>
          <span className="hidden flex-1 border-l-2 border-ground-line lg:block" />
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
              side="enemy"
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
      {/* `bottom-[var(--tabbar-h)]`, not `bottom-0`. The bottom tab bar (ruling
          #123) is also `fixed bottom-0`, at `z-50` against this bar's `z-40`,
          so on a phone it covered START **completely** — measured 2026-09-01,
          `elementFromPoint` at the centre of "Start battle" returned the Gacha
          tab, and a tap navigated instead of starting the fight. Practice and
          the world boss were both unstartable on the device the game is built
          for.

          Stacking rather than standing the tab bar down: unlike a battle, team
          select is a screen you may well want to leave, and #123 hides the bar
          only for `[data-battle-active]`. `--tabbar-h` is `0rem` at `sm` and
          up, so this is `bottom-0` on desktop with no breakpoint of its own. */}
      <div className="fixed inset-x-0 bottom-[var(--tabbar-h)] z-40 border-t-2 border-border bg-card text-card-foreground">
        {/* `pb-safe` replaces the bottom half of `py-3`: this bar is pinned to
            the screen edge, and START would otherwise sit under the iOS home
            indicator. */}
        <div className="pb-safe mx-auto flex w-full max-w-6xl items-center gap-3 px-4 pt-3 md:px-8">
          <span className="min-w-0 font-body text-caption leading-snug text-muted-foreground">
            {canStart ? (
              <>
                <span className="font-bold text-card-foreground">{playerTeam.length}</span>{" "}
                vs{" "}
                <span className="font-bold text-card-foreground">
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
          <Button
            variant="ghost"
            size="sm"
            disabled={
              playerTeam.length === 0 && enemyTeam.length === 0 && boss === null
            }
            onClick={clearAll}
          >
            Clear all
          </Button>
          <Button size="lg" disabled={!canStart} onClick={handleStart} className="px-8">
            {isBossMode ? "Start boss battle" : "Start battle"}
          </Button>
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
      <span className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
        {label}
      </span>
      {children}
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
    // On the ground, so the outline prints light.
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      {children}
    </Button>
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

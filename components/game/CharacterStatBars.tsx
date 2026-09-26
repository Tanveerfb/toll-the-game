"use client";

import React from "react";
import { usePlayerStore } from "@/store/playerStore";
import {
  BASE_PROGRESSION,
  progressedStats,
  type CoreStats,
} from "@/lib/game/progression";

/**
 * The archive statline, with the player's own level and ascension applied.
 *
 * The page around this is a server component built at build time, so it can
 * only ever know the catalog's base numbers — a maxed character read exactly
 * like a freshly pulled one. Progression lives in localStorage, which means
 * this has to be a client island.
 *
 * **The bar and the number answer different questions.** The number is what
 * this character actually fights at. The bar is "where does this sit against
 * the roster", and that standing is level-invariant: `progressedStats` puts
 * every stat on one multiplier, so a levelled character and its base form
 * occupy the same position relative to a peak measured at base. Filling the
 * bar from the progressed number would instead peg every owned character at
 * 100% and destroy the comparison the bar exists for.
 */

const STAT_ROWS = [
  { key: "hp", label: "Hp" },
  { key: "atk", label: "Atk" },
  { key: "def", label: "Def" },
] as const;

function StatBar({
  label,
  display,
  base,
  max,
  hue,
}: {
  label: string;
  /** The number shown — progressed when owned. */
  display: number;
  /** What the bar fills from, always the catalog base. */
  base: number;
  max: number;
  hue: string;
}): React.JSX.Element {
  // One column of three (his pick B, 2026-09-27): label and number on one
  // line, the bar under them. It was one row per stat, three rows deep.
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex items-baseline justify-between gap-1">
        <span className="font-body text-label font-bold uppercase tracking-label text-muted-foreground">
          {label}
        </span>
        <span className="font-heading text-base leading-none tabular-nums">
          {display.toLocaleString()}
        </span>
      </span>
      <span className="block h-1.5 border border-border bg-muted">
        <span
          className="block h-full"
          style={{
            width: `${Math.min(100, Math.round((base / max) * 100))}%`,
            backgroundColor: hue,
          }}
        />
      </span>
      {display !== base ? (
        <span className="font-body text-label leading-tight tabular-nums text-muted-foreground">
          base {base.toLocaleString()}
        </span>
      ) : null}
    </div>
  );
}

export default function CharacterStatBars({
  characterId,
  base,
  peak,
  hue,
}: {
  characterId: string;
  base: CoreStats;
  peak: CoreStats;
  hue: string;
}): React.JSX.Element {
  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const roster = usePlayerStore((s) => s.roster);
  const stored = usePlayerStore((s) => s.characters[characterId]);

  // Base until rehydration, so the static server render and the first client
  // render agree. An unowned character has no progression to show either.
  // An owned character absent from `characters` has simply never been fed —
  // that's the level-1/unascended floor, same as `getCharacterProgress`.
  const owned = hasHydrated && roster.includes(characterId);
  const progress = owned ? (stored ?? BASE_PROGRESSION) : null;
  const shown = progress ? progressedStats(base, progress) : base;

  // The level line that sat beside the header moved onto the Growth button
  // under this (Lv · A · UL), which says it with the ult level included.
  return (
    <>
      <p className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
        Against the roster
      </p>
      <div className="mt-1 grid grid-cols-3 gap-3">
        {STAT_ROWS.map(({ key, label }) => (
          <StatBar
            key={key}
            label={label}
            display={shown[key]}
            base={base[key]}
            max={peak[key]}
            hue={hue}
          />
        ))}
      </div>
    </>
  );
}

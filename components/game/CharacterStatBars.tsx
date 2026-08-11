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
  return (
    <div className="mt-1 grid grid-cols-[26px_1fr_auto] items-center gap-2">
      <span className="font-body text-[9px] font-bold uppercase tracking-[0.12em] text-readout-muted">
        {label}
      </span>
      <span className="block h-1 bg-hairline">
        <span
          className="block h-full"
          style={{
            width: `${Math.min(100, Math.round((base / max) * 100))}%`,
            backgroundColor: hue,
          }}
        />
      </span>
      <span className="text-right">
        <span className="block font-heading text-base leading-none tabular-nums text-readout-strong">
          {display.toLocaleString()}
        </span>
        {display !== base ? (
          <span className="block font-body text-[9px] leading-tight tabular-nums text-readout-muted">
            base {base.toLocaleString()}
          </span>
        ) : null}
      </span>
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

  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-readout-muted">
          Against the roster
        </p>
        {progress ? (
          <p className="font-body text-[9px] font-bold uppercase tracking-[0.14em] text-signal">
            Lv {progress.level} · A{progress.ascension}
          </p>
        ) : null}
      </div>
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
    </>
  );
}

import React from "react";

import type { CoreStats } from "@/lib/game/progression";

/**
 * What a spend actually buys: before → after.
 *
 * No section of the growth modal showed this. You could pour a shelf of sea
 * monster eyes into an ascension and the modal never said what the stats
 * became — and `progressedStats()` was one call away the whole time, already
 * used by `CharacterBrowser` (audit 2026-09-17).
 *
 * Rows with no change are dropped, so an ascension's headline (a raised level
 * cap) is not buried under three stats that moved by nine points.
 */
export default function StatDelta({
  from,
  to,
  extra,
}: {
  from: CoreStats;
  to: CoreStats;
  /** Non-stat rows — a level cap, an ultimate multiplier. */
  extra?: Array<{ label: string; from: string; to: string }>;
}): React.JSX.Element | null {
  const rows = (
    [
      ["HP", from.hp, to.hp],
      ["ATK", from.atk, to.atk],
      ["DEF", from.def, to.def],
    ] as const
  )
    .filter(([, a, b]) => a !== b)
    .map(([label, a, b]) => ({
      label,
      from: Math.round(a).toLocaleString(),
      to: Math.round(b).toLocaleString(),
    }));

  const all = [...rows, ...(extra ?? [])];
  if (all.length === 0) return null;

  return (
    <div className="mt-2.5 border border-hairline bg-inset px-2.5 py-2">
      {all.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-2 font-body text-[13px] tabular-nums"
        >
          <span className="font-bold uppercase tracking-label text-[10px] text-readout-muted">
            {row.label}
          </span>
          <span className="text-readout-muted">{row.from} →</span>
          <span className="font-bold text-role-heal">{row.to}</span>
        </div>
      ))}
    </div>
  );
}

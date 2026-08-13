"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import DetailOverlay from "@/components/game/DetailOverlay";
import { Button } from "@/components/ui/button";

/**
 * Auto Clear confirmation (Tanveer, 2026-08-13).
 *
 * Auto Clear used to spend the entire affordable batch on one tap — up to a
 * full stamina bar and every ticket that fit, with no way to say "just two".
 * A ticket buys time, never resources, so the cost of a mis-tap is real
 * stamina and real tickets that the player cannot get back.
 *
 * So: a slider to choose the count, and a preview of what it spends. The
 * preview is deliberately a **shift** — before → after for both stamina and
 * tickets — because "you will have 1 ticket left" is the thing a player
 * actually decides on, and it was previously only discoverable afterwards.
 *
 * The reward side is a *table of what drops*, never a predicted amount:
 * every run rolls independently, and printing an expected haul would be
 * inventing a number the engine does not promise.
 */

function ShiftRow({
  label,
  before,
  after,
  unit,
}: {
  label: string;
  before: number;
  after: number;
  unit: string;
}): React.JSX.Element {
  const delta = after - before;
  return (
    <div className="flex items-center gap-2 border border-hairline bg-panel px-3 py-2">
      <span className="min-w-0 flex-1 truncate font-body text-[10px] font-bold uppercase tracking-[0.16em] text-readout-muted">
        {label}
      </span>
      <span className="shrink-0 font-body text-sm tabular-nums text-readout-dim">
        {before.toLocaleString()}
      </span>
      <ArrowRight
        className="h-3 w-3 shrink-0 text-readout-muted"
        strokeWidth={2.4}
        aria-hidden
      />
      <span className="shrink-0 font-body text-sm font-bold tabular-nums text-readout-strong">
        {after.toLocaleString()}
      </span>
      <span className="shrink-0 font-body text-xs tabular-nums text-el-red">
        {delta.toLocaleString()}
      </span>
      <span className="shrink-0 font-body text-[10px] uppercase tracking-[0.12em] text-readout-muted">
        {unit}
      </span>
    </div>
  );
}

export default function AutoClearConfirm({
  eventName,
  difficulty,
  maxRuns,
  staminaCost,
  stamina,
  tickets,
  dropRows,
  onConfirm,
  onCancel,
}: {
  eventName: string;
  difficulty: number;
  /** Most runs the player can afford right now — the slider's ceiling. */
  maxRuns: number;
  staminaCost: number;
  stamina: number;
  tickets: number;
  /** What this difficulty's farmable table can pay, as label/chance pairs. */
  dropRows: [string, string][];
  onConfirm: (runs: number) => void;
  onCancel: () => void;
}): React.JSX.Element {
  // Opens at the full affordable batch: that is what the button did before
  // this modal existed, so the default is the old behaviour and the slider is
  // the new escape from it.
  const [runs, setRuns] = React.useState(maxRuns);

  // The ceiling moves when stamina regenerates under an open modal. Clamping
  // on render rather than in an effect keeps the confirm honest without a
  // second render pass.
  const safeRuns = Math.min(Math.max(runs, 1), Math.max(maxRuns, 1));
  const staminaSpent = safeRuns * staminaCost;

  return (
    <DetailOverlay
      title="Auto Clear"
      subtitle={`${eventName} · difficulty ${difficulty}`}
      onClose={onCancel}
    >
      <div className="border border-hairline bg-panel px-3 py-3">
        <div className="flex items-baseline justify-between">
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
            Runs to skip
          </span>
          <span className="font-heading text-2xl leading-none tracking-[0.04em] tabular-nums text-signal">
            {safeRuns}
            <span className="ml-1 font-body text-[10px] font-semibold text-readout-muted">
              of {maxRuns} affordable
            </span>
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={Math.max(maxRuns, 1)}
          step={1}
          value={safeRuns}
          disabled={maxRuns <= 1}
          onChange={(event) => setRuns(Number(event.target.value))}
          aria-label="Runs to skip"
          className="mt-3 h-1.5 w-full cursor-pointer appearance-none bg-inset accent-signal disabled:cursor-default disabled:opacity-40"
        />
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        <ShiftRow
          label="Stamina"
          before={stamina}
          after={stamina - staminaSpent}
          unit="stamina"
        />
        <ShiftRow
          label="Tickets"
          before={tickets}
          after={tickets - safeRuns}
          unit="tickets"
        />
      </div>

      <p className="mt-2 font-body text-[11px] leading-snug text-readout-muted">
        A ticket skips the fight, never the stamina — {staminaCost} per run, the
        same as entering it yourself.
      </p>

      {dropRows.length > 0 ? (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="mb-2 font-body text-[9px] font-bold uppercase tracking-[0.2em] text-readout-muted">
            Each run rolls from
          </p>
          <div className="flex flex-col gap-1">
            {dropRows.map(([label, chance]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-3 font-body text-[11px]"
              >
                <span className="min-w-0 truncate text-readout">{label}</span>
                <span className="shrink-0 tabular-nums text-readout-muted">
                  {chance}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 font-body text-[10px] leading-snug text-readout-muted">
            Rolled independently per run — no first-clear bundle, and never
            gems.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" size="lg" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="lg"
          className="flex-1"
          disabled={maxRuns < 1}
          onClick={() => onConfirm(safeRuns)}
        >
          Skip ×{safeRuns}
        </Button>
      </div>
    </DetailOverlay>
  );
}

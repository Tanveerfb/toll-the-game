"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import ItemIcon from "@/components/game/ItemIcon";
import { Button } from "@/components/ui/button";
import MountedDialog from "@/components/ui/MountedDialog";
import { INK_TONE } from "@/components/ui/inkTone";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

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
 *
 * **The shadcn `Dialog` since 2026-09-26** (ruling #154), via
 * `MountedDialog`: the caller mounts it only while open, and focus goes back
 * to the Auto clear button that opened it.
 */

function ShiftRow({
  label,
  iconId,
  before,
  after,
  unit,
}: {
  label: string;
  /** The resource being spent, for its icon. */
  iconId: string;
  before: number;
  after: number;
  unit: string;
}): React.JSX.Element {
  const delta = after - before;
  return (
    <div className="flex items-center gap-2 border border-rule bg-muted px-3 py-2">
      <ItemIcon id={iconId} size={20} alt="" />
      <span className="min-w-0 flex-1 truncate font-body text-label font-bold uppercase tracking-label text-muted-foreground">
        {label}
      </span>
      <span className="shrink-0 font-body text-sm tabular-nums text-muted-foreground">
        {before.toLocaleString()}
      </span>
      <ArrowRight
        className="h-3 w-3 shrink-0 text-muted-foreground"
        strokeWidth={2.4}
        aria-hidden
      />
      <span className="shrink-0 font-body text-sm font-bold tabular-nums">
        {after.toLocaleString()}
      </span>
      <span className={cn("shrink-0 font-body text-xs font-bold tabular-nums", INK_TONE.loss)}>
        {delta.toLocaleString()}
      </span>
      <span className="shrink-0 font-body text-label uppercase tracking-label text-muted-foreground">
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
  /** What this difficulty's farmable table can pay, as
   *  `[iconId, label, chance]`. The id is empty for a payout with no icon. */
  dropRows: [string, string, string][];
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
    <MountedDialog
      title="Auto Clear"
      description={`${eventName} · difficulty ${difficulty}`}
      onClose={onCancel}
    >
      <div className="border border-rule bg-muted px-3 py-3">
        <div className="flex items-baseline justify-between">
          <span className="font-body text-label font-bold uppercase tracking-label text-muted-foreground">
            Runs to skip
          </span>
          <span className="font-heading text-2xl leading-none tracking-title tabular-nums">
            {safeRuns}
            <span className="ml-1 font-body text-label font-bold text-muted-foreground">
              of {maxRuns} affordable
            </span>
          </span>
        </div>
        {/* Was a bare `<input type="range">` at `h-1.5` — a 6px band to land a
            thumb in. The `Slider` primitive carries a 44px grab area over a
            hairline track (ruling #107), so the control looks the same and can
            actually be dragged on a phone. */}
        <Slider
          className="mt-3"
          min={1}
          max={Math.max(maxRuns, 1)}
          step={1}
          value={[safeRuns]}
          disabled={maxRuns <= 1}
          onValueChange={([next]) => setRuns(next)}
          aria-label="Runs to skip"
        />
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        <ShiftRow
          label="Stamina"
          iconId="stamina"
          before={stamina}
          after={stamina - staminaSpent}
          unit="stamina"
        />
        <ShiftRow
          label="Tickets"
          iconId="auto_clear_ticket"
          before={tickets}
          after={tickets - safeRuns}
          unit="tickets"
        />
      </div>

      <p className="font-body text-caption leading-snug text-muted-foreground">
        A ticket skips the fight, never the stamina — {staminaCost} per run, the
        same as entering it yourself.
      </p>

      {dropRows.length > 0 ? (
        <div className="border-t border-rule pt-3">
          <p className="mb-2 font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
            Each run rolls from
          </p>
          <div className="flex flex-col gap-1">
            {dropRows.map(([id, label, chance]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 font-body text-caption"
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  <ItemIcon id={id} size={20} alt="" />
                  {label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {chance}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 font-body text-label leading-snug text-muted-foreground">
            Rolled independently per run — no first-clear bundle, and never
            gems.
          </p>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button variant="secondary" size="lg" className="flex-1" onClick={onCancel}>
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
    </MountedDialog>
  );
}

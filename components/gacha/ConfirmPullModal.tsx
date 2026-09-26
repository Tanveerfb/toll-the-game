"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import MountedDialog from "@/components/ui/MountedDialog";
import { Alert } from "@/components/ui/alert";
import { INK_TONE } from "@/components/ui/inkTone";
import { cn } from "@/lib/utils";
import ItemIcon from "@/components/game/ItemIcon";
import { Button } from "@/components/ui/button";

/**
 * Summon confirmation (Tanveer, 2026-08-13).
 *
 * A draw used to fire on the first tap of a button whose only warning was the
 * cost printed on its own face. Spending 50 gems — ten Molvarr first clears'
 * worth — should not be one mis-tap away, and the thing a player most wants to
 * know before confirming is not the price but **what they will have left**.
 *
 * So the preview is a shift, not a total: balance before, balance after, and
 * the same for the milestone bar, with a line when this pull is the one that
 * crosses a threshold. Everything here is derived from values the caller
 * already holds — this component owns no gacha rules and rolls nothing.
 */

/** One before → after row. */
function ShiftRow({
  label,
  iconId,
  before,
  after,
  unit,
  tone = "default",
}: {
  label: string;
  /** Currency this row is about - the icon makes the spend row scannable
   *  without reading the label. Omitted for rows that aren't a currency. */
  iconId?: string;
  before: number;
  after: number;
  unit: string;
  /** `spend` reads the delta as a cost, `gain` as progress. */
  tone?: "default" | "spend" | "gain";
}): React.JSX.Element {
  const delta = after - before;
  // A fill, not coloured text (ruling #154): this sits on paper.
  const deltaTone =
    tone === "spend" ? INK_TONE.loss : tone === "gain" ? INK_TONE.gain : "";
  return (
    <div className="flex items-center gap-2 border border-rule bg-muted px-3 py-2">
      {iconId ? <ItemIcon id={iconId} size={20} alt="" /> : null}
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
      <span className={cn("shrink-0 font-body text-xs font-bold tabular-nums", deltaTone)}>
        {delta > 0 ? "+" : ""}
        {delta.toLocaleString()}
      </span>
      <span className="shrink-0 font-body text-label uppercase tracking-label text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}

export default function ConfirmPullModal({
  bannerName,
  count,
  cost,
  unit,
  iconId,
  balance,
  bar,
  barGain,
  nextThreshold,
  onConfirm,
  onCancel,
}: {
  bannerName: string;
  /** Pulls in this draw — 1 or the multi count. */
  count: number;
  cost: number;
  /** "gems" / "tickets". Already plural. */
  unit: string;
  /** The currency's material id, for its icon - `gems` or `permanent_ticket`. */
  iconId?: string;
  balance: number;
  bar: number;
  /** What this draw adds to the milestone bar. */
  barGain: number;
  /** The next unclaimed milestone, or null when they're all behind you. */
  nextThreshold: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  const balanceAfter = balance - cost;
  const barAfter = bar + barGain;
  const crossesMilestone =
    nextThreshold !== null && bar < nextThreshold && barAfter >= nextThreshold;
  const stillNeeded =
    nextThreshold !== null ? Math.max(0, nextThreshold - barAfter) : 0;

  return (
    <MountedDialog title={`Summon ×${count}`} description={bannerName} onClose={onCancel}>
      <div className="flex flex-col gap-1.5">
        <ShiftRow
          label={unit}
          iconId={iconId}
          before={balance}
          after={balanceAfter}
          unit={unit}
          tone="spend"
        />
        <ShiftRow
          label="Milestone"
          before={bar}
          after={barAfter}
          unit="spent"
          tone="gain"
        />
      </div>

      {crossesMilestone ? (
        <Alert variant="info">
          This draw reaches the {nextThreshold?.toLocaleString()} milestone —
          its reward will be claimable straight after.
        </Alert>
      ) : nextThreshold !== null ? (
        <p className="font-body text-caption leading-snug text-muted-foreground">
          {stillNeeded.toLocaleString()} more {unit} to the{" "}
          {nextThreshold.toLocaleString()} milestone after this draw.
        </p>
      ) : null}

      {count > 1 ? (
        <p className="font-body text-caption leading-snug text-muted-foreground">
          {count} pulls for the price of {count - 1} — the last one is free.
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button variant="secondary" size="lg" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="lg" className="flex-1" onClick={onConfirm}>
          Summon ×{count}
        </Button>
      </div>
    </MountedDialog>
  );
}

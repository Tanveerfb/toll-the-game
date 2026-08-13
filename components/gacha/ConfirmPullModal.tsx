"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import DetailOverlay from "@/components/game/DetailOverlay";
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
  before,
  after,
  unit,
  tone = "default",
}: {
  label: string;
  before: number;
  after: number;
  unit: string;
  /** `spend` reads the delta as a cost, `gain` as progress. */
  tone?: "default" | "spend" | "gain";
}): React.JSX.Element {
  const delta = after - before;
  const deltaTone =
    tone === "spend"
      ? "text-el-red"
      : tone === "gain"
        ? "text-role-heal"
        : "text-readout-dim";
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
      <span className={`shrink-0 font-body text-xs tabular-nums ${deltaTone}`}>
        {delta > 0 ? "+" : ""}
        {delta.toLocaleString()}
      </span>
      <span className="shrink-0 font-body text-[10px] uppercase tracking-[0.12em] text-readout-muted">
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
    <DetailOverlay
      title={`Summon ×${count}`}
      subtitle={bannerName}
      onClose={onCancel}
    >
      <div className="flex flex-col gap-1.5">
        <ShiftRow
          label={unit}
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
        <p className="mt-3 border-l-2 border-el-light bg-el-light/5 px-3 py-2 font-body text-xs text-el-light">
          This draw reaches the {nextThreshold?.toLocaleString()} milestone —
          its reward will be claimable straight after.
        </p>
      ) : nextThreshold !== null ? (
        <p className="mt-3 font-body text-[11px] leading-snug text-readout-muted">
          {stillNeeded.toLocaleString()} more {unit} to the{" "}
          {nextThreshold.toLocaleString()} milestone after this draw.
        </p>
      ) : null}

      {count > 1 ? (
        <p className="mt-1 font-body text-[11px] leading-snug text-readout-muted">
          {count} pulls for the price of {count - 1} — the last one is free.
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" size="lg" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="lg" className="flex-1" onClick={onConfirm}>
          Summon ×{count}
        </Button>
      </div>
    </DetailOverlay>
  );
}

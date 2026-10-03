"use client";

import React from "react";
import MountedDialog from "@/components/ui/MountedDialog";
import { Alert } from "@/components/ui/alert";
import ShiftRow from "@/components/ui/ShiftRow";
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

  return (
    <MountedDialog
      title={`Summon ×${count}`}
      description={bannerName}
      onClose={onCancel}
      // Cancel sits beside Summon; a second close in the corner is one too many.
      showClose={false}
    >
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

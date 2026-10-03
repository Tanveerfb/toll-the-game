import React from "react";

import { cn } from "@/lib/utils";

/**
 * The account-rank progress bar, shared by the top bar and the profile page.
 *
 * A walled rank (XP banking, rank capped until the trial is cleared) fills
 * gold rather than yellow, so a full bar that never moves reads as a state,
 * not a bug. `percent` comes from `summariseRank` (`lib/game/accountSummary`).
 */
export default function RankBar({
  percent,
  walled,
  ready = true,
  className,
}: {
  /** 0–100. */
  percent: number;
  walled: boolean;
  /** `false` before the stores rehydrate: the bar draws empty. */
  ready?: boolean;
  /** Sets the width (the track has none of its own). */
  className?: string;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        "block h-2 overflow-hidden border border-border bg-muted",
        className,
      )}
    >
      <span
        className={cn(
          "block h-full transition-[width] duration-500",
          ready && walled ? "bg-el-light" : "bg-primary",
        )}
        style={{ width: ready ? `${percent}%` : "0%" }}
      />
    </span>
  );
}

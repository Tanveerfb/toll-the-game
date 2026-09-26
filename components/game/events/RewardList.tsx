import * as React from "react";

import ItemIcon from "@/components/game/ItemIcon";
import { cn } from "@/lib/utils";
import type { PreviewRow, RewardRow } from "@/lib/game/worldBossPreview";

/**
 * The two ways this game shows a set of rewards.
 *
 * Audit finding C6, 2026-09-17: reward rows were implemented twice — a tuple
 * type plus three builders inside `app/events/page.tsx`, and a separate
 * `RewardRows` in `StageBrief.tsx`. A new reward type had to be added in both,
 * and the dimming for an already-banked reward existed in one and not the
 * other. `ItemIcon` already centralises the art across 14 files, so the row
 * layout was the only duplicated part.
 *
 * Both take `[iconId, label, amount]` from `lib/game/worldBossPreview.ts`. An
 * empty icon id renders no icon, which is how Account XP — a number, not a
 * thing you hold — appears in a list without inventing art for it.
 */

/**
 * A paid-out list: one row per reward, label left, amount right.
 *
 * Used by the results screens and by Auto Clear's per-run breakdown.
 */
export function RewardList({
  rows,
  className,
}: {
  rows: RewardRow[];
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {rows.map(([id, label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-3 border-b border-rule pb-1.5 last:border-b-0"
        >
          <span className="flex min-w-0 items-center gap-2 font-body text-sm">
            <ItemIcon id={id} size={26} alt="" />
            {label}
          </span>
          <span className="font-heading text-lg tabular-nums">
            +{value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * A promised set: wrapping chips, each an icon beside a label and a figure.
 *
 * Used by the brief, where the figure is often a range rather than a number —
 * which is why it takes `PreviewRow` and formats nothing itself.
 *
 * `tone="highlight"` is the one-off first-clear bundle, on the reward gold so
 * it reads as separate from the farm below it. Showing the two merged is what
 * made the old preview read as *"you get this every time"*.
 */
export function RewardChips({
  rows,
  tone = "default",
  className,
}: {
  rows: PreviewRow[];
  tone?: "default" | "highlight";
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {rows.map(([id, label, amount]) => (
        <span
          key={label}
          className={cn(
            // `min-w` plus `flex-1` so chips fill the row at 390px rather than
            // leaving a ragged tail, and wrap instead of shrinking to slivers.
            "flex min-w-[7rem] flex-1 items-center gap-2 px-2.5 py-1.5",
            tone === "highlight"
              ? "border-2 border-border bg-el-light/45"
              : "border border-rule bg-muted",
          )}
        >
          <ItemIcon id={id} size={28} alt="" />
          <span className="min-w-0">
            <span className="block font-body text-label font-bold uppercase tracking-label text-muted-foreground">
              {label}
            </span>
            <span className="block font-heading text-base">
              {amount}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

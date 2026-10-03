import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The header row of a collapsible block: a 44px button that shows or hides
 * what sits under it.
 *
 * Three screens hand-rolled this with three chevron conventions (audit 3.12,
 * 2026-10-03): the battle log's turns, the substat drawer and the effects
 * sheet's fixed-effects list. One rule now: the chevron points **down when
 * open** and turns to point right when closed, and `aria-expanded` is set
 * here so no caller can forget it.
 *
 * It draws only the row. The caller owns the open state and the content, so
 * the block below it can be a list, a grid or a table.
 *
 * - `solid` is a row on a panel (a turn in the log, the substats).
 * - `dashed` is optional, secondary content you may never want to see: the
 *   same dashed outline an empty slot wears elsewhere in the game.
 */
export default function DisclosureRow({
  label,
  expanded,
  onToggle,
  detail,
  tone = "solid",
  className,
}: {
  label: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  /** A short figure beside the chevron, such as how many rows are inside. */
  detail?: React.ReactNode;
  tone?: "solid" | "dashed";
  className?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-2 px-2.5 py-1.5 font-body text-label font-bold uppercase tracking-label transition-colors",
        tone === "solid"
          ? "bg-muted hover:bg-accent"
          : "border-2 border-dashed border-muted-foreground px-3 text-muted-foreground hover:border-border hover:text-card-foreground",
        className,
      )}
    >
      <span>{label}</span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {detail}
        <ChevronDown
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform",
            !expanded && "-rotate-90",
          )}
        />
      </span>
    </button>
  );
}

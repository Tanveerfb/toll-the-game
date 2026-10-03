import React from "react";
import { ArrowRight } from "lucide-react";
import ItemIcon from "@/components/game/ItemIcon";
import { INK_TONE } from "@/components/ui/inkTone";
import { cn } from "@/lib/utils";

/**
 * One before → after row: what a number is now, what it will be, and the
 * difference. The summon confirm and the Auto Clear confirm both preview a
 * spend this way (a player decides on "what will I have left"), so the row
 * lives once.
 */
export default function ShiftRow({
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

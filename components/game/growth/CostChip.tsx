import React from "react";

import ItemIcon from "@/components/game/ItemIcon";

/**
 * One line of a bill: icon, what it costs, what the account holds.
 *
 * Was `AscensionCost`, private to `CharacterProgressionPanel` and used by one
 * of that modal's three sections. The other two each described cost their own
 * way — a count inside a button's label, and a bare "N owned" line — so the
 * same question got three answers in one modal (audit 2026-09-17).
 *
 * Short lands in red, because the question a player asks at a bill is
 * *which of these am I missing*, and that has to survive a glance. A red FILL
 * with ink on it since Shōnen Ink (ruling #154): red text does not read on
 * paper.
 */
export default function CostChip({
  id,
  label,
  cost,
  owned,
}: {
  /** Item id for `ItemIcon`; empty renders no icon. */
  id: string;
  label: string;
  cost: number;
  owned: number;
}): React.JSX.Element {
  const short = owned < cost;
  return (
    <span
      className={`flex items-center gap-1.5 border-2 px-2 py-1 font-body text-xs tabular-nums ${
        short ? "border-destructive bg-destructive/20" : "border-rule"
      }`}
    >
      <ItemIcon id={id} size={20} alt="" />
      <span className="font-bold">{cost.toLocaleString()}</span>
      <span className={short ? "" : "text-muted-foreground"}>{label}</span>
      <span className={short ? "font-bold" : "text-muted-foreground"}>
        ({owned.toLocaleString()})
      </span>
    </span>
  );
}

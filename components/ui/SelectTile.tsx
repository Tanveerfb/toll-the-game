import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * A tile you pick: a portrait, a boss, a reward. Picked is the action yellow
 * slab, as everywhere else (Shōnen Ink, ruling #154).
 *
 * Hand-rolled about eight times (audit 3.2, 2026-10-03), each with the rule
 * pasted into a comment beside it. The picked look is now this one variant, so
 * a retheme is one edit and `aria-pressed` can't be forgotten.
 *
 * A usage adds only its own layout (size, flex direction, overflow) — never
 * the border, fill or slab. Unit tiles in the team picker are drawn by
 * `UnitTileFace`, which has its own bevel for the same state.
 */
export const selectTileVariants = cva("border-2 transition-colors", {
  variants: {
    selected: {
      true: "border-border ink-slab-primary",
      false: "border-rule hover:border-border",
    },
  },
  defaultVariants: { selected: false },
});

export interface SelectTileProps
  extends Omit<React.ComponentProps<"button">, "type"> {
  /** Whether this tile is the picked one. Drives `aria-pressed`. */
  selected: boolean;
}

export function SelectTile({
  selected,
  className,
  ...props
}: SelectTileProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(selectTileVariants({ selected }), className)}
      {...props}
    />
  );
}

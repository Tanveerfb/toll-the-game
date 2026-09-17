import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * A bordered surface sitting on the void.
 *
 * Measured 2026-09-17 (audit finding C3): `border border-edge-strong bg-panel`
 * typed by hand **15 times**, plus four one-off surface spellings around it.
 * Nothing was wrong with any single one — the problem is that the sixteenth
 * would have been typed by hand too, and a surface retheme meant sixteen
 * edits.
 *
 * Padding comes from the same measurement (finding L3): `px-3 py-2` x34,
 * `px-3 py-2.5` x17, `px-5 py-4` x10, `px-4 py-3` x10, `px-3 py-1.5` x8, and
 * a long tail. Those are three densities and a lot of drift, so three is what
 * this offers.
 *
 * **The side gutter is NOT this component's job** — `Screen` owns it once per
 * page (ruling #107). A panel only pads its own contents.
 */
const panelVariants = cva("border", {
  variants: {
    /** Which surface, from strongest edge to weakest. */
    surface: {
      /** The default: a panel the eye should land on. */
      panel: "border-edge-strong bg-panel",
      /** A quieter block inside or beside a `panel`. */
      quiet: "border-hairline bg-panel",
      /** Recessed — inputs, wells, the ground under a grid of tiles. */
      inset: "border-edge bg-inset",
      /** Lifted, for the one thing on the screen that outranks the rest. */
      raised: "border-edge-strong bg-panel-raised",
    },
    density: {
      /** List rows and chips. */
      tight: "px-3 py-2",
      /** The common case. */
      default: "p-3",
      /** A page's own header block, or a panel that carries a title. */
      roomy: "px-5 py-4",
      /** No padding: the panel is a frame for something that pads itself. */
      none: "",
    },
  },
  defaultVariants: { surface: "panel", density: "default" },
});

export interface PanelProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof panelVariants> {}

export function Panel({
  surface,
  density,
  className,
  ...props
}: PanelProps): React.JSX.Element {
  return (
    <div
      className={cn(panelVariants({ surface, density }), className)}
      {...props}
    />
  );
}

/**
 * A panel's own title bar — the inset strip above its body.
 *
 * Pairs with `density="none"` on the parent: the header pads itself, the body
 * pads itself, and the panel is only the frame. That is the shape the results
 * screens already use by hand.
 */
export function PanelHeader({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      className={cn(
        "border-b border-hairline bg-inset px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

/** A panel's body, padded to match `PanelHeader`. */
export function PanelBody({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export { panelVariants };

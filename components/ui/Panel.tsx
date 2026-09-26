import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * A bordered surface sitting on the ground: paper (Shōnen Ink, ruling #154).
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
    /**
     * Which surface. One, now: ink on paper with a 2px ink outline. The four
     * Combat Terminal surfaces (`panel`, `quiet`, `inset`, `raised`) were
     * deleted on 2026-09-27 when the battle, their last screen, moved over
     * (ruling #156). Kept as a variant so a second surface is a data change.
     */
    surface: {
      paper: "border-2 border-border bg-card text-card-foreground",
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
    /**
     * Lifted off the ground by a slab (Shōnen Ink). `primary` is the yellow
     * slab, which means "act on this": a thing that is ready, not a thing
     * that is merely there.
     */
    lift: {
      none: "",
      slab: "ink-slab",
      primary: "ink-slab-primary",
    },
    /**
     * A panel you press: a tile that is really a button (the home hub's
     * alerts, modes and Orders row). Apply the variant to the `<button>` via
     * `panelVariants`, since `Panel` itself renders a `div`.
     */
    press: {
      false: "",
      true: "text-left transition-colors hover:bg-muted",
    },
  },
  defaultVariants: {
    surface: "paper",
    density: "default",
    lift: "none",
    press: false,
  },
});

export interface PanelProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof panelVariants> {}

export function Panel({
  surface,
  density,
  lift,
  press,
  className,
  ...props
}: PanelProps): React.JSX.Element {
  return (
    <div
      className={cn(panelVariants({ surface, density, lift, press }), className)}
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
        // Paper (ruling #154), like every panel.
        "border-b-2 border-border bg-muted px-5 py-4",
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

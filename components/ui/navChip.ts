import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Every chip in the nav — the counters, Orders, rank, world level, the
 * avatar — is the secondary button: paper, ink outline, 44px (ruling #154).
 * One look defined once, rather than five hand-typed copies of it; the `px-2`
 * is the only thing a chip adds, because the row is tight at 390px.
 *
 * Its own file because `TopNav` renders `OrdersButton`, so the constant
 * cannot live in either without an import cycle.
 */
export const NAV_CHIP = cn(
  buttonVariants({ variant: "secondary", size: "sm" }),
  "gap-1.5 px-2",
);

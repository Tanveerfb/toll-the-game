import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { panelVariants } from "@/components/ui/Panel";
import { cn } from "@/lib/utils";

/**
 * A paper tile that goes somewhere or opens something: the home hub's modes
 * and Orders row, the profile page's Inventory, Account and Characters rows.
 *
 * Home and Profile built this twice with different padding (audit 3.11,
 * 2026-10-03). It is one tile now: an optional leading icon, a title, an
 * optional subtitle, and either a trailing chevron or a trailing badge.
 *
 * Give it `href` for a route, or the usual button props (`onClick`, or a
 * `DialogTrigger asChild` wrapper) to open something. `lift="primary"` is the
 * yellow slab: something is ready to act on.
 */
export default function NavTile({
  title,
  subtitle,
  icon: Icon,
  trailing,
  chevron = false,
  lift = "none",
  href,
  className,
  ...buttonProps
}: Omit<React.ComponentProps<"button">, "title"> & {
  title: string;
  /** A second line: a count, a state, the destination's name. */
  subtitle?: string;
  icon?: React.ElementType;
  /** Anything pinned to the right end, such as a count badge. */
  trailing?: React.ReactNode;
  /** A right chevron, for a row that navigates. */
  chevron?: boolean;
  lift?: "none" | "primary";
  href?: string;
}): React.JSX.Element {
  const classes = cn(
    panelVariants({ surface: "paper", density: "tight", press: true, lift }),
    "flex min-h-11 w-full items-center gap-3",
    className,
  );
  const body = (
    <>
      {Icon ? <Icon className="h-5 w-5 shrink-0" strokeWidth={2} /> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-heading text-lg tracking-title">{title}</span>
        {subtitle ? (
          <span className="font-body text-caption font-bold uppercase tracking-label text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
      {trailing}
      {chevron ? (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <button type="button" className={classes} {...buttonProps}>
      {body}
    </button>
  );
}

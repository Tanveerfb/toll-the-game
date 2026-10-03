import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one way back (audit 3.1, owner decision 2026-10-03: "‹ + destination").
 *
 * It was built five ways with four labels — "‹ Events", "← Character archive",
 * "Back to the menu", "Back to events", "Back to stages". Now a screen names
 * **where the control goes** ("Events", "Exam Arc", "Characters", "Menu") and
 * this draws the chevron: never "Back to ...", never a unicode arrow.
 *
 * A `Button` in the `link` variant, so the 44px floor comes from the
 * primitive (rulings #119–120), not from here. Give it `href` for a route or
 * `onClick` for a view change inside a screen.
 */
export default function BackLink({
  label,
  href,
  onClick,
  className,
}: {
  /** The destination's name, as the player reads it: "Events", "Menu". */
  label: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}): React.JSX.Element {
  const inner = (
    <>
      <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.6} />
      {label}
    </>
  );
  const classes = cn("gap-1 self-start px-0", className);
  return href ? (
    <Button asChild variant="link" size="xs" className={classes}>
      <Link href={href}>{inner}</Link>
    </Button>
  ) : (
    <Button
      variant="link"
      size="xs"
      onClick={onClick}
      className={classes}
    >
      {inner}
    </Button>
  );
}

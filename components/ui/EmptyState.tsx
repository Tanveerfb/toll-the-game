import * as React from "react";

import { panelVariants } from "@/components/ui/Panel";
import { cn } from "@/lib/utils";

/**
 * What a list says when it has nothing to show (audit 3.3, 2026-10-03).
 *
 * It came in three looks and three phrasings across ten files: a dashed box,
 * an uppercase tracked line, and a plain centred one. Now it is one: muted,
 * centred body text that says what is missing and, where there is a next step,
 * what to do about it (`action`, project-rules §16).
 *
 * Inside a paper panel or sheet the line stands alone. On the dark ground it
 * would be unreadable muted-on-dark, so `framed` seats it on its own paper
 * panel (the news feed and the character grid, whose empty states sit
 * straight on the ground).
 */
export default function EmptyState({
  children,
  action,
  framed = false,
  className,
}: {
  children: React.ReactNode;
  /** The way out, as a button: "Show locked units". */
  action?: React.ReactNode;
  /** Seat the line on a paper panel, for use directly on the ground. */
  framed?: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-3 py-6 text-center",
        framed && panelVariants({ surface: "paper", density: "none" }),
        className,
      )}
    >
      <p className="font-body text-xs text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

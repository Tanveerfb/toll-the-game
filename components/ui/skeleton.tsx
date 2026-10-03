import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Shōnen Ink skeleton (audit 4.5, 2026-10-03), from shadcn's: a flat block
 * standing where a value will be, sized by the caller to the final content so
 * nothing shifts when it arrives. Square-cornered, like every other surface
 * in the motif.
 *
 * `—` means "no value", never "loading": an async view shows one of these
 * until its data is real (conventions.md).
 *
 * `tone` follows the surface it sits on, because the motif has two grounds
 * and a block that reads on one vanishes on the other: `paper` (the default)
 * is the hairline-rule tint, `ground` the raised dark tone. The pulse is
 * motion-safe only (project-rules §18).
 */
function Skeleton({
  className,
  tone = "paper",
  ...props
}: React.ComponentProps<"span"> & { tone?: "paper" | "ground" }) {
  return (
    <span
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "inline-block rounded-none align-middle motion-safe:animate-pulse",
        tone === "ground" ? "bg-ground-line" : "bg-rule",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

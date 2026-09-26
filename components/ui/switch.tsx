"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Shōnen Ink switch (ruling #154), from shadcn's: a square track outlined in
 * ink, paper when off and action yellow when on, with a square ink thumb.
 *
 * It draws 24px tall and **hits 44px** (ruling #107): the `after`
 * pseudo-element is the touch target, the same split the slider thumb uses,
 * so the visible control stays small beside a label.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer group/switch relative inline-flex h-6 w-11 shrink-0 items-center rounded-none border-2 border-border p-0.5 transition-colors outline-none after:absolute after:-inset-x-1 after:-inset-y-2.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive data-checked:bg-primary data-unchecked:bg-muted data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-none bg-card-foreground transition-transform data-checked:translate-x-5 data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

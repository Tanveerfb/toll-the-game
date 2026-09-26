"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Shōnen Ink toggle (ruling #154), from shadcn's. Also the item of
 * `ToggleGroup`, which is what a segmented control is here (the boss brief's
 * difficulty row, the archive's filters).
 *
 * Off, it prints in its surface's colour; on, it is action yellow with ink,
 * which reads on both grounds. Every size is 44px (ruling #107): `sm` is
 * narrower type, not a shorter box.
 */
const toggleVariants = cva(
  "group/toggle inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-none border-2 font-body font-bold whitespace-nowrap transition-[color,background-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive data-[state=on]:border-border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-transparent bg-transparent hover:bg-current/10",
        outline: "border-current bg-transparent hover:bg-current/10",
      },
      size: {
        default: "px-3 text-sm",
        sm: "px-2 text-caption uppercase tracking-label",
        lg: "px-4 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Combat Terminal badge (retheme, 2026-08-13).
 *
 * Both existing usages wanted the same thing — a square, body-font, uppercase
 * micro-label — and both had to say so themselves because the stock variants
 * shipped `rounded-4xl` and `bg-primary`. That shape is the default now.
 *
 * Element-coloured badges (the unit name chips in the battle detail panel)
 * still pass their hue as a className: `ELEMENT_SWATCH` is keyed off character
 * data, so it can't be a static variant.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-none border px-1.5 py-0 font-body text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-signal [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-signal bg-signal text-void",
        secondary: "border-edge bg-panel-raised text-readout-strong",
        outline: "border-edge bg-transparent text-readout",
        destructive: "border-el-red bg-el-red/10 text-el-red",
        ghost: "border-transparent bg-transparent text-readout-dim",
        link: "border-transparent text-signal underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Shōnen Ink badge (ruling #154; was Combat Terminal, #84).
 *
 * A square, body-font, uppercase micro-label at the type floor
 * (`text-label`, 10px). `ink` is the motif's own: white lettering on a black
 * slab, skewed, the way a manga labels a panel. `outline` and `ghost` print
 * in whatever colour their surface does, so one variant serves the dark
 * ground and paper alike.
 *
 * Element-coloured badges still pass their hue as a className: the hue is
 * keyed off character data, so it cannot be a static variant. On paper an
 * element hue is a fill or a frame, never the text (docs/design-system.md).
 */
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-none border py-0 font-body text-label font-bold uppercase tracking-label whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-border bg-primary text-primary-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-current bg-transparent",
        ink: "ink-skew border-card-foreground bg-card-foreground text-card",
        destructive: "border-border bg-destructive text-card-foreground",
        /** Something owed or gained: the reward gold, ink on it (audit 3.4). */
        reward: "border-border bg-el-light text-card-foreground",
        /**
         * The caller supplies the fill, because the hue is keyed off game data
         * (a skill's class, a status effect's slot) and cannot be a static
         * variant. Ink on it, so it reads on the ground and on paper alike.
         */
        fill: "border-border text-card-foreground",
        ghost: "border-transparent bg-transparent",
        link: "border-transparent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-5 px-1.5",
        /**
         * The battle log's chips: they sit inside a `text-xs` row, so they
         * grow with their line instead of fixing a height, and pad tighter.
         */
        tight: "h-auto px-1 py-px text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

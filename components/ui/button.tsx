import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Combat Terminal button (retheme, 2026-08-13).
 *
 * This used to ship shadcn's stock variants — `rounded-lg`, `bg-primary`,
 * `bg-muted` — which paint from the greyscale token set. The game paints from
 * the Combat Terminal set (`--color-panel`, `--color-edge`, `--color-signal`,
 * the element hues), so every single usage overrode its own variant on the
 * next line: `variant="outline"` followed by a className restating border,
 * background, radius, font, tracking and colour. Sixteen of thirty-six usages
 * carried such a className.
 *
 * The variants below ARE the game's look, so a usage only needs a className
 * when it wants something the variant genuinely can't know — a width, a grid
 * position, an absolute offset.
 *
 * Two buttons rendered near-white before this change (`bg-primary` showing
 * through a className that overrode text and border but not background): the
 * victory screen's CLAIM REWARDS / RETRY / REMATCH, and the Ascend button in
 * the progression panel. Both were unintended; both read as `signal` now.
 *
 * Chamfered buttons keep their own focus treatment — `.chamfer:focus-visible`
 * in globals.css is unlayered, so its inset ring beats the layered utility
 * ring below rather than fighting it.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-none border bg-clip-padding whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-signal disabled:pointer-events-none disabled:border-hairline disabled:bg-transparent disabled:text-readout-muted [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** Primary action — the one thing the screen wants you to press. */
        default: "border-signal bg-signal text-void hover:bg-signal/85",
        /** Same intent, lower weight: signal as outline rather than fill. */
        secondary:
          "border-signal bg-signal/10 text-signal hover:bg-signal/20",
        /** Neutral action standing beside a primary one. */
        outline:
          "border-edge-strong bg-transparent text-readout-strong hover:border-signal-dim hover:text-signal",
        /** Tertiary — chips, toggles, anything that shouldn't compete. */
        ghost:
          "border-edge bg-transparent text-readout-dim hover:border-edge-strong hover:text-readout",
        /** Forfeits, exits, anything the player can't take back. */
        destructive:
          "border-el-red bg-transparent text-el-red hover:bg-el-red/10",
        link: "border-transparent text-signal underline-offset-4 hover:underline",
      },
      /**
       * Size carries the typeface too, because the two always travelled
       * together: small controls are body-font uppercase readouts, large ones
       * are heading-font display text. Splitting them into separate props
       * would just mean every usage setting both.
       */
      size: {
        xs: "h-6 px-2 font-body text-[10px] font-bold uppercase tracking-[0.14em]",
        sm: "h-7 px-3 font-body text-[11px] font-bold uppercase tracking-[0.14em]",
        default: "h-9 px-4 font-heading text-sm tracking-[0.12em]",
        lg: "h-11 px-5 font-heading text-base tracking-[0.12em]",
        xl: "h-12 px-6 font-heading text-lg tracking-[0.14em]",
        icon: "size-9",
        "icon-xs": "size-6",
        "icon-sm": "size-7",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

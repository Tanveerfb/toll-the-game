import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Shōnen Ink button (ruling #154, 2026-09-26; was Combat Terminal, #84).
 *
 * The variants ARE the game's look, so a usage only adds what a variant
 * cannot know — a width, a grid position — and never restates colour, border,
 * radius or font (#84). Every colour here is a semantic token from
 * `styles/globals.css`; a Combat Terminal name (`signal`, `edge`, `readout`…)
 * in this file fails `tests/uiTokens.test.ts`.
 *
 * **Two grounds.** A button may sit on the dark ground or on a paper panel.
 * The filled variants (`default`, `secondary`, `claim`, `destructive`) carry
 * their own fill and ink, so they read on both. `outline`, `ghost` and `link`
 * take their colour from the surface they sit on (`currentColor`), which is
 * light on the ground and ink on paper — the same variant is right in both
 * places without a second name.
 *
 * **Only the primary action slants** (docs/design-system.md): `default` is
 * skewed; nothing else is. A screen with two skewed buttons has two primary
 * actions, which is a design problem, not a styling one.
 *
 * Kept from the Combat Terminal version: two buttons once rendered near-white
 * because a className overrode text and border but not background, letting
 * the variant's fill show through. Setting all three in the variant is what
 * stops that recurring.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-none border-2 bg-clip-padding whitespace-nowrap transition-[color,background-color,box-shadow] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** Primary action — the one thing the screen wants you to press. */
        default:
          "ink-skew border-border bg-primary text-primary-foreground ink-slab-sm hover:bg-primary/90",
        /** A second action beside the primary one: a paper button. */
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:bg-muted",
        /** Neutral, outlined in whatever colour its surface prints in. */
        outline:
          "border-current bg-transparent hover:bg-current/10",
        /** Tertiary — chips, toggles, anything that shouldn't compete. */
        ghost:
          "border-transparent bg-transparent hover:bg-current/10",
        /**
         * Claiming something owed to you — a reward, a milestone, an order's
         * payout. `el-light` is the reward hue across the game (2026-09-17),
         * used as a fill with ink on it: an element hue is never text on
         * paper (docs/design-system.md).
         */
        claim:
          "border-border bg-el-light text-card-foreground hover:bg-el-light/85",
        /** Forfeits, exits, anything the player can't take back. */
        destructive:
          "border-border bg-destructive text-card-foreground hover:bg-destructive/85",
        link: "border-transparent underline-offset-4 hover:underline",
      },
      /**
       * Size carries the typeface too, because the two always travelled
       * together: small controls are body-font uppercase labels, large ones
       * are heading-font display text.
       *
       * **Every size is at least 44px tall** (ruling #107, 2026-08-21), via
       * `min-h`/`min-w` floors rather than bigger `h-*`, so a row of controls
       * keeps its rhythm. `tests/touchTargets.test.ts` holds it.
       */
      size: {
        xs: "min-h-11 px-2 py-1 font-body text-label font-bold uppercase tracking-label",
        sm: "min-h-11 px-3 py-1.5 font-body text-caption font-bold uppercase tracking-label",
        default: "min-h-11 px-4 py-2 font-heading text-sm tracking-label",
        lg: "min-h-11 px-5 py-2 font-heading text-base tracking-label",
        xl: "min-h-12 px-6 py-2.5 font-heading text-lg tracking-label",
        // One icon size, not four: with a 44px floor, smaller icon sizes
        // would have been `icon` under another name.
        icon: "size-11",
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

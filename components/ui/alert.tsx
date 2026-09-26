import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Shōnen Ink note (ruling #154), from shadcn's `alert`: a paper box with a
 * heavy left rule whose colour says what kind of note it is.
 *
 * It is always opaque paper, so the same note reads on the dark ground (the
 * event brief) and inside a paper dialog (the growth tabs). Before this, notes
 * were hand-typed per screen as a left border plus a translucent wash, and a
 * wash of yellow or red over the dark ground left the text unreadable once the
 * text went ink.
 *
 * - `default` — nothing to do here: an ink rule.
 * - `info` — worth knowing, not blocking: the action yellow.
 * - `destructive` — a blocker the player has to fix: red.
 */
const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-none border-2 border-l-8 border-border bg-card px-3 py-2 text-left font-body text-xs text-card-foreground has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "",
        info: "border-l-primary",
        destructive: "border-l-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      // A blocker is announced; a note is not an alert to a screen reader.
      role={variant === "destructive" ? "alert" : "note"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-bold group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-2",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }

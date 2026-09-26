"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Shōnen Ink tabs (ruling #154), from shadcn's.
 *
 * Two variants, one per ground:
 * - `default` sits on the dark ground. Each tab is a skewed slab; the active
 *   one turns to paper with a yellow slab behind it, which is the mockup's
 *   tab row (`docs/design/mockups/motif-options.html`).
 * - `line` sits inside a paper panel. No slant, an ink underline marks the
 *   active tab, because a panel is for reading (docs/design-system.md).
 *
 * Every trigger is 44px tall (ruling #107).
 */
function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-3 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list flex w-full items-stretch group-data-vertical/tabs:w-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "gap-1.5",
        line: "gap-1 border-b-2 border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-none px-3 font-body text-sm font-bold whitespace-nowrap transition-[color,background-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // On the ground.
        "group-data-[variant=default]/tabs-list:ink-skew group-data-[variant=default]/tabs-list:border-2 group-data-[variant=default]/tabs-list:border-ground-line group-data-[variant=default]/tabs-list:bg-ground-raised group-data-[variant=default]/tabs-list:text-ground-dim group-data-[variant=default]/tabs-list:hover:text-foreground",
        "group-data-[variant=default]/tabs-list:data-active:border-border group-data-[variant=default]/tabs-list:data-active:bg-card group-data-[variant=default]/tabs-list:data-active:text-card-foreground group-data-[variant=default]/tabs-list:data-active:ink-slab-primary",
        // Inside a paper panel.
        "group-data-[variant=line]/tabs-list:-mb-0.5 group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:text-muted-foreground group-data-[variant=line]/tabs-list:hover:text-card-foreground",
        "group-data-[variant=line]/tabs-list:data-active:border-card-foreground group-data-[variant=line]/tabs-list:data-active:text-card-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }

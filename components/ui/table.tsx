"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Combat Terminal table (retheme + first adoption, 2026-08-13).
 *
 * This primitive shipped with the project and had zero importers, so both
 * tables in the app — the Auto Clear results grid and the effects modal — were
 * hand-rolled with raw `<table>` markup that re-derived the same header rule,
 * hairline row borders, uppercase micro-caps and `tabular-nums`. Worse, only
 * one of the two remembered the horizontal overflow wrapper, so the other
 * could push the page sideways on a narrow viewport.
 *
 * The defaults below are what those two tables independently arrived at.
 * `Table` keeps shadcn's `overflow-x-auto` container, which is the specific
 * thing hand-rolled markup keeps forgetting.
 *
 * Numeric columns should still say `text-right tabular-nums` at the usage —
 * that is a property of the data, not of tables in general.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom border-collapse font-body text-xs",
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b [&_tr]:border-edge", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

/** Totals rows — heavier top rule and an inset fill, so a sum never reads as
 *  just another row of data. */
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t-2 border-edge-strong bg-inset font-bold [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("border-b border-hairline transition-colors", className)}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-4 py-2 text-left align-middle font-bold uppercase tracking-[0.14em] whitespace-nowrap text-readout-muted",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-4 py-2 align-middle text-readout", className)}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-3 text-xs text-readout-muted", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

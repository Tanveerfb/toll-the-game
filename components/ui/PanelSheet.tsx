"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * The bottom sheet a panel or a button opens: the summon page's featured pool
 * and milestone track, the character page's Growth, the archive's filters.
 * They all have the same shell (a title, an optional line under it, a padded
 * body, optionally a Done button in the thumb third), so the shell lives once
 * (audit 3.13, 2026-10-03; it was `components/gacha/PanelSheet` until then).
 *
 * The opener is passed in as `trigger`, so radix owns the open state and, with
 * it, focus returning to the opener on close (the hand-written modals this
 * replaced needed `useFocusBackToOpener` for that). `open` and `onOpenChange`
 * are for the caller that must close it from inside: a milestone claim ends
 * in the results screen, and that should not open over a sheet.
 *
 * A sheet that is opened from somewhere with no single button (the battle's
 * controls and log) keeps the raw `Sheet` primitive: its body is not this
 * shape.
 */
export default function PanelSheet({
  trigger,
  title,
  description,
  closeLabel,
  open,
  onOpenChange,
  children,
}: {
  /** The element that opens the sheet. Must be a single element (a button). */
  trigger: React.ReactNode;
  title: string;
  /** Omit when the title says it all; the sheet still names itself for
   *  assistive tech, as radix requires. */
  description?: React.ReactNode;
  /** Adds a full-width close button under the body, e.g. "Done". For a sheet
   *  the player edits (filters) rather than reads. */
  closeLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription
            className={
              description
                ? "text-caption font-bold uppercase tracking-eyebrow"
                : "sr-only"
            }
          >
            {description ?? title}
          </SheetDescription>
        </SheetHeader>
        {/* The footer pads itself, so the body drops its own bottom padding
            when there is one. */}
        <div className={`flex flex-col gap-3 px-4 ${closeLabel ? "" : "pb-4"}`}>
          {children}
        </div>
        {closeLabel ? (
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="secondary">{closeLabel}</Button>
            </SheetClose>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

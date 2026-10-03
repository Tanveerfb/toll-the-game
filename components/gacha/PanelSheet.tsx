"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * The bottom sheet a summon panel opens: the featured pool, the milestone
 * track. Both panels on the manga page are one tap target each, and what they
 * open has the same shell, so the shell lives once.
 *
 * The panel is passed in as `trigger`, so radix owns the open state and, with
 * it, focus returning to the panel on close (the hand-written modals this
 * replaced needed `useFocusBackToOpener` for that). `open` and `onOpenChange`
 * are for the one caller that must close it from inside: a milestone claim
 * ends in the results screen, and that should not open over a sheet.
 */
export default function PanelSheet({
  trigger,
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  /** The panel that opens the sheet. Must be a single element (a button). */
  trigger: React.ReactNode;
  title: string;
  description: string;
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
          <SheetDescription className="text-caption font-bold uppercase tracking-eyebrow">
            {description}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

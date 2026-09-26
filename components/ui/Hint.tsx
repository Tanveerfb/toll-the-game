"use client";

import * as React from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A definition the player can actually reach.
 *
 * Everything explanatory in this game used to be a radix `Tooltip` wrapped
 * around a bare `<span>` — mechanic keywords, the nav's resource counters, the
 * progression panel's feed buttons. A `Tooltip` opens on hover and on focus,
 * and a `<span>` takes neither on a phone: no pointer to hover with, and
 * nothing focusable to tab to. So on the device most players arrive on
 * (ruling #107) the entire mechanic glossary was unreachable — the text was
 * rendered, styled as if it meant something, and did nothing when tapped.
 *
 * `Hint` is a `Popover` instead, which is click-driven and therefore works on
 * touch by construction.
 *
 * The trigger is always a real `<button>`. That is not decoration — it is what
 * makes the thing tappable, focusable and announced as interactive, and it is
 * the half a `<span>` could never provide.
 *
 * **One interaction, every device: click, tap or keyboard.** Hover-to-open was
 * built first and removed the same day, because it fought the click it sat on
 * top of: a mouse fires `pointerenter` before `click`, so hovering opened the
 * popover and the click that followed toggled it straight back shut. Which
 * meant clicking a keyword did nothing — and *whether* it did nothing depended
 * on where the pointer had been, so the behaviour was not even consistently
 * broken. Found by `tests/hint.browser.test.tsx`; nothing in the markup was
 * wrong, which is the argument for testing in a real browser.
 *
 * The cost is a small desktop regression: a keyword no longer explains itself
 * on hover alone. That is the trade for one rule that holds everywhere, and
 * `cursor-help` still marks the word as explanatory.
 */

/** A hint is the shadcn `PopoverContent` (paper, ink outline, slab; ruling
 *  #154) at a readout's size: as wide as its words and no wider than
 *  `max-w-xs`, rather than the popover's fixed `w-72` panel. */
const CONTENT_CLASS = "inline-flex w-fit max-w-xs flex-row items-center gap-1.5 px-3 py-1.5 text-xs";

export default function Hint({
  children,
  content,
  className,
  side = "top",
  align = "center",
  contentClassName,
  ariaLabel,
}: {
  /** The trigger's contents. Rendered inside a `<button>`, so keep it to text
   *  and icons — never another interactive element. */
  children: React.ReactNode;
  content: React.ReactNode;
  /** Classes for the trigger button itself. */
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  contentClassName?: string;
  /** For a trigger whose visible content is a number or a glyph rather than a
   *  word — the counters in the nav, where the label lives only in the hint. */
  ariaLabel?: string;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label={ariaLabel}
        className={className}
        // Keyboard opens it too, and ONLY keyboard focus does.
        //
        // `onFocus` unqualified made a mouse click a no-op: a click focuses
        // first, which opened the popover, and then the trigger's own toggle
        // closed it again — so clicking a keyword did nothing, which is the
        // exact failure this component exists to fix, arriving from the other
        // side. `:focus-visible` matches keyboard focus and not the focus a
        // pointer press incidentally produces.
        //
        // Deliberately no `onBlur` — focus moving *into* the panel would close it.
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) setOpen(true);
        }}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={4}
        collisionPadding={8}
        // A hint is a readout, not a dialogue. Taking focus would strand a
        // keyboard user inside it and, on a phone, scroll the page to it.
        onOpenAutoFocus={(event) => event.preventDefault()}
        className={cn(CONTENT_CLASS, contentClassName)}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}

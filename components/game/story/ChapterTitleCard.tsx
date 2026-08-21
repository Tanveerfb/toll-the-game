"use client";

import React from "react";
import { tapSurfaceProps } from "@/lib/a11y";
import { m } from "framer-motion";

/** How long the card holds before moving on by itself. */
const HOLD_MS = 1400;

/**
 * The beat before a chapter's first scene. The chapter title used to be a
 * small grey label in the corner of the reader; giving it a moment of its own
 * is what makes starting a chapter feel like starting something.
 *
 * Tap dismisses early. Reduced motion skips the animation but keeps the hold,
 * so the card is still readable.
 */
export default function ChapterTitleCard({
  chapterNumber,
  title,
  partTitle,
  onDone,
}: {
  chapterNumber: number;
  title: string;
  partTitle: string;
  onDone: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    const timer = window.setTimeout(onDone, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      {...tapSurfaceProps(onDone, "Continue")}
      className="relative flex h-full w-full flex-1 cursor-pointer items-center justify-center overflow-hidden px-6"
    >
      <div className="text-center">
        <m.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="font-body text-[10px] font-bold uppercase tracking-[0.34em] text-readout-muted"
        >
          {partTitle}
        </m.p>
        <m.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-3 font-body text-[11px] font-bold uppercase tracking-[0.34em] text-signal"
        >
          Chapter {chapterNumber}
        </m.p>
        <m.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-2 font-heading text-5xl tracking-[0.08em] text-readout-strong md:text-6xl"
        >
          {title}
        </m.h2>
        <m.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-5 h-px w-40 bg-signal/70"
        />
      </div>
    </div>
  );
}

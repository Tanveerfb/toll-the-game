"use client";

import React from "react";
import { m } from "framer-motion";
import { Button } from "@/components/ui/button";

/**
 * The completion beat, shown between the outro and the rewards card — on a
 * **first clear only**. A fanfare on the fortieth farm run is noise, which is
 * why `app/story/page.tsx` routes replays straight to rewards.
 *
 * Tap anywhere advances, matching the title card and the versus splash. It
 * keeps no auto-advance timer, and that asymmetry is deliberate: those two are
 * anticipation — you're waiting for something to start, so moving you along is
 * a courtesy — while this one is arrival, with a reward behind it. Rushing the
 * beat the player just earned is the one place a timer would be rude.
 */
export default function ChapterCompleteCard({
  chapterNumber,
  title,
  onContinue,
}: {
  chapterNumber: number;
  title: string;
  onContinue: () => void;
}): React.JSX.Element {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onContinue}
      aria-label="Continue to rewards"
      className="relative flex h-full w-full flex-1 cursor-pointer items-center justify-center overflow-hidden px-6"
    >
      <div className="text-center">
        <m.p
          initial={{ opacity: 0, letterSpacing: "0.6em" }}
          animate={{ opacity: 1, letterSpacing: "0.24em" }}
          transition={{ duration: 0.5 }}
          className="font-heading text-4xl text-signal md:text-5xl"
        >
          CHAPTER COMPLETE
        </m.p>
        <m.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mx-auto mt-4 h-px w-52 bg-signal/70"
        />
        <m.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-4 font-body text-[11px] font-bold uppercase tracking-[0.28em] text-readout-muted"
        >
          Chapter {chapterNumber}
        </m.p>
        <m.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.32 }}
          className="mt-1 font-heading text-3xl tracking-[0.06em] text-readout-strong"
        >
          {title}
        </m.p>
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Button
            onClick={(event) => {
              // The whole card advances on tap, so without this the click
              // fires the handler here and again on the way up.
              event.stopPropagation();
              onContinue();
            }}
            size="xl"
            className="chamfer mt-8 px-10"
          >
            REWARDS ▸
          </Button>
        </m.div>
      </div>
    </div>
  );
}

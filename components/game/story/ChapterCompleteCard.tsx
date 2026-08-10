"use client";

import React from "react";
import { m } from "framer-motion";
import { Button } from "@/components/ui/button";

/**
 * The completion beat, shown between the outro and the rewards card — on a
 * **first clear only**. A fanfare on the fortieth farm run is noise, which is
 * why `app/story/page.tsx` routes replays straight to rewards.
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
    <div className="relative flex h-full w-full flex-1 items-center justify-center overflow-hidden px-6">
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
            onClick={onContinue}
            className="chamfer mt-8 h-12 rounded-none border border-signal bg-signal px-10 font-heading text-lg tracking-[0.12em] text-void"
          >
            REWARDS ▸
          </Button>
        </m.div>
      </div>
    </div>
  );
}

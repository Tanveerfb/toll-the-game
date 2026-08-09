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
          className="font-heading text-3xl text-amber-300 md:text-5xl"
        >
          CHAPTER COMPLETE
        </m.p>
        <m.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mx-auto mt-4 h-px w-52 bg-amber-300/70"
        />
        <m.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-4 font-body text-xs uppercase tracking-[0.24em] text-zinc-400"
        >
          Chapter {chapterNumber}
        </m.p>
        <m.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.32 }}
          className="mt-1 font-heading text-2xl tracking-[0.08em] text-zinc-100 md:text-3xl"
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
            className="mt-8 h-12 rounded-none border-2 border-amber-300 px-10 font-heading text-lg tracking-[0.14em]"
          >
            REWARDS ▸
          </Button>
        </m.div>
      </div>
    </div>
  );
}

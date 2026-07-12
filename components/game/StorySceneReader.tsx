"use client";

import React from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getCharacterArt } from "@/lib/game/characterArt";
import type { StoryScene } from "@/types/story";

/**
 * VN-style scene reader: portrait + name plate + text box, tap/click or
 * Enter/Space to advance, Skip jumps straight to the end of the scene list.
 */
export default function StorySceneReader({
  scenes,
  chapterTitle,
  onFinish,
}: {
  scenes: StoryScene[];
  chapterTitle: string;
  onFinish: () => void;
}): React.JSX.Element {
  const [index, setIndex] = React.useState(0);
  const scene = scenes[index];

  // onFinish must fire outside the setIndex updater — parent setState
  // inside an updater is a setState-during-render violation
  const advance = React.useCallback(() => {
    if (index + 1 >= scenes.length) {
      onFinish();
    } else {
      setIndex(index + 1);
    }
  }, [index, scenes.length, onFinish]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  // Empty scene lists (an outro-less chapter) finish immediately
  React.useEffect(() => {
    if (scenes.length === 0) onFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes.length]);

  if (!scene) {
    return <div className="flex-1" />;
  }

  const art = scene.portraitId ? getCharacterArt(scene.portraitId) : null;
  const side = scene.side ?? "left";

  // div (not <button>): the Skip control nests inside, and button-in-button
  // is invalid HTML → hydration error. Enter/Space handled by the window
  // keydown listener above.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={advance}
      className="relative flex h-full w-full flex-1 cursor-pointer flex-col justify-center overflow-hidden text-left"
      aria-label="Advance story"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
        <p className="font-heading text-sm tracking-[0.18em] text-zinc-500">
          {chapterTitle.toUpperCase()}
        </p>
        <span className="pointer-events-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onFinish();
            }}
            className="rounded-none border border-zinc-700 font-body text-[10px] uppercase tracking-[0.16em] text-zinc-400"
          >
            Skip ▸▸
          </Button>
        </span>
      </div>

      {/* Positioning lives on this wrapper — framer-motion owns the inner
          transform, so a Tailwind -translate-y class there would be clobbered */}
      <div
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${
          side === "left" ? "left-2 md:left-10" : "right-2 md:right-10"
        }`}
      >
        <AnimatePresence mode="popLayout">
          {art ? (
            <motion.div
              key={`${scene.portraitId}-${side}`}
              initial={{ opacity: 0, x: side === "left" ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Image
                src={art}
                alt={scene.speaker ?? scene.portraitId ?? "Portrait"}
                width={512}
                height={512}
                priority
                className="h-56 w-56 border-2 border-zinc-700 object-cover object-top shadow-[0_18px_50px_rgba(0,0,0,0.6)] md:h-80 md:w-80"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <motion.div
        key={index}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 mx-auto w-full max-w-3xl px-4"
      >
        <div className="border-2 border-zinc-700 bg-zinc-950/90 shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-2">
            <p className="font-heading text-lg tracking-[0.14em] text-amber-300">
              {scene.speaker ? scene.speaker.toUpperCase() : "· · ·"}
            </p>
            <p className="font-body text-[10px] uppercase tracking-[0.16em] text-zinc-600">
              {index + 1} / {scenes.length}
            </p>
          </div>
          <p className="min-h-20 px-5 py-4 font-body text-sm leading-relaxed text-zinc-200 md:text-base">
            {scene.text}
          </p>
          <p className="border-t border-zinc-900 px-5 py-1.5 text-right font-body text-[10px] uppercase tracking-[0.16em] text-zinc-600">
            Tap to continue ▸
          </p>
        </div>
      </motion.div>
    </div>
  );
}

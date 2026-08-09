"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chapterKey, isChapterUnlocked } from "@/lib/game/storyCatalog";
import type { StoryPart } from "@/types/story";

export default function StoryChapterList({
  part,
  completed,
  onSelectChapter,
  onBack,
}: {
  part: StoryPart;
  completed: Record<string, boolean>;
  onSelectChapter: (chapterId: string) => void;
  onBack: () => void;
}): React.JSX.Element {
  return (
    <section className="relative z-10 mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
      <Card className="rounded-none border-2 border-zinc-700 bg-black/55 ring-0">
        <CardHeader className="border-b border-zinc-700 px-6 py-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-body text-xs uppercase tracking-[0.16em] text-amber-300">
                Part {part.order}
              </p>
              <CardTitle className="mt-1 font-heading text-4xl tracking-[0.12em] text-zinc-100 md:text-5xl">
                {part.title.toUpperCase()}
              </CardTitle>
              <p className="mt-2 font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                {part.tagline}
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={onBack}
              className="rounded-none border border-zinc-700 font-heading tracking-[0.12em] text-zinc-300"
            >
              ◂ PARTS
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 p-4 md:p-6">
          {part.chapters.map((chapter, index) => {
            const unlocked = isChapterUnlocked(completed, part.id, chapter.id);
            const cleared = completed[chapterKey(part.id, chapter.id)] === true;
            const enemyCount = chapter.battle.enemyTeam.length;
            return (
              <button
                key={chapter.id}
                type="button"
                disabled={!unlocked}
                onClick={() => onSelectChapter(chapter.id)}
                className={`flex items-center justify-between gap-3 border-2 px-4 py-3 text-left transition-colors ${
                  unlocked
                    ? "border-zinc-600 bg-zinc-900/60 hover:border-amber-300 hover:bg-amber-300/5"
                    : "cursor-not-allowed border-zinc-800 bg-zinc-950/60 opacity-50"
                }`}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="font-heading text-3xl text-zinc-600">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-xl tracking-[0.08em] text-zinc-100">
                      {chapter.title}
                    </p>
                    <p className="font-body text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                      {enemyCount} enem{enemyCount === 1 ? "y" : "ies"}
                      {/* Cleared chapters are farmable, so their row advertises
                          the ongoing cost rather than the one-time bonus. */}
                      {cleared ? ` · ${chapter.rewards.replayStamina} stamina` : ""}
                    </p>
                  </div>
                </div>
                {cleared ? (
                  <div className="flex flex-col items-end gap-1">
                    <Badge className="rounded-none border border-amber-300 bg-amber-300/10 font-body text-[10px] uppercase tracking-widest text-amber-200">
                      ✓ Cleared
                    </Badge>
                    <span className="font-body text-[9px] uppercase tracking-[0.16em] text-zinc-400">
                      Replay ▸
                    </span>
                  </div>
                ) : !unlocked ? (
                  <Badge
                    variant="secondary"
                    className="rounded-none font-body text-[10px] uppercase tracking-widest"
                  >
                    Locked
                  </Badge>
                ) : null}
              </button>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

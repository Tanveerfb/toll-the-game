"use client";

import React from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import BattleArena from "@/components/game/BattleArena";
import Deck from "@/components/game/Deck";
import StorySceneReader from "@/components/game/StorySceneReader";
import { useAuth } from "@/hooks/AuthProvider";
import { useBattleContext } from "@/hooks/BattleProvider";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  chapterKey,
  getStoryChapter,
  getStoryPart,
  getStoryParts,
  isChapterUnlocked,
  isPartUnlocked,
  UPCOMING_PARTS,
} from "@/lib/game/storyCatalog";
import { useGameStore } from "@/store/gameStore";
import { useStoryStore } from "@/store/storyStore";

type View =
  | { kind: "parts" }
  | { kind: "chapters"; partId: string }
  | { kind: "intro"; partId: string; chapterId: string }
  | { kind: "battle"; partId: string; chapterId: string }
  | { kind: "outro"; partId: string; chapterId: string };

const PAGE_BG = {
  backgroundImage:
    "radial-gradient(70% 50% at 50% 0%, rgba(245,158,11,0.2), transparent 72%), linear-gradient(140deg, #09090b 0%, #111827 52%, #0a0a0a 100%)",
};

export default function StoryPage(): React.JSX.Element {
  const { user } = useAuth();
  const { startCustomBattle } = useBattleContext();
  const { resetBattle } = useGameStore();
  const { completed, markChapterComplete, hydrateFromCloud } = useStoryStore();
  const [view, setView] = React.useState<View>({ kind: "parts" });

  React.useEffect(() => {
    if (user) void hydrateFromCloud(user.uid);
  }, [user, hydrateFromCloud]);

  const launchBattle = React.useCallback(
    (partId: string, chapterId: string) => {
      const chapter = getStoryChapter(partId, chapterId);
      if (!chapter) return;
      startCustomBattle(chapter.battle.playerTeam, chapter.battle.enemyTeam);
      setView({ kind: "battle", partId, chapterId });
    },
    [startCustomBattle],
  );

  // ---- Battle view: same single-viewport shell as /practice ----
  if (view.kind === "battle") {
    return (
      <main
        className="relative flex h-[calc(100dvh-2.875rem)] flex-col overflow-hidden text-zinc-100"
        style={PAGE_BG}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[36px_36px]" />
        <BattleArena
          story={{
            onContinue: () => {
              resetBattle();
              setView({
                kind: "outro",
                partId: view.partId,
                chapterId: view.chapterId,
              });
            },
            onRetry: () => launchBattle(view.partId, view.chapterId),
            onQuit: () => {
              resetBattle();
              setView({ kind: "chapters", partId: view.partId });
            },
          }}
        />
        <Deck />
      </main>
    );
  }

  // ---- Scene reader views (intro / outro) ----
  if (view.kind === "intro" || view.kind === "outro") {
    const chapter = getStoryChapter(view.partId, view.chapterId);
    if (!chapter) {
      setView({ kind: "parts" });
      return <main className="min-h-screen bg-zinc-950" />;
    }
    const isIntro = view.kind === "intro";
    return (
      <main
        className="relative flex h-[calc(100dvh-2.875rem)] flex-col overflow-hidden text-zinc-100"
        style={PAGE_BG}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[36px_36px]" />
        <StorySceneReader
          key={`${view.partId}-${view.chapterId}-${view.kind}`}
          scenes={isIntro ? chapter.intro : chapter.outro}
          chapterTitle={chapter.title}
          onFinish={() => {
            if (isIntro) {
              launchBattle(view.partId, view.chapterId);
            } else {
              markChapterComplete(view.partId, view.chapterId, user?.uid);
              setView({ kind: "chapters", partId: view.partId });
            }
          }}
        />
      </main>
    );
  }

  // ---- Chapter list ----
  if (view.kind === "chapters") {
    const part = getStoryPart(view.partId);
    if (!part) {
      setView({ kind: "parts" });
      return <main className="min-h-screen bg-zinc-950" />;
    }
    return (
      <main className="relative min-h-screen overflow-hidden bg-zinc-950" style={PAGE_BG}>
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
                  onClick={() => setView({ kind: "parts" })}
                  className="rounded-none border border-zinc-700 font-heading tracking-[0.12em] text-zinc-300"
                >
                  ◂ PARTS
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-4 md:p-6">
              {part.chapters.map((chapter, index) => {
                const unlocked = isChapterUnlocked(
                  completed,
                  part.id,
                  chapter.id,
                );
                const cleared =
                  completed[chapterKey(part.id, chapter.id)] === true;
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() =>
                      setView({
                        kind: "intro",
                        partId: part.id,
                        chapterId: chapter.id,
                      })
                    }
                    className={`flex items-center justify-between gap-3 border-2 px-4 py-3 text-left transition-colors ${
                      unlocked
                        ? "border-zinc-600 bg-zinc-900/60 hover:border-amber-300 hover:bg-amber-300/5"
                        : "cursor-not-allowed border-zinc-800 bg-zinc-950/60 opacity-50"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="font-heading text-3xl text-zinc-600">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-heading text-xl tracking-[0.08em] text-zinc-100">
                          {chapter.title}
                        </p>
                        <p className="font-body text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                          {chapter.battle.enemyTeam.length} enem
                          {chapter.battle.enemyTeam.length === 1 ? "y" : "ies"}
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
      </main>
    );
  }

  // ---- Part select ----
  const parts = getStoryParts();
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950" style={PAGE_BG}>
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <h1 className="font-heading text-4xl tracking-[0.14em] text-zinc-100 md:text-6xl">
          MAIN STORY
        </h1>
        <p className="mt-1 font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
          Arc One — clear chapters in order to unlock the next
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {parts.map((part) => {
            const unlocked = isPartUnlocked(completed, part.id);
            const clearedCount = part.chapters.filter(
              (chapter) => completed[chapterKey(part.id, chapter.id)] === true,
            ).length;
            const art = getCharacterArt(part.coverCharacterId);
            return (
              <button
                key={part.id}
                type="button"
                disabled={!unlocked}
                onClick={() => setView({ kind: "chapters", partId: part.id })}
                className={`group relative flex h-36 items-center overflow-hidden border-2 text-left transition-colors md:h-44 ${
                  unlocked
                    ? "border-zinc-600 bg-zinc-900/60 hover:border-amber-300"
                    : "cursor-not-allowed border-zinc-800 bg-zinc-950/60"
                }`}
              >
                {art ? (
                  <Image
                    src={art}
                    alt={part.title}
                    width={512}
                    height={512}
                    className={`absolute right-0 h-full w-40 object-cover object-top md:w-64 ${
                      unlocked
                        ? "opacity-80 transition-opacity group-hover:opacity-100"
                        : "opacity-25 grayscale"
                    }`}
                  />
                ) : null}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,11,0.95)_45%,transparent_85%)]" />
                <div className={`relative z-10 px-6 ${unlocked ? "" : "opacity-50"}`}>
                  <p className="font-body text-xs uppercase tracking-[0.16em] text-amber-300">
                    Part {part.order}
                  </p>
                  <p className="mt-1 font-heading text-3xl tracking-[0.1em] text-zinc-100 md:text-4xl">
                    {part.title.toUpperCase()}
                  </p>
                  <p className="mt-1 max-w-md font-body text-xs uppercase tracking-[0.12em] text-zinc-400">
                    {part.tagline}
                  </p>
                  <p className="mt-2 font-body text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    {unlocked
                      ? `${clearedCount} / ${part.chapters.length} chapters cleared`
                      : "Locked — clear the previous part"}
                  </p>
                </div>
              </button>
            );
          })}

          {UPCOMING_PARTS.map((upcoming) => (
            <div
              key={upcoming.order}
              className="flex h-24 items-center border-2 border-zinc-800 bg-zinc-950/60 px-6 opacity-50"
            >
              <div>
                <p className="font-body text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Part {upcoming.order}
                </p>
                <p className="mt-1 font-heading text-2xl tracking-[0.1em] text-zinc-400">
                  {upcoming.title.toUpperCase()}
                </p>
                <p className="font-body text-[10px] uppercase tracking-[0.16em] text-zinc-600">
                  Coming soon
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

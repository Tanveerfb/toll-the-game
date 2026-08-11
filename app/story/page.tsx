"use client";

import React from "react";
import BattleArena from "@/components/game/BattleArena";
import Deck from "@/components/game/Deck";
import StorySceneReader from "@/components/game/StorySceneReader";
import ChapterBrief from "@/components/game/story/ChapterBrief";
import ChapterCompleteCard from "@/components/game/story/ChapterCompleteCard";
import ChapterTitleCard from "@/components/game/story/ChapterTitleCard";
import StoryIndex from "@/components/game/story/StoryIndex";
import StoryRewardsScreen from "@/components/game/story/StoryRewardsScreen";
import VersusSplash from "@/components/game/story/VersusSplash";
import { useAuth } from "@/hooks/AuthProvider";
import { useBattleContext } from "@/hooks/BattleProvider";
import { useScreenMusic } from "@/hooks/useScreenMusic";
import type { MusicRole } from "@/lib/audio/tracks";
import { getCurrentStamina } from "@/lib/game/stamina";
import {
  chapterKey,
  getStoryChapter,
  getStoryPart,
} from "@/lib/game/storyCatalog";
import {
  rollStoryRewards,
  storyAttemptCost,
  type StoryClearResult,
} from "@/lib/game/storyRewards";
import { resolveStoryTeam } from "@/lib/game/storyTeam";
import { useGameStore } from "@/store/gameStore";
import { usePlayerStore } from "@/store/playerStore";
import { useStoryStore } from "@/store/storyStore";

/**
 * index → brief → title → intro → versus → battle → outro → complete → rewards
 *                  └────────── skip scenes (cleared) ──────────┘        ↑ first clear only
 *
 * The skip path keeps `versus` deliberately: it's short, it's the beat that
 * makes a fight feel like a fight, and it covers the battle's start-up.
 *
 * `index` used to be two views — a part grid and a per-part chapter list. With
 * sealed chapters redacted the second screen had nothing left to show, so both
 * collapsed into one page (Tanveer, 2026-08-11).
 */
type View =
  | { kind: "index" }
  | { kind: "brief"; partId: string; chapterId: string }
  | { kind: "title"; partId: string; chapterId: string; picks: string[] }
  | { kind: "intro"; partId: string; chapterId: string; picks: string[] }
  | {
      kind: "versus";
      partId: string;
      chapterId: string;
      picks: string[];
      skipScenes: boolean;
    }
  | {
      kind: "battle";
      partId: string;
      chapterId: string;
      picks: string[];
      /** Set from the brief's SKIP STORY button — skips the outro too, so a
       *  farm run goes brief → versus → battle → rewards. */
      skipScenes: boolean;
    }
  | { kind: "outro"; partId: string; chapterId: string }
  | {
      kind: "complete";
      partId: string;
      chapterId: string;
      result: StoryClearResult;
    }
  | { kind: "rewards"; partId: string; chapterId: string; result: StoryClearResult };

/** Which track each step of the flow asks for. Requesting the role that's
 *  already playing is a no-op in the controller, so walking parts → chapters →
 *  brief is one continuous piece of music rather than three restarts. */
function musicRoleFor(view: View): MusicRole {
  switch (view.kind) {
    case "title":
    case "intro":
    case "outro":
      return "storyScene";
    case "versus":
    case "battle":
      return "battle";
    case "complete":
    case "rewards":
      return "victory";
    default:
      return "story";
  }
}

export default function StoryPage(): React.JSX.Element {
  const { user } = useAuth();
  const { startCustomBattle } = useBattleContext();
  const { resetBattle } = useGameStore();
  const { completed, markChapterComplete, hydrateFromCloud } = useStoryStore();
  const roster = usePlayerStore((s) => s.roster);
  const stamina = usePlayerStore((s) => s.stamina);
  const spendStaminaAction = usePlayerStore((s) => s.spendStaminaAction);
  const grantStoryRewards = usePlayerStore((s) => s.grantStoryRewards);
  const rememberLastTeam = usePlayerStore((s) => s.rememberLastTeam);
  const [view, setView] = React.useState<View>({ kind: "index" });

  useScreenMusic(musicRoleFor(view));

  React.useEffect(() => {
    if (user) void hydrateFromCloud(user.uid);
  }, [user, hydrateFromCloud]);

  const launchBattle = React.useCallback(
    (partId: string, chapterId: string, picks: string[]) => {
      const chapter = getStoryChapter(partId, chapterId);
      if (!chapter?.battle) return;
      // `roster` decides which story leads are lent as trial units — an owned
      // lead keeps the player's own progression instead.
      startCustomBattle(
        resolveStoryTeam(chapter, picks, roster),
        chapter.battle.enemyTeam,
        {
          stageEffects: chapter.stageEffects,
          victoryAtEnemyHpPercent: chapter.victoryAtEnemyHpPercent,
        },
      );
    },
    [startCustomBattle, roster],
  );

  /**
   * Rolls and grants the chapter payout, then marks it cleared.
   *
   * Everything happens inside this transition callback rather than an effect:
   * an effect that grants rewards would run twice under React's development
   * double-invoke, and "was this a first clear" has to be read *before*
   * `markChapterComplete` flips it.
   */
  const finishChapter = React.useCallback(
    (partId: string, chapterId: string) => {
      const chapter = getStoryChapter(partId, chapterId);
      if (!chapter) {
        setView({ kind: "index" });
        return;
      }
      const isFirstClear = completed[chapterKey(partId, chapterId)] !== true;
      const result = rollStoryRewards(chapter.rewards, isFirstClear);
      grantStoryRewards(result.total);
      markChapterComplete(partId, chapterId, user?.uid);
      // The completion beat is for finishing a chapter, not for finishing a
      // farm run — a fanfare on the fortieth clear is noise.
      setView(
        isFirstClear
          ? { kind: "complete", partId, chapterId, result }
          : { kind: "rewards", partId, chapterId, result },
      );
    },
    [completed, grantStoryRewards, markChapterComplete, user?.uid],
  );

  /** Pays for one attempt. Uncleared chapters cost nothing however many times
   *  they are retried, so the narrative can never be stamina-locked — only
   *  farming a cleared chapter is gated (Tanveer, 2026-08-09). */
  const chargeAttempt = React.useCallback(
    (partId: string, chapterId: string): boolean => {
      const chapter = getStoryChapter(partId, chapterId);
      if (!chapter) return false;
      const cleared = completed[chapterKey(partId, chapterId)] === true;
      const cost = storyAttemptCost(chapter.rewards, cleared);
      return cost === 0 || spendStaminaAction(cost);
    },
    [completed, spendStaminaAction],
  );

  /** Brief → battle. Returns false when the player can't afford the attempt,
   *  leaving them on the brief with its insufficient-stamina notice. */
  const beginAttempt = React.useCallback(
    (partId: string, chapterId: string, picks: string[], skipScenes: boolean): boolean => {
      if (!chargeAttempt(partId, chapterId)) return false;
      // Remembered on launch, not on selection — a team you assembled and then
      // abandoned isn't the one you want back next time.
      if (picks.length > 0) rememberLastTeam(picks);

      // A scene-only chapter has nothing to fight, so it can't skip to a VS
      // beat that will never resolve — it always opens on the title card and
      // walks intro → outro → complete → rewards (Tanveer, 2026-08-11).
      const sceneOnly = !getStoryChapter(partId, chapterId)?.battle;

      // A farm run jumps the title card and the scenes but still gets the VS
      // beat, which also covers the battle's start-up.
      setView(
        skipScenes && !sceneOnly
          ? { kind: "versus", partId, chapterId, picks, skipScenes: true }
          : { kind: "title", partId, chapterId, picks },
      );
      return true;
    },
    [chargeAttempt, rememberLastTeam],
  );

  /** Restarts the same battle after a defeat, without replaying the scenes. */
  const retryAttempt = React.useCallback(
    (partId: string, chapterId: string, picks: string[]): boolean => {
      if (!chargeAttempt(partId, chapterId)) return false;
      launchBattle(partId, chapterId, picks);
      return true;
    },
    [chargeAttempt, launchBattle],
  );

  // ---- Battle view: same single-viewport shell as /practice ----
  if (view.kind === "battle") {
    return (
      <main
        className="terminal-grid relative flex screen-below-nav flex-col overflow-hidden bg-void text-readout"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[36px_36px]" />
        <BattleArena
          contextLabel={getStoryChapter(view.partId, view.chapterId)?.title}
          story={{
            onContinue: () => {
              resetBattle();
              if (view.skipScenes) {
                finishChapter(view.partId, view.chapterId);
              } else {
                setView({
                  kind: "outro",
                  partId: view.partId,
                  chapterId: view.chapterId,
                });
              }
            },
            // A retry is a fresh attempt: it re-charges stamina if the chapter
            // is already cleared, and drops back to the brief if it can't be
            // paid for. It restarts the battle directly — replaying the intro
            // scenes on every defeat would be punishing.
            onRetry: () => {
              if (retryAttempt(view.partId, view.chapterId, view.picks)) return;
              setView({ kind: "brief", partId: view.partId, chapterId: view.chapterId });
            },
            onQuit: () => {
              resetBattle();
              setView({ kind: "index" });
            },
          }}
        />
        <Deck />
      </main>
    );
  }

  // ---- Chapter title card ----
  if (view.kind === "title") {
    const part = getStoryPart(view.partId);
    const chapter = getStoryChapter(view.partId, view.chapterId);
    if (!part || !chapter) {
      setView({ kind: "index" });
      return <main className="min-h-screen bg-void" />;
    }
    const chapterNumber = part.chapters.findIndex((c) => c.id === chapter.id) + 1;
    return (
      <main
        className="terminal-grid relative flex screen-below-nav flex-col overflow-hidden bg-void text-readout"
      >
        <ChapterTitleCard
          chapterNumber={chapterNumber}
          title={chapter.title}
          partTitle={part.title}
          onDone={() =>
            setView({
              kind: "intro",
              partId: view.partId,
              chapterId: view.chapterId,
              picks: view.picks,
            })
          }
        />
      </main>
    );
  }

  // ---- VS splash ----
  if (view.kind === "versus") {
    const chapter = getStoryChapter(view.partId, view.chapterId);
    // A scene-only chapter can never legitimately reach this view; bouncing
    // to the index beats rendering a splash for a fight that doesn't exist.
    if (!chapter?.battle) {
      setView({ kind: "index" });
      return <main className="min-h-screen bg-void" />;
    }
    return (
      <main
        className="terminal-grid relative flex screen-below-nav flex-col overflow-hidden bg-void text-readout"
      >
        <VersusSplash
          playerTeam={resolveStoryTeam(chapter, view.picks)}
          enemyTeam={chapter.battle.enemyTeam}
          chapterTitle={chapter.title}
          onDone={() => {
            launchBattle(view.partId, view.chapterId, view.picks);
            setView({
              kind: "battle",
              partId: view.partId,
              chapterId: view.chapterId,
              picks: view.picks,
              skipScenes: view.skipScenes,
            });
          }}
        />
      </main>
    );
  }

  // ---- Chapter complete (first clear only) ----
  if (view.kind === "complete") {
    const part = getStoryPart(view.partId);
    const chapter = getStoryChapter(view.partId, view.chapterId);
    const chapterNumber = part
      ? part.chapters.findIndex((c) => c.id === view.chapterId) + 1
      : 0;
    return (
      <main
        className="terminal-grid relative flex screen-below-nav flex-col overflow-hidden bg-void text-readout"
      >
        <ChapterCompleteCard
          chapterNumber={chapterNumber}
          title={chapter?.title ?? ""}
          onContinue={() =>
            setView({
              kind: "rewards",
              partId: view.partId,
              chapterId: view.chapterId,
              result: view.result,
            })
          }
        />
      </main>
    );
  }

  // ---- Scene reader views (intro / outro) ----
  if (view.kind === "intro" || view.kind === "outro") {
    const chapter = getStoryChapter(view.partId, view.chapterId);
    if (!chapter) {
      setView({ kind: "index" });
      return <main className="min-h-screen bg-void" />;
    }
    const isIntro = view.kind === "intro";
    const picks = isIntro ? view.picks : [];
    return (
      <main
        className="terminal-grid relative flex screen-below-nav flex-col overflow-hidden bg-void text-readout"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[36px_36px]" />
        <StorySceneReader
          key={`${view.partId}-${view.chapterId}-${view.kind}`}
          scenes={isIntro ? chapter.intro : chapter.outro}
          chapterTitle={chapter.title}
          // Only guard scenes the player has never seen; a replay's skip is
          // already an explicit choice made on the brief.
          confirmSkip={completed[chapterKey(view.partId, view.chapterId)] !== true}
          onFinish={() => {
            if (!isIntro) {
              finishChapter(view.partId, view.chapterId);
            } else if (chapter.battle) {
              setView({
                kind: "versus",
                partId: view.partId,
                chapterId: view.chapterId,
                picks,
                skipScenes: false,
              });
            } else {
              // Scene-only chapter: the intro runs straight into the outro,
              // with no versus beat and nothing to fight.
              setView({
                kind: "outro",
                partId: view.partId,
                chapterId: view.chapterId,
              });
            }
          }}
        />
      </main>
    );
  }

  // ---- Rewards ----
  if (view.kind === "rewards") {
    const chapter = getStoryChapter(view.partId, view.chapterId);
    return (
      <main
        className="terminal-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-void px-4 py-8"
      >
        <StoryRewardsScreen
          chapterTitle={chapter?.title ?? ""}
          result={view.result}
          onContinue={() => setView({ kind: "index" })}
        />
      </main>
    );
  }

  // ---- Chapter brief ----
  if (view.kind === "brief") {
    const part = getStoryPart(view.partId);
    const chapter = getStoryChapter(view.partId, view.chapterId);
    if (!part || !chapter) {
      setView({ kind: "index" });
      return <main className="min-h-screen bg-void" />;
    }
    const chapterNumber = part.chapters.findIndex((c) => c.id === chapter.id) + 1;
    return (
      <main className="terminal-grid relative min-h-screen bg-void">
        <ChapterBrief
          chapter={chapter}
          chapterNumber={chapterNumber}
          partOrder={part.order}
          cleared={completed[chapterKey(part.id, chapter.id)] === true}
          ownedIds={roster}
          currentStamina={getCurrentStamina(stamina)}
          onStart={(picks, skipScenes) =>
            beginAttempt(view.partId, view.chapterId, picks, skipScenes)
          }
          onBack={() => setView({ kind: "index" })}
        />
      </main>
    );
  }

  // ---- Index: every part and its visible chapters, one page ----
  return (
    <main className="terminal-grid relative min-h-screen bg-void">
      <StoryIndex
        completed={completed}
        onSelectChapter={(partId, chapterId) =>
          setView({ kind: "brief", partId, chapterId })
        }
      />
    </main>
  );
}

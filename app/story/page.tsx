"use client";

import React from "react";
import BattleArena from "@/components/game/BattleArena";
import Deck from "@/components/game/Deck";
import StorySceneReader from "@/components/game/StorySceneReader";
import ChapterBrief from "@/components/game/story/ChapterBrief";
import ChapterCompleteCard from "@/components/game/story/ChapterCompleteCard";
import ChapterTitleCard from "@/components/game/story/ChapterTitleCard";
import ChapterSelect from "@/components/game/story/ChapterSelect";
import PartSelect from "@/components/game/story/PartSelect";
import RouteBoard from "@/components/game/story/RouteBoard";
import StoryRewardsScreen from "@/components/game/story/StoryRewardsScreen";
import StoryStage from "@/components/game/story/StoryStage";
import VersusSplash from "@/components/game/story/VersusSplash";
import { useAuth } from "@/hooks/AuthProvider";
import { useBattleContext } from "@/hooks/BattleProvider";
import { useScreenMusic } from "@/hooks/useScreenMusic";
import type { MusicRole } from "@/lib/audio/tracks";
import { describeOrderReward, ordersForChapter } from "@/lib/game/orders";
import { rollOrbs, routeFor } from "@/lib/game/route";
import { getCurrentStamina } from "@/lib/game/stamina";
import {
  buildStoryIndex,
  buildStoryIndexView,
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
  /** The chapters of one part. `index` picks the part; this picks the chapter. */
  | { kind: "chapterSelect"; partId: string }
  | { kind: "brief"; partId: string; chapterId: string }
  | {
      kind: "title";
      partId: string;
      chapterId: string;
      picks: string[];
      useTrialFor: string[];
      skipScenes: boolean;
    }
  /** The board. Scenes and the fight are entered *from* here and return here,
   *  which is what replaced the old fixed title → intro → versus → battle run. */
  | {
      kind: "board";
      partId: string;
      chapterId: string;
      picks: string[];
      useTrialFor: string[];
      skipScenes: boolean;
    }
  /** A scene block, played from a board tile. `which` says which block, and the
   *  route context rides along so finishing returns to the board. */
  | {
      kind: "scene";
      which: "intro" | "outro";
      partId: string;
      chapterId: string;
      picks: string[];
      useTrialFor: string[];
      skipScenes: boolean;
    }
  | {
      kind: "versus";
      partId: string;
      chapterId: string;
      picks: string[];
      /** Owned anchors the player chose to field as the story's lent copy.
       *  Travels with `picks` because a retry after a defeat has to rebuild
       *  the same team, and the brief is long gone by then. */
      useTrialFor: string[];
      skipScenes: boolean;
    }
  | {
      kind: "battle";
      partId: string;
      chapterId: string;
      picks: string[];
      useTrialFor: string[];
      /** Set from the brief's SKIP STORY button — skips the outro too, so a
       *  farm run goes brief → versus → battle → rewards. */
      skipScenes: boolean;
    }
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
    case "scene":
    case "board":
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
  const activeRoute = useStoryStore((s) => s.activeRoute);
  const beginRoute = useStoryStore((s) => s.beginRoute);
  const advanceRoute = useStoryStore((s) => s.advanceRoute);
  const clearRoute = useStoryStore((s) => s.clearRoute);
  const roster = usePlayerStore((s) => s.roster);
  const stamina = usePlayerStore((s) => s.stamina);
  const spendStaminaAction = usePlayerStore((s) => s.spendStaminaAction);
  const grantStoryRewards = usePlayerStore((s) => s.grantStoryRewards);
  const rememberLastTeam = usePlayerStore((s) => s.rememberLastTeam);
  const claimedOrders = usePlayerStore((s) => s.claimedOrders);
  const [view, setView] = React.useState<View>({ kind: "index" });

  useScreenMusic(musicRoleFor(view));

  React.useEffect(() => {
    if (user) void hydrateFromCloud(user.uid);
  }, [user, hydrateFromCloud]);

  const launchBattle = React.useCallback(
    (partId: string, chapterId: string, picks: string[], useTrialFor: string[]) => {
      const chapter = getStoryChapter(partId, chapterId);
      if (!chapter?.battle) return;
      // `roster` decides which story leads are lent as trial units — an owned
      // lead keeps the player's own progression instead.
      startCustomBattle(
        resolveStoryTeam(chapter, picks, roster, useTrialFor),
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
      const rolled = rollStoryRewards(chapter.rewards, isFirstClear);
      // Loot picked up on the board is paid here, folded into the drops so the
      // summary shows one haul rather than two ledgers. Banked amounts were
      // already rolled when each tile resolved.
      // Only this chapter's own walk pays in. A route abandoned on another
      // chapter must never leak its loot into this payout.
      const walk = useStoryStore.getState().activeRoute;
      const banked =
        walk && walk.partId === partId && walk.chapterId === chapterId
          ? walk
          : null;
      const withLoot = (payout: typeof rolled.drops) => {
        if (!banked) return payout;
        const materials = { ...payout.materials };
        for (const [id, qty] of Object.entries(banked.bankedMaterials)) {
          materials[id] = (materials[id] ?? 0) + qty;
        }
        return { ...payout, coin: payout.coin + banked.bankedCoin, materials };
      };
      const result: StoryClearResult = {
        firstClear: rolled.firstClear,
        drops: withLoot(rolled.drops),
        total: withLoot(rolled.total),
      };
      grantStoryRewards(result.total);
      markChapterComplete(partId, chapterId, user?.uid);
      // The walk is over the moment it pays out; leaving it behind would let a
      // reload drop the player back onto a finished board.
      clearRoute();
      // The completion beat is for finishing a chapter, not for finishing a
      // farm run — a fanfare on the fortieth clear is noise.
      setView(
        isFirstClear
          ? { kind: "complete", partId, chapterId, result }
          : { kind: "rewards", partId, chapterId, result },
      );
    },
    [completed, grantStoryRewards, markChapterComplete, clearRoute, user?.uid],
  );

  /** Pays for one attempt. Charged on every attempt since 2026-08-17 — first
   *  clear and retries alike — which retires the older rule that kept uncleared
   *  chapters free so the story could never be stamina-locked. It can be now. */
  const chargeAttempt = React.useCallback(
    (partId: string, chapterId: string): boolean => {
      const chapter = getStoryChapter(partId, chapterId);
      if (!chapter) return false;
      const cost = storyAttemptCost(chapter.rewards);
      return cost === 0 || spendStaminaAction(cost);
    },
    [spendStaminaAction],
  );

  /** Brief → battle. Returns false when the player can't afford the attempt,
   *  leaving them on the brief with its insufficient-stamina notice. */
  const beginAttempt = React.useCallback(
    (
      partId: string,
      chapterId: string,
      picks: string[],
      skipScenes: boolean,
      useTrialFor: string[],
    ): boolean => {
      if (!chargeAttempt(partId, chapterId)) return false;
      // Remembered on launch, not on selection — a team you assembled and then
      // abandoned isn't the one you want back next time.
      if (picks.length > 0) rememberLastTeam(picks);

      const chapter = getStoryChapter(partId, chapterId);
      if (!chapter) return false;

      /**
       * A chapter with no battle gets no board.
       *
       * 19 of the 37 authored chapters are scene-only, because the source has no
       * fight there and inventing one was ruled out. A board for those is a map
       * with nothing to decide — every tile is empty ground and the only thing
       * that resolves is the scene — so they keep the plain reader they always
       * had. When filler fights are authored (story content adaptation), this
       * branch is what goes away.
       */
      if (!chapter.battle) {
        clearRoute();
        if (skipScenes) {
          finishChapter(partId, chapterId);
        } else {
          setView({
            kind: "scene",
            which: "intro",
            partId,
            chapterId,
            picks,
            useTrialFor,
            skipScenes,
          });
        }
        return true;
      }

      // One attempt buys one walk. Starting a route discards any route already in
      // progress, which is what makes abandoning one cost its stamina.
      const part = getStoryPart(partId);
      const route = routeFor(chapter, part?.order ?? 1);
      const start = route.nodes.find((node) => node.type === "start");
      beginRoute(partId, chapterId, start?.id ?? route.nodes[0].id, rollOrbs());

      // The title card still opens a route; a farm run skips it, as it always
      // skipped the scenes.
      setView(
        skipScenes
          ? { kind: "board", partId, chapterId, picks, useTrialFor, skipScenes }
          : { kind: "title", partId, chapterId, picks, useTrialFor, skipScenes },
      );
      return true;
    },
    [beginRoute, chargeAttempt, clearRoute, finishChapter, rememberLastTeam],
  );

  /**
   * A defeat restarts the **whole route**, not the fight (Tanveer, 2026-08-17).
   *
   * The board is rebuilt from its start tile and the attempt is charged again, so
   * losing costs the walk as well as the stamina. Retrying the fight alone would
   * make the board free to re-roll — you would keep the loot you had banked and
   * take another swing at the boss for nothing.
   */
  const restartRoute = React.useCallback(
    (partId: string, chapterId: string): boolean => {
      if (!chargeAttempt(partId, chapterId)) return false;
      const chapter = getStoryChapter(partId, chapterId);
      if (!chapter) return false;
      const route = routeFor(chapter, getStoryPart(partId)?.order ?? 1);
      const start = route.nodes.find((node) => node.type === "start");
      beginRoute(partId, chapterId, start?.id ?? route.nodes[0].id, rollOrbs());
      return true;
    },
    [beginRoute, chargeAttempt],
  );

  /**
   * A view whose chapter no longer resolves is a broken route — a chapter id
   * that stopped existing under a view still holding it. Reset during render
   * rather than from an effect, which would paint the broken view for a frame
   * first; the `setView` makes this branch unreachable on the next render, so
   * it cannot loop. Every guard in this file funnels here rather than
   * repeating the reset four times.
   */
  const bounceToIndex = (): React.JSX.Element => {
    setView({ kind: "index" });
    return <StoryStage variant="page" />;
  };

  // ---- Battle view: same single-viewport shell as /practice ----
  if (view.kind === "battle") {
    return (
      <StoryStage variant="stage" grid>
        <BattleArena
          contextLabel={getStoryChapter(view.partId, view.chapterId)?.title}
          story={{
            // The boss is the last tile before the finish, so winning it ends
            // the walk: the outro plays and the route pays out. There is no
            // extra tap onto the finish tile — arriving is the same event.
            onContinue: () => {
              resetBattle();
              if (view.skipScenes) {
                finishChapter(view.partId, view.chapterId);
              } else {
                setView({
                  kind: "scene",
                  which: "outro",
                  partId: view.partId,
                  chapterId: view.chapterId,
                  picks: view.picks,
                  useTrialFor: view.useTrialFor,
                  skipScenes: view.skipScenes,
                });
              }
            },
            // A retry is a fresh attempt at the *route*: charged again, walked
            // from the start, banked loot gone. If it can't be paid for, the
            // player lands on the brief with its insufficient-stamina notice.
            onRetry: () => {
              resetBattle();
              if (restartRoute(view.partId, view.chapterId)) {
                setView({
                  kind: "board",
                  partId: view.partId,
                  chapterId: view.chapterId,
                  picks: view.picks,
                  useTrialFor: view.useTrialFor,
                  skipScenes: view.skipScenes,
                });
                return;
              }
              clearRoute();
              setView({ kind: "brief", partId: view.partId, chapterId: view.chapterId });
            },
            // Losing because the team was wrong used to cost a four-step
            // detour — quit, find the chapter again, reopen the brief. This is
            // that detour as one button. It doesn't refund the failed
            // attempt's stamina; starting again from the brief charges afresh,
            // exactly as the long way round did.
            onChangeTeam: () => {
              resetBattle();
              clearRoute();
              setView({ kind: "brief", partId: view.partId, chapterId: view.chapterId });
            },
            // Quitting mid-fight abandons the route, which is the wipe rule: the
            // stamina is spent and the board is gone.
            onQuit: () => {
              resetBattle();
              clearRoute();
              setView({ kind: "chapterSelect", partId: view.partId });
            },
          }}
        />
        <Deck />
      </StoryStage>
    );
  }

  // ---- Chapter title card ----
  if (view.kind === "title") {
    const part = getStoryPart(view.partId);
    const chapter = getStoryChapter(view.partId, view.chapterId);
    if (!part || !chapter) return bounceToIndex();
    const chapterNumber = part.chapters.findIndex((c) => c.id === chapter.id) + 1;
    return (
      <StoryStage variant="stage">
        <ChapterTitleCard
          chapterNumber={chapterNumber}
          title={chapter.title}
          partTitle={part.title}
          // The title card opens onto the board now, not straight into the
          // scenes — the scenes are a tile you walk to.
          onDone={() =>
            setView({
              kind: "board",
              partId: view.partId,
              chapterId: view.chapterId,
              picks: view.picks,
              useTrialFor: view.useTrialFor,
              skipScenes: view.skipScenes,
            })
          }
        />
      </StoryStage>
    );
  }

  // ---- VS splash ----
  if (view.kind === "versus") {
    const chapter = getStoryChapter(view.partId, view.chapterId);
    // A scene-only chapter can never legitimately reach this view; bouncing
    // to the index beats rendering a splash for a fight that doesn't exist.
    if (!chapter?.battle) return bounceToIndex();
    return (
      <StoryStage variant="stage">
        <VersusSplash
          playerTeam={resolveStoryTeam(
            chapter,
            view.picks,
            roster,
            view.useTrialFor,
          )}
          enemyTeam={chapter.battle.enemyTeam}
          chapterTitle={chapter.title}
          onDone={() => {
            launchBattle(
              view.partId,
              view.chapterId,
              view.picks,
              view.useTrialFor,
            );
            setView({
              kind: "battle",
              partId: view.partId,
              chapterId: view.chapterId,
              picks: view.picks,
              useTrialFor: view.useTrialFor,
              skipScenes: view.skipScenes,
            });
          }}
        />
      </StoryStage>
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
      <StoryStage variant="stage">
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
      </StoryStage>
    );
  }

  // ---- Scene reader, played from a board tile ----
  if (view.kind === "scene") {
    const chapter = getStoryChapter(view.partId, view.chapterId);
    if (!chapter) return bounceToIndex();
    const isIntro = view.which === "intro";
    return (
      <StoryStage variant="stage" grid>
        <StorySceneReader
          key={`${view.partId}-${view.chapterId}-${view.which}`}
          scenes={isIntro ? chapter.intro : chapter.outro}
          chapterTitle={chapter.title}
          // Only guard scenes the player has never seen; a replay's skip is
          // already an explicit choice made on the brief.
          confirmSkip={completed[chapterKey(view.partId, view.chapterId)] !== true}
          onFinish={() => {
            // The intro is a tile, so it hands the player back to the board to
            // keep walking — unless there is no board, in which case the chapter
            // is scenes end to end and runs intro straight into outro.
            if (isIntro && !chapter.battle) {
              setView({
                kind: "scene",
                which: "outro",
                partId: view.partId,
                chapterId: view.chapterId,
                picks: view.picks,
                useTrialFor: view.useTrialFor,
                skipScenes: view.skipScenes,
              });
            } else if (isIntro) {
              setView({
                kind: "board",
                partId: view.partId,
                chapterId: view.chapterId,
                picks: view.picks,
                useTrialFor: view.useTrialFor,
                skipScenes: view.skipScenes,
              });
            } else {
              finishChapter(view.partId, view.chapterId);
            }
          }}
        />
      </StoryStage>
    );
  }

  // ---- The board ----
  if (view.kind === "board") {
    const part = getStoryPart(view.partId);
    const chapter = getStoryChapter(view.partId, view.chapterId);
    if (!part || !chapter) return bounceToIndex();
    const route = routeFor(chapter, part.order);
    // A route that isn't the one in the store means a reload landed here with
    // stale view state; send the player back rather than walking a board whose
    // position we don't have.
    if (
      !activeRoute ||
      activeRoute.partId !== view.partId ||
      activeRoute.chapterId !== view.chapterId
    ) {
      setView({ kind: "brief", partId: view.partId, chapterId: view.chapterId });
      return <StoryStage variant="stage" />;
    }
    const bankedCount =
      Object.values(activeRoute.bankedMaterials).reduce((sum, n) => sum + n, 0) +
      (activeRoute.bankedCoin > 0 ? 1 : 0);
    return (
      <StoryStage variant="stage" grid>
        <RouteBoard
          route={route}
          chapterTitle={chapter.title}
          at={activeRoute.at}
          orbs={activeRoute.orbs}
          bankedCoin={activeRoute.bankedCoin}
          bankedCount={bankedCount}
          skipScenes={view.skipScenes}
          onMove={(to, orbs, loot) => {
            // Loot pays once: a tile already resolved banks nothing on a second
            // landing, which matters the moment routes gain loops.
            const already = activeRoute.resolved.includes(to);
            advanceRoute(to, orbs, already ? undefined : loot);
          }}
          onScene={(which) =>
            setView({
              kind: "scene",
              which,
              partId: view.partId,
              chapterId: view.chapterId,
              picks: view.picks,
              useTrialFor: view.useTrialFor,
              skipScenes: view.skipScenes,
            })
          }
          onFight={() =>
            setView({
              kind: "versus",
              partId: view.partId,
              chapterId: view.chapterId,
              picks: view.picks,
              useTrialFor: view.useTrialFor,
              skipScenes: view.skipScenes,
            })
          }
          onFinish={() => finishChapter(view.partId, view.chapterId)}
          onQuit={() => {
            clearRoute();
            setView({ kind: "chapterSelect", partId: view.partId });
          }}
        />
      </StoryStage>
    );
  }

  // ---- Rewards ----
  if (view.kind === "rewards") {
    const chapter = getStoryChapter(view.partId, view.chapterId);
    /**
     * Where the story goes next, offered only after a **first clear**.
     *
     * `completed` has already taken this chapter by the time rewards renders,
     * so the index view's `current` is the chapter after this one — no
     * separate "next" lookup needed. It is deliberately not offered on a
     * replay: `current` tracks the player's furthest point, so clearing an old
     * chapter again would advertise a jump to wherever they actually are,
     * which reads as a bug rather than a shortcut. Replays keep the plain
     * return to the index, mirroring how `finishChapter` already gives first
     * clears the completion beat and sends replays straight here.
     */
    const progressView = buildStoryIndexView(completed);
    const next =
      view.result.firstClear && progressView.current && progressView.lead
        ? {
            partId: progressView.lead.id,
            chapterId: progressView.current.id,
            title: progressView.current.title,
            number: progressView.current.number,
          }
        : null;
    // A Bureau Order this clear just satisfied and hasn't been claimed yet. The
    // chapter card advertised it; this is the other half of that promise.
    const order = ordersForChapter(view.partId, view.chapterId)[0];
    const unlock =
      order && claimedOrders[order.id] !== true
        ? describeOrderReward(order.reward)
        : null;
    return (
      <StoryStage variant="stage">
        <StoryRewardsScreen
          partTitle={getStoryPart(view.partId)?.title ?? ""}
          chapterTitle={chapter?.title ?? ""}
          result={view.result}
          next={next}
          unlock={unlock}
          attemptCost={chapter ? storyAttemptCost(chapter.rewards) : 0}
          onNext={
            next
              ? () =>
                  setView({
                    kind: "brief",
                    partId: next.partId,
                    chapterId: next.chapterId,
                  })
              : undefined
          }
          // Straight back to the brief, which is where a farm loop wants to
          // restart: the team is remembered and one tap runs it again.
          onAgain={() =>
            setView({
              kind: "brief",
              partId: view.partId,
              chapterId: view.chapterId,
            })
          }
          onContinue={() =>
            setView({ kind: "chapterSelect", partId: view.partId })
          }
        />
      </StoryStage>
    );
  }

  // ---- Chapter brief ----
  if (view.kind === "brief") {
    const part = getStoryPart(view.partId);
    const chapter = getStoryChapter(view.partId, view.chapterId);
    if (!part || !chapter) return bounceToIndex();
    const chapterNumber = part.chapters.findIndex((c) => c.id === chapter.id) + 1;
    return (
      <StoryStage variant="page">
        <ChapterBrief
          chapter={chapter}
          chapterNumber={chapterNumber}
          partOrder={part.order}
          cleared={completed[chapterKey(part.id, chapter.id)] === true}
          ownedIds={roster}
          currentStamina={getCurrentStamina(stamina)}
          onStart={(picks, skipScenes, useTrialFor) =>
            beginAttempt(
              view.partId,
              view.chapterId,
              picks,
              skipScenes,
              useTrialFor,
            )
          }
          // Back goes to the part's chapter list, which is where the player came
          // from — not all the way out to part select.
          onBack={() => setView({ kind: "chapterSelect", partId: view.partId })}
        />
      </StoryStage>
    );
  }

  // ---- Chapter select: the chapters of one part, hero over a snapped list ----
  if (view.kind === "chapterSelect") {
    const part = buildStoryIndex(completed).find((p) => p.id === view.partId);
    if (!part) return bounceToIndex();
    return (
      <StoryStage variant="stage">
        <ChapterSelect
          part={part}
          completed={completed}
          onSelectChapter={(partId, chapterId) =>
            setView({ kind: "brief", partId, chapterId })
          }
          onBack={() => setView({ kind: "index" })}
        />
      </StoryStage>
    );
  }

  // ---- Part select: one banner per reached part, snapped vertically ----
  // Locked to the viewport rather than scrolling: a carousel is a moment you
  // flick through, not a document that can outgrow a screen.
  return (
    <StoryStage variant="stage">
      <PartSelect
        completed={completed}
        onSelectPart={(partId) => setView({ kind: "chapterSelect", partId })}
      />
    </StoryStage>
  );
}

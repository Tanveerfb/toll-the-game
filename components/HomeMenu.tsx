"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight, Newspaper, Skull, Sparkles } from "lucide-react";
import ItemIcon from "@/components/game/ItemIcon";
import { useAuth } from "@/hooks/AuthProvider";
import { useScreenMusic } from "@/hooks/useScreenMusic";
import { useGameStore } from "@/store/gameStore";
import { usePlayerStore } from "@/store/playerStore";
import { useStoryStore } from "@/store/storyStore";
import BattleArena from "@/components/game/BattleArena";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";
import { getGemBanner } from "@/lib/gacha/banners";
import { LIMITED_MILESTONE_FIRST } from "@/lib/gacha/milestone";
import { getCurrentStamina } from "@/lib/game/stamina";
import {
  getStoryChapters,
  stageKey,
  stageLabel,
  isStageUnlocked,
} from "@/lib/game/storyCatalog";
import {
  getLastViewedNewsDate,
  hasUnreadNews,
  subscribeToNewsReadState,
} from "@/lib/news/readTracking";

interface HomeMenuProps {
  latestNewsDate: string | null;
}

// Static catalog reads — these resolve at module load from the same JSON the
// engine uses, so the hub can't advertise a roster or banner that doesn't exist.
const PLAYABLE_COUNT = getPlayableCharacters().length;
const GEM_BANNER = getGemBanner();

const STORY_ART = getCharacterArt("duke");

/** Stamina a single World Boss run costs. Mirrors the Molvarr entry in `lib/game/events.ts`;
 *  the hub only reads it to answer "can I afford a run right now". */
const BOSS_STAMINA_COST = 40;

/** Stamina regenerates on a clock, so the affordable-runs count has to be
 *  re-read periodically. Floored to the window so the snapshot is stable. */
const CLOCK_TICK_MS = 30_000;
function subscribeClock(onStoreChange: () => void): () => void {
  const id = setInterval(onStoreChange, CLOCK_TICK_MS);
  return () => clearInterval(id);
}
function getClockSnapshot(): number {
  return Math.floor(Date.now() / CLOCK_TICK_MS) * CLOCK_TICK_MS;
}
function getServerClockSnapshot(): number {
  return 0;
}

/**
 * First unlocked-but-uncleared chapter — the "continue from here" pointer,
 * using the same sequential-unlock rule the story screen enforces. Kept as a
 * plain function rather than an in-component `useMemo`: the early returns
 * inside nested loops defeat React Compiler's memoization preservation, and
 * this walks ~6 chapters.
 */
function findNextStage(cleared: Record<string, boolean>) {
  for (const chapter of getStoryChapters()) {
    for (const stage of chapter.stages) {
      if (cleared[stageKey(chapter.id, stage.id)]) continue;
      if (!isStageUnlocked(cleared, chapter.id, stage.id)) return null;
      return { chapter, stage };
    }
  }
  return null;
}

/**
 * A thing that is true right now and worth acting on. Alerts are conditional
 * by design — the row shrinks to nothing on a fresh account rather than
 * showing three rows of "0 available", which is the failure mode the old
 * eight-card menu had in a different shape.
 */
function Alert({
  icon: Icon,
  iconId,
  title,
  detail,
  tone = "quiet",
  onClick,
}: {
  icon: React.ElementType;
  /** Resource this alert is about — its icon replaces the lucide glyph where
   *  the alert is about something the player holds. */
  iconId?: string;
  title: string;
  detail: string;
  tone?: "quiet" | "ready" | "new";
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-w-[11rem] flex-1 flex-col gap-0.5 border bg-panel px-3 py-2 text-left transition-colors hover:border-edge-strong ${
        tone === "quiet" ? "border-hairline" : "border-edge-strong"
      }`}
    >
      {tone === "new" ? (
        <span className="absolute inset-y-0 left-0 w-0.5 bg-signal" />
      ) : null}
      {iconId ? (
        <span className="absolute right-2 top-2">
          <ItemIcon
            id={iconId}
            size={22}
            alt=""
            fallback={
              <Icon
                className={`h-3.5 w-3.5 ${tone === "quiet" ? "text-readout-muted" : "text-signal"}`}
                strokeWidth={2.2}
              />
            }
          />
        </span>
      ) : (
        <Icon
          className={`absolute right-2.5 top-2.5 h-3.5 w-3.5 ${tone === "quiet" ? "text-readout-muted" : "text-signal"}`}
          strokeWidth={2.2}
        />
      )}
      <span className="pr-6 font-body text-sm font-semibold text-readout-strong">
        {title}
      </span>
      <span className="font-body text-xs text-readout-muted">{detail}</span>
    </button>
  );
}

/** A destination with no live state worth reporting. */
function ModeButton({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-0.5 border border-hairline bg-inset px-3 py-2.5 text-left transition-colors hover:border-edge-strong"
    >
      <span className="font-heading text-lg tracking-[0.05em] text-readout-strong">
        {title}
      </span>
      <span className="font-body text-[11px] font-bold uppercase tracking-[0.1em] text-readout-muted">
        {subtitle}
      </span>
    </button>
  );
}

export default function HomeMenu({ latestNewsDate }: HomeMenuProps) {
  const { user } = useAuth();
  const battlePhase = useGameStore((s) => s.battlePhase);
  const router = useRouter();

  // HomeMenu also hosts a practice battle inline — "initializing" is the
  // no-battle state (see the render branch below), so the hub's theme gives
  // way to the battle track rather than playing under a fight.
  useScreenMusic(
    battlePhase === "initializing"
      ? "menu"
      : battlePhase === "victory"
        ? "victory"
        : "battle",
  );

  const cleared = useStoryStore((s) => s.cleared);
  const storyHydrated = useStoryStore((s) => s.hasHydrated);

  const playerHydrated = usePlayerStore((s) => s.hasHydrated);
  const stamina = usePlayerStore((s) => s.stamina);
  const pity = usePlayerStore((s) => s.pity);
  const roster = usePlayerStore((s) => s.roster);

  const now = React.useSyncExternalStore(
    subscribeClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );

  // localStorage is an external store, so it's read via useSyncExternalStore
  // rather than effect+setState: the server snapshot is always `false` (avoids
  // a hydration mismatch, since the server has no localStorage), and the
  // client snapshot re-syncs on cross-tab "storage" events.
  const hasUnread = React.useSyncExternalStore(
    subscribeToNewsReadState,
    () => hasUnreadNews(latestNewsDate, getLastViewedNewsDate()),
    () => false,
  );

  const nextStage = findNextStage(cleared);
  const clearedInChapter = nextStage
    ? nextStage.chapter.stages.filter(
        (stage) => cleared[stageKey(nextStage.chapter.id, stage.id)],
      ).length
    : 0;

  // Everything below needs both the persisted store and a real clock; until
  // then the alerts row renders nothing rather than a wrong number.
  const ready = playerHydrated && now !== 0;
  const affordableRuns = ready
    ? Math.floor(getCurrentStamina(stamina, now) / BOSS_STAMINA_COST)
    : 0;
  // The banner used to alert on "ends in N days". It has no end date any more
  // (Tanveer, 2026-08-13 — it was always meant to be permanent), so the alert
  // now fires on the only thing left that is actually actionable: an unclaimed
  // first milestone. Manufacturing urgency for a permanent banner would be a
  // lie.
  const gemsToMilestone = ready
    ? Math.max(0, LIMITED_MILESTONE_FIRST - pity.limited.bar)
    : null;
  const milestoneInReach =
    ready && gemsToMilestone !== null && !pity.limited.claimedFirst;

  if (battlePhase !== "initializing") {
    return <BattleArena />;
  }

  return (
    <main className="terminal-grid min-h-dvh bg-void">
      <section className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-7">
        {/* HERO — the one thing to do next, derived from progress rather than
            fixed. The menu this replaced gave MAIN STORY and LOGIN the same
            rectangle, so nothing said what to do first. */}
        <button
          type="button"
          onClick={() => router.push("/story")}
          className="group relative flex h-44 w-full overflow-hidden border border-edge-strong bg-panel text-left md:h-52"
        >
          {STORY_ART ? (
            <>
              <Image
                src={STORY_ART}
                alt=""
                fill
                priority
                sizes="(max-width: 768px) 100vw, 900px"
                className="object-cover object-[64%_12%] opacity-55 transition-transform duration-500 group-hover:scale-105"
              />
              {/* Art is masked back to the left so the title always lands on
                  solid ground, whatever the crop. */}
              <span className="absolute inset-0 bg-linear-to-r from-void via-void/75 to-transparent" />
            </>
          ) : null}

          <span className="relative flex max-w-[64%] flex-col justify-center gap-1 px-5 md:px-7">
            {!storyHydrated ? (
              <span className="font-body text-xs uppercase tracking-[0.2em] text-readout-muted">
                Loading progress…
              </span>
            ) : nextStage ? (
              <>
                <span className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-signal">
                  Continue · {nextStage.chapter.title}
                </span>
                <span className="font-heading text-2xl leading-tight tracking-[0.04em] text-readout-strong md:text-4xl">
                  {stageLabel(nextStage.chapter, nextStage.stage)} · {nextStage.stage.name}
                </span>
                <span className="font-body text-sm text-readout-dim">
                  {clearedInChapter} of {nextStage.chapter.stages.length} stages
                  cleared in this part
                </span>
              </>
            ) : (
              <>
                <span className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-signal">
                  Main story
                </span>
                <span className="font-heading text-2xl leading-tight tracking-[0.04em] text-readout-strong md:text-4xl">
                  All chapters cleared
                </span>
                <span className="font-body text-sm text-readout-dim">
                  Replay any chapter from the story index
                </span>
              </>
            )}
            <span className="mt-2 flex w-fit items-center gap-1.5 border border-signal bg-signal/10 px-4 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-signal">
              {nextStage ? "Resume" : "Story index"}
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.6} />
            </span>
          </span>
        </button>

        {/* ORDERS — the "what do I do next" answer, directly under the "what
            do I do now" one. Retires itself once every order is claimed. */}

        {/* ALERTS — only what is true right now. */}
        {ready || hasUnread ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {affordableRuns > 0 ? (
              <Alert
                icon={Skull}
                iconId="stamina"
                tone="ready"
                title="World Boss ready"
                detail={`${affordableRuns} run${affordableRuns > 1 ? "s" : ""} affordable · ${BOSS_STAMINA_COST} stamina each`}
                onClick={() => router.push("/events")}
              />
            ) : null}
            {milestoneInReach ? (
              <Alert
                icon={Sparkles}
                iconId="gems"
                tone={gemsToMilestone === 0 ? "ready" : "quiet"}
                title={GEM_BANNER.name}
                detail={
                  gemsToMilestone === 0
                    ? "Milestone reward ready to claim"
                    : `${gemsToMilestone.toLocaleString()} gems to your first milestone`
                }
                onClick={() => router.push("/gacha")}
              />
            ) : null}
            {hasUnread ? (
              <Alert
                icon={Newspaper}
                tone="new"
                title="Unread notices"
                detail="Patch notes and notices"
                onClick={() => router.push("/news")}
              />
            ) : null}
          </div>
        ) : null}

        {/* The rest. Quiet on purpose — the nav already routes to all of them;
            these exist so the hub isn't a dead end, not to compete with the
            hero for attention. */}
        <div className="mt-2.5 grid grid-cols-2 gap-2 md:grid-cols-3">
          <ModeButton
            title="World Boss"
            subtitle="Molvarr"
            onClick={() => router.push("/events")}
          />
          <ModeButton
            title="Gacha"
            subtitle={GEM_BANNER.name}
            onClick={() => router.push("/gacha")}
          />
          <ModeButton
            title="Archive"
            subtitle={
              playerHydrated
                ? `${roster.length} of ${PLAYABLE_COUNT} owned`
                : `${PLAYABLE_COUNT} characters`
            }
            onClick={() => router.push("/archive")}
          />
          <ModeButton
            title="Practice"
            subtitle="Sandbox — pick both teams"
            onClick={() => router.push("/practice")}
          />
          <ModeButton
            title="News"
            subtitle="Updates & notices"
            onClick={() => router.push("/news")}
          />
          <ModeButton
            title={user ? "Profile" : "Sign in"}
            subtitle={user ? "Account & cloud save" : "Sync progress"}
            onClick={() => router.push(user ? "/profile" : "/login")}
          />
        </div>
      </section>
    </main>
  );
}

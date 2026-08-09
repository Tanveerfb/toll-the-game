"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { useScreenMusic } from "@/hooks/useScreenMusic";
import { useGameStore } from "@/store/gameStore";
import { useStoryStore } from "@/store/storyStore";
import BattleArena from "@/components/game/BattleArena";
import PlayerHud from "@/components/game/PlayerHud";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";
import { getActiveLimitedBanner } from "@/lib/gacha/banners";
import {
  chapterKey,
  getStoryParts,
  isChapterUnlocked,
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
const LIMITED_BANNER = getActiveLimitedBanner();

const STORY_ART = getCharacterArt("duke");
const BOSS_ART = getCharacterArt("molvarr");
const BANNER_ART = "/banners/debut-2026-08.png";

/**
 * First unlocked-but-uncleared chapter — the "continue from here" pointer,
 * using the same sequential-unlock rule the story screen enforces. Kept as a
 * plain function rather than an in-component `useMemo`: the early returns
 * inside nested loops defeat React Compiler's memoization preservation, and
 * this walks ~6 chapters.
 */
function findNextChapter(completed: Record<string, boolean>) {
  for (const part of getStoryParts()) {
    for (const chapter of part.chapters) {
      if (completed[chapterKey(part.id, chapter.id)]) continue;
      if (!isChapterUnlocked(completed, part.id, chapter.id)) return null;
      return { part, chapter };
    }
  }
  return null;
}

/** Tier drives visual weight. The old menu gave MAIN STORY and LOGIN the same
 *  rectangle, so nothing on screen said what to do first. */
type Tier = "primary" | "secondary" | "tertiary";

const TIER_FRAME: Record<Tier, string> = {
  primary:
    "h-40 border-2 border-amber-300 shadow-[0_12px_40px_rgba(245,158,11,0.22)] md:h-52",
  secondary: "h-28 border-2 border-zinc-600 md:h-32",
  tertiary: "h-20 border border-zinc-700 md:h-[5.5rem]",
};

const TIER_TITLE: Record<Tier, string> = {
  primary: "text-3xl md:text-5xl",
  secondary: "text-xl md:text-2xl",
  tertiary: "text-lg md:text-xl",
};

function ModeCard({
  title,
  subtitle,
  art,
  artPosition = "object-[70%_22%]",
  tier,
  accent,
  badge,
  onClick,
}: {
  title: string;
  subtitle?: string;
  art?: string | null;
  /**
   * `object-position` for the art. These cards are wide and short, so a
   * cover-fit square portrait only ever shows a horizontal band of itself —
   * which band is worth showing depends entirely on the source image, so it's
   * tuned per card rather than guessed from one global value.
   */
  artPosition?: string;
  tier: Tier;
  /** Tailwind text color for the title — the mode's identity color. */
  accent: string;
  badge?: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden bg-zinc-950/70 text-left transition-all hover:brightness-125 ${TIER_FRAME[tier]}`}
    >
      {art ? (
        <>
          {/* Art sits right-of-centre and is masked back to the left so the
              title always lands on solid colour, whatever the crop. */}
          <Image
            src={art}
            alt=""
            fill
            // The primary card's art is reliably the LCP element — it's the
            // biggest thing above the fold on every viewport.
            priority={tier === "primary"}
            sizes="(max-width: 768px) 100vw, 640px"
            className={`object-cover ${artPosition} opacity-60 transition-transform duration-500 group-hover:scale-105`}
          />
          <span className="absolute inset-0 bg-linear-to-r from-zinc-950 via-zinc-950/80 to-transparent" />
        </>
      ) : null}

      <span className="relative flex h-full items-center justify-between gap-3 px-4 md:px-6">
        <span className="min-w-0">
          <span
            className={`block truncate font-heading tracking-[0.12em] ${TIER_TITLE[tier]} ${accent}`}
          >
            {title}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block truncate font-body text-[11px] uppercase tracking-[0.16em] text-zinc-400 md:text-xs">
              {subtitle}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge ? (
            <span className="bg-amber-400 px-1.5 py-0.5 font-body text-[9px] font-black uppercase tracking-widest text-zinc-950">
              {badge}
            </span>
          ) : null}
          <ChevronRight
            className={`h-5 w-5 ${accent} opacity-50 transition-transform group-hover:translate-x-1`}
            strokeWidth={2.4}
          />
        </span>
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

  const completed = useStoryStore((s) => s.completed);
  const storyHydrated = useStoryStore((s) => s.hasHydrated);

  // localStorage is an external store, so it's read via useSyncExternalStore
  // rather than effect+setState: the server snapshot is always `false` (avoids
  // a hydration mismatch, since the server has no localStorage), and the
  // client snapshot re-syncs on cross-tab "storage" events.
  const hasUnread = React.useSyncExternalStore(
    subscribeToNewsReadState,
    () => hasUnreadNews(latestNewsDate, getLastViewedNewsDate()),
    () => false
  );

  const nextChapter = findNextChapter(completed);

  const storySubtitle = !storyHydrated
    ? "Loading progress…"
    : nextChapter
      ? `${nextChapter.part.title} · ${nextChapter.chapter.title}`
      : "All chapters cleared";

  if (battlePhase !== "initializing") {
    return <BattleArena />;
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-zinc-950"
      style={{
        backgroundImage:
          "radial-gradient(80% 45% at 85% 0%, rgba(245,158,11,0.18), transparent 72%), radial-gradient(65% 50% at 0% 100%, rgba(16,185,129,0.2), transparent 75%), linear-gradient(145deg, #09090b 0%, #111827 48%, #0a0a0a 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[40px_40px] opacity-25" />

      <section className="relative z-10 mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
        <p className="mb-3 font-heading text-2xl tracking-[0.24em] text-zinc-500 md:text-3xl">
          TOLL THE GAME
        </p>

        <PlayerHud />

        <div className="mt-3 grid gap-2.5 md:mt-4 md:gap-3">
          {/* Tier 1 — the thing to do next */}
          <ModeCard
            tier="primary"
            accent="text-amber-200"
            title="MAIN STORY"
            subtitle={storySubtitle}
            art={STORY_ART}
            // Duke's portrait puts his face in the upper third of a square.
            artPosition="object-[64%_12%]"
            onClick={() => router.push("/story")}
          />

          {/* Tier 2 — the live-content modes */}
          <div className="grid gap-2.5 sm:grid-cols-2 md:gap-3">
            <ModeCard
              tier="secondary"
              accent="text-red-200"
              title="WORLD BOSS"
              subtitle="Molvarr · 40 stamina"
              art={BOSS_ART}
              onClick={() => router.push("/world-boss")}
            />
            <ModeCard
              tier="secondary"
              accent="text-pink-200"
              title="GACHA"
              subtitle={LIMITED_BANNER.name}
              art={BANNER_ART}
              // Already a wide composite splash — show it centred, not cropped
              // to one side like the square character portraits.
              artPosition="object-[50%_35%]"
              onClick={() => router.push("/gacha")}
            />
          </div>

          {/* Tier 3 — reference and sandbox */}
          <div className="grid gap-2.5 sm:grid-cols-2 md:gap-3">
            <ModeCard
              tier="tertiary"
              accent="text-zinc-100"
              title="ARCHIVE"
              subtitle={`${PLAYABLE_COUNT} characters`}
              onClick={() => router.push("/archive")}
            />
            <ModeCard
              tier="tertiary"
              accent="text-emerald-200"
              title="PRACTICE"
              subtitle="Sandbox — pick both teams"
              onClick={() => router.push("/practice")}
            />
          </div>

          {/* Utility row */}
          <div className="grid gap-2.5 sm:grid-cols-2 md:gap-3">
            <ModeCard
              tier="tertiary"
              accent="text-violet-200"
              title="NEWS"
              subtitle="Updates & notices"
              badge={hasUnread ? "New" : undefined}
              onClick={() => router.push("/news")}
            />
            <ModeCard
              tier="tertiary"
              accent="text-sky-200"
              title={user ? "PROFILE" : "LOGIN"}
              subtitle={user ? "Account & cloud save" : "Sync progress to the cloud"}
              onClick={() => router.push(user ? "/profile" : "/login")}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

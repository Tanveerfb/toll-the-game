"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Newspaper, Skull, Sparkles } from "lucide-react";
import ItemIcon from "@/components/game/ItemIcon";
import OrdersButton from "@/components/game/OrdersButton";
import { useAuth } from "@/hooks/AuthProvider";
import { useScreenMusic } from "@/hooks/useScreenMusic";
import { usePlayerStore } from "@/store/playerStore";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";
import { getGemBanner } from "@/lib/gacha/banners";
import { LIMITED_MILESTONE_FIRST } from "@/lib/gacha/milestone";
import { getCurrentStamina } from "@/lib/game/stamina";
import {
  getLastViewedNewsDate,
  hasUnreadNews,
  subscribeToNewsReadState,
} from "@/lib/news/readTracking";
import { Screen } from "@/components/ui/Screen";

interface HomeMenuProps {
  latestNewsDate: string | null;
}

// Static catalog reads — these resolve at module load from the same JSON the
// engine uses, so the hub can't advertise a roster or banner that doesn't exist.
const PLAYABLE_COUNT = getPlayableCharacters().length;
const GEM_BANNER = getGemBanner();

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
      <span className="font-heading text-lg tracking-title text-readout-strong">
        {title}
      </span>
      <span className="font-body text-[11px] font-bold uppercase tracking-label text-readout-muted">
        {subtitle}
      </span>
    </button>
  );
}

export default function HomeMenu({ latestNewsDate }: HomeMenuProps) {
  const { user } = useAuth();
  const router = useRouter();

  // The hub no longer hosts a battle (see the note where it used to, below),
  // so it only ever plays its own theme.
  useScreenMusic("menu");

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

  // This used to render any live battle inline, making the hub a second
  // screen a battle could appear on — with no owner's handlers, so a boss won
  // here paid nothing. `BattleLock` now routes a live battle back to the
  // screen that owns it, and the hub never sees one (2026-09-26).
  return (
    <Screen width="app">
        {/* The hero card that sat here was story mode's "continue" pointer,
            removed with story on 2026-09-26. What leads the hub now is his
            call; until then Orders does. */}

        {/* ORDERS — the "what do I do next" answer, directly under the "what
            do I do now" one. Retires itself once every order is claimed.

            Restored as a full-width row on 2026-09-01 (Tanveer). It had been
            moved to the nav on 2026-08-13 so it was reachable from every
            screen, but the nav row it moved to is `sm:` and up: on a phone the
            only trace of a claimable order was an unlabelled count badge on
            the wordmark. `OrdersButton` renders nothing when there is nothing
            to claim, so this costs no space once the board retires. */}
        <div className="mt-2.5">
          <OrdersButton variant="tile" />
        </div>

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
    </Screen>
  );
}

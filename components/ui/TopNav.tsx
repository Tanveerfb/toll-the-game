"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Coins,
  Gem,
  Newspaper,
  Skull,
  Sparkles,
  Swords,
  User as UserIcon,
  Zap,
} from "lucide-react";
import AudioControl from "@/components/ui/AudioControl";
import OrdersButton from "@/components/game/OrdersButton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DuelToggle from "@/components/ui/DuelToggle";
import { GAME_ROUTES, isRouteActive } from "@/lib/nav/routes";
import { useAuth } from "@/hooks/AuthProvider";
import { useGameStore } from "@/store/gameStore";
import { usePlayerStore } from "@/store/playerStore";
import { useStoryStore } from "@/store/storyStore";
import { getCurrentStamina, STAMINA_CAP } from "@/lib/game/stamina";
import { rankProgress } from "@/lib/game/accountRank";
import { claimableCount, evaluateOrders } from "@/lib/game/orders";
import { firebaseEnabled } from "@/lib/firebase";

/** Never resubscribes — it exists only so the server snapshot and the client
 *  snapshot differ, which is how a client-only branch stays hydration-safe. */
const NO_SUBSCRIBE = () => () => {};

/** Stamina regenerates 1 per 5 minutes; re-reading every 30s keeps the bar
 *  honest without a per-second timer nobody is watching. Floored to the tick
 *  window so repeated snapshot reads return an identical value. */
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

const ROUTE_ICON: Record<string, React.ElementType> = {
  "/story": BookOpen,
  "/events": Skull,
  "/gacha": Sparkles,
  "/archive": BookOpen,
  "/practice": Swords,
  "/news": Newspaper,
  "/profile": UserIcon,
};

/** Archive and story would otherwise share `BookOpen`. */
const ARCHIVE_ICON = Coins;

/**
 * One counter on the resource strip.
 *
 * The explanation used to ride on a native `title`, which is unstyleable and —
 * the reason this moved — never appears on touch at all. Every player on a
 * phone saw three unlabelled numbers with no way to learn what they were. A
 * Radix tooltip opens on focus and on tap, so the answer is reachable without
 * a mouse.
 */
function Resource({
  icon: Icon,
  value,
  suffix,
  title,
}: {
  icon: React.ElementType;
  value: string;
  suffix?: string;
  title: string;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={title}
          className="flex shrink-0 cursor-help items-center gap-1.5 border border-hairline bg-void px-2 py-0.5 transition-colors hover:border-edge-strong"
        >
          <Icon
            className="h-3 w-3 shrink-0 text-readout-muted"
            strokeWidth={2.4}
          />
          <span className="font-body text-[11px] font-bold tabular-nums text-readout-strong">
            {value}
            {suffix ? (
              <span className="font-semibold text-readout-muted">{suffix}</span>
            ) : null}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

export default function TopNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Client-only from here down. The server renders both rows with placeholder
  // values, so the markup matches on hydration and `--nav-h` doesn't jump.
  const mounted = React.useSyncExternalStore(
    NO_SUBSCRIBE,
    () => true,
    () => false,
  );
  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const currencies = usePlayerStore((s) => s.currencies);
  const stamina = usePlayerStore((s) => s.stamina);
  const account = usePlayerStore((s) => s.account);
  const worldLevel = usePlayerStore((s) => s.worldLevel);
  const battlePhase = useGameStore((s) => s.battlePhase);

  const stats = usePlayerStore((s) => s.stats);
  const presets = usePlayerStore((s) => s.presets);
  const roster = usePlayerStore((s) => s.roster);
  const characters = usePlayerStore((s) => s.characters);
  const claimedOrders = usePlayerStore((s) => s.claimedOrders);
  const cleared = useStoryStore((s) => s.cleared);
  const storyHydrated = useStoryStore((s) => s.hasHydrated);

  const orderBoard = React.useMemo(
    () =>
      evaluateOrders({
        clearedStages: cleared,
        pulls: stats.pulls,
        bossClears: stats.bossClears,
        presetsSaved: presets.length,
        rosterSize: roster.length,
        accountRank: account.rank,
        characters,
        claimed: claimedOrders,
      }),
    [cleared, stats, presets.length, roster.length, account.rank, characters, claimedOrders],
  );

  const now = React.useSyncExternalStore(
    subscribeClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );
  const ready = mounted && hasHydrated && now !== 0;
  const dash = "—";

  // The resource strip stands down during a fight: the battle screen is the
  // one place that needs every pixel, and none of these numbers change mid-
  // battle anyway. Gated on `mounted` because `battlePhase` comes back from
  // sessionStorage — branching on it during the first render would mismatch.
  const inBattle = mounted && battlePhase !== "initializing";
  const rows = inBattle ? 1 : 2;

  const currentStamina = ready ? getCurrentStamina(stamina, now) : 0;
  // `null` means the rank is walled — XP is banking but the rank can't rise
  // until the ascension trial for this band is cleared. A full bar that never
  // moves would read as a bug, so the walled case gets its own marker.
  const progress = rankProgress(account, account.clearedWalls);

  // Gated on `ready` for the same reason as the resource strip: both stores
  // rehydrate from localStorage, and a badge that appears and then vanishes
  // reads as a bug.
  //
  // Also gated on being signed in: claiming needs an account, and a count on
  // every screen that leads to a locked panel is nagging, not enticing. The
  // pitch belongs on the home panel, once.
  const canClaimOrders = !firebaseEnabled || !!user;
  const readyOrders =
    ready && storyHydrated && canClaimOrders ? claimableCount(orderBoard) : 0;
  const rankPercent = progress
    ? Math.min(100, (progress.current / progress.required) * 100)
    : 100;

  return (
    <nav
      // `--nav-h` is derived from this attribute (styles/globals.css), and
      // `.screen-below-nav` is what every full-height screen measures against.
      data-nav-rows={rows}
      className="sticky top-0 z-50 border-b border-edge bg-void/90 backdrop-blur-sm"
    >
      {/* Row 1 — identity and routes. Fixed height; the battle shell's maths
          survives on this row alone. */}
      <div className="mx-auto flex h-11 w-full max-w-6xl items-center gap-3 px-4 md:gap-5 md:px-8">
        {/* The wordmark is the only route home — there used to be a "Menu"
            link beside it doing exactly the same thing. */}
        <Link
          href="/"
          title={
            readyOrders > 0
              ? `${readyOrders} Bureau order${readyOrders > 1 ? "s" : ""} ready to claim`
              : "Home"
          }
          className="relative shrink-0 font-heading text-xl tracking-[0.2em] text-signal"
        >
          TOLL
          {/* Orders live on the home screen, so the count rides the one link
              that goes there. Without it a claimable reward is invisible from
              every other screen. */}
          {readyOrders > 0 ? (
            <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center bg-el-light px-1 font-body text-[9px] font-bold tabular-nums leading-none text-void">
              {readyOrders}
            </span>
          ) : null}
        </Link>
        <div className="hud-scroll flex min-w-0 items-center gap-1 overflow-x-auto">
          {GAME_ROUTES.filter((route) => route.href !== "/").map((route) => {
            const active = isRouteActive(route.href, pathname);
            const Icon =
              route.href === "/archive"
                ? ARCHIVE_ICON
                : (ROUTE_ICON[route.href] ?? Swords);
            return (
              <Link
                key={route.href}
                href={route.href}
                // Inline icon + label, not stacked: a two-line link would
                // dictate the row height, and this row is load-bearing.
                className={`flex shrink-0 items-center gap-1.5 border px-2 py-1 font-body text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  active
                    ? "border-edge-strong bg-signal/10 text-signal"
                    : "border-transparent text-readout-dim hover:border-edge hover:text-readout"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                <span className="hidden sm:inline">
                  {route.navLabel ?? route.label}
                </span>
              </Link>
            );
          })}
        </div>
        <span className="flex-1" />
        <DuelToggle />
        <AudioControl />
      </div>

      {/* Row 2 — what you have. Lived only on the home screen before, which
          meant no gem count on the gacha page and no stamina on the boss page. */}
      {rows === 2 ? (
        <div className="mx-auto flex h-8 w-full max-w-6xl items-center gap-1.5 border-t border-hairline px-4 md:px-8">
          <Resource
            icon={Zap}
            title="Stamina — spent entering World Boss runs"
            value={ready ? `${currentStamina}` : dash}
            suffix={`/${STAMINA_CAP}`}
          />
          <Resource
            icon={Gem}
            title="Gems — premium summon currency"
            value={ready ? currencies.gems.toLocaleString() : dash}
          />
          <Resource
            icon={Coins}
            title="Coin — spent on levelling and ascension"
            value={ready ? currencies.coin.toLocaleString() : dash}
          />
          {/* Orders sits with the counters, not with the account chrome — it
              is something you have progress on, not a setting. */}
          <OrdersButton />
          <span className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/profile"
                aria-label="Account rank"
                className="flex shrink-0 items-center gap-2 border border-hairline bg-void px-2 py-0.5 transition-colors hover:border-edge-strong"
              >
                <span
                  className={`font-body text-[11px] font-bold tracking-[0.06em] ${ready && !progress ? "text-el-light" : "text-signal"}`}
                >
                  {ready ? `R${account.rank}` : "R—"}
                </span>
                <span className="hidden h-1 w-14 overflow-hidden border border-hairline bg-void sm:block">
                  <span
                    className={`block h-full transition-[width] duration-500 ${ready && !progress ? "bg-el-light" : "bg-signal"}`}
                    style={{ width: ready ? `${rankPercent}%` : "0%" }}
                  />
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              {!ready
                ? "Account rank"
                : progress
                  ? `Account rank ${account.rank} — ${progress.current} / ${progress.required} xp`
                  : `Account rank ${account.rank} — clear the ascension trial to rank up`}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="World level"
                className="hidden shrink-0 cursor-help border border-hairline bg-void px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-[0.12em] text-readout-dim transition-colors hover:border-edge-strong sm:block"
              >
                World {ready ? worldLevel : dash}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              World level — the difficulty everything scales to
            </TooltipContent>
          </Tooltip>
          <Link
            href={user ? "/profile" : "/login"}
            title={user ? "Profile" : "Sign in"}
            className="flex h-6 w-6 shrink-0 items-center justify-center border border-edge-strong bg-panel font-heading text-sm text-readout-strong transition-colors hover:border-signal hover:text-signal"
          >
            {(user?.displayName || user?.email || "G").charAt(0).toUpperCase()}
          </Link>
        </div>
      ) : null}
    </nav>
  );
}

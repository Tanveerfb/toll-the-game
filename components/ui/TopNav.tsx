"use client";

import React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Home,
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
import ItemIcon from "@/components/game/ItemIcon";
import OrdersButton from "@/components/game/OrdersButton";
import Hint from "@/components/ui/Hint";
import { GAME_ROUTES, isRouteActive } from "@/lib/nav/routes";
import { useAuth } from "@/hooks/AuthProvider";
import { useGameStore } from "@/store/gameStore";
import { usePlayerStore } from "@/store/playerStore";
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
  "/events": Skull,
  "/gacha": Sparkles,
  "/archive": BookOpen,
  "/practice": Swords,
  "/news": Newspaper,
  "/profile": UserIcon,
};

/** Chosen when Archive and Story would otherwise both have been `BookOpen`.
 *  Story was removed on 2026-09-26; whether Archive takes `BookOpen` back is
 *  a visual call, so it is left as it was. */
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
  iconId,
  value,
  suffix,
  title,
}: {
  icon: React.ElementType;
  /** Material/currency id whose icon replaces the lucide glyph once its art
   *  exists. Falls back to `icon` on its own, so a counter with no art yet
   *  looks exactly as it did before. */
  iconId?: string;
  value: string;
  suffix?: string;
  title: string;
}): React.JSX.Element {
  const glyph = (
    <Icon className="h-3 w-3 shrink-0 text-readout-muted" strokeWidth={2.4} />
  );
  return (
    <Hint
      ariaLabel={title}
      content={title}
      // A counter shows a number and hides its meaning behind the hint, so the
      // hint is the only thing that says what the number *is* — which made a
      // hover-only tooltip the wrong container for it on a phone. `min-h-11`
      // because this row is a row of controls, not a readout.
      className="flex min-h-11 shrink-0 cursor-help items-center gap-1.5 border border-hairline bg-void px-2 transition-colors hover:border-edge-strong"
    >
      {iconId ? (
        <ItemIcon id={iconId} size={16} alt="" fallback={glyph} />
      ) : (
        glyph
      )}
      <span className="font-body text-[11px] font-bold tabular-nums text-readout-strong">
        {value}
        {suffix ? (
          <span className="font-semibold text-readout-muted">{suffix}</span>
        ) : null}
      </span>
    </Hint>
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

  const orderBoard = React.useMemo(
    () =>
      evaluateOrders({
        pulls: stats.pulls,
        bossClears: stats.bossClears,
        presetsSaved: presets.length,
        rosterSize: roster.length,
        accountRank: account.rank,
        characters,
        claimed: claimedOrders,
      }),
    [stats, presets.length, roster.length, account.rank, characters, claimedOrders],
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

  // Gated on `ready` for the same reason as the resource strip: the store
  // rehydrates from localStorage, and a badge that appears and then vanishes
  // reads as a bug.
  //
  // Also gated on being signed in: claiming needs an account, and a count on
  // every screen that leads to a locked panel is nagging, not enticing. The
  // pitch belongs on the home panel, once.
  const canClaimOrders = !firebaseEnabled || !!user;
  const readyOrders =
    ready && canClaimOrders ? claimableCount(orderBoard) : 0;
  const rankPercent = progress
    ? Math.min(100, (progress.current / progress.required) * 100)
    : 100;

  const nav = (
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
            link beside it doing exactly the same thing.

            The reading below is an `aria-label`, not a `title` (ruling #125).
            `Link` forwards `title` straight to its `<a>`, so an uppercase tag
            name hid a real browser tooltip from the 2026-09-01 sweep — and the
            string it carried was the only place the badge's count was ever
            spelled out. A phone gets no hover, so that reading lived nowhere.
            Found by reading the rendered DOM, 2026-09-01. */}
        {/* In a battle the wordmark is not a link. Leaving is not allowed
            until the battle is finished or forfeited (Tanveer, 2026-09-26),
            and `BattleLock` would bounce the click straight back — a link
            that goes nowhere is worse than none. */}
        {inBattle ? (
          <span className="inline-flex min-h-11 shrink-0 items-center font-heading text-xl tracking-eyebrow text-signal">
            TOLL
          </span>
        ) : (
        <Link
          href="/"
          aria-label={
            readyOrders > 0
              ? `Home — ${readyOrders} Bureau order${readyOrders > 1 ? "s" : ""} ready to claim`
              : "Home"
          }
          className="relative inline-flex min-h-11 shrink-0 items-center font-heading text-xl tracking-eyebrow text-signal"
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
        )}
        {/* Desktop only. Below `sm` these five live in the bottom tab bar —
            the strip was 234px holding 332px, so two of the seven routes never
            rendered at rest and nothing said the row scrolled. Gone during a
            battle, for the same reason as the wordmark above: the bottom tab
            bar already stood down for fights, and this row did not, so on a
            desktop every other screen stayed one click away mid-fight. */}
        <div
          className={`hud-scroll hidden min-w-0 items-center gap-1 overflow-x-auto ${inBattle ? "" : "sm:flex"}`}
        >
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
                // Below `sm` this is an icon and nothing else, so it needs a
                // name of its own — and a box a thumb can land on. It used to
                // be a 14px icon in `py-1`: a ~22px target, the smallest in
                // the app, on the app's primary navigation.
                aria-label={route.label}
                className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 border px-2 font-body text-[11px] font-bold uppercase tracking-label transition-colors ${
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
        {/* The two numbers that move while you play. Coin does not — it is a
            spend-screen figure — and Orders keeps the badge on the wordmark
            above, which is the link that goes to the screen holding them. */}
        <div className="flex items-center gap-1.5 sm:hidden">
          <Resource
            icon={Zap}
            iconId="stamina"
            title="Stamina — spent entering World Boss runs"
            value={ready ? `${currentStamina}` : dash}
            suffix={`/${STAMINA_CAP}`}
          />
          <Resource
            icon={Gem}
            iconId="gems"
            title="Gems — premium summon currency"
            value={ready ? currencies.gems.toLocaleString() : dash}
          />
        </div>
        <AudioControl />
      </div>

      {/* Row 2 — what you have. Lived only on the home screen before, which
          meant no gem count on the gacha page and no stamina on the boss page. */}
      {rows === 2 ? (
        <div className="mx-auto hidden h-12 w-full max-w-6xl items-center gap-1.5 border-t border-hairline px-4 sm:flex md:px-8">
          {/* The counters scroll and the account chrome does not — the same
              split `Deck.tsx` makes with End Turn. Four 44px counters plus a
              rank chip and an avatar do not fit in 390px, and the half you
              must be able to reach is the account half: letting the whole row
              scroll would push the profile link off the edge. */}
          <div className="hud-scroll flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            <Resource
              icon={Zap}
              iconId="stamina"
              title="Stamina — spent entering World Boss runs"
              value={ready ? `${currentStamina}` : dash}
              suffix={`/${STAMINA_CAP}`}
            />
            <Resource
              icon={Gem}
              iconId="gems"
              title="Gems — premium summon currency"
              value={ready ? currencies.gems.toLocaleString() : dash}
            />
            <Resource
              icon={Coins}
              iconId="coin"
              title="Coin — spent on levelling and ascension"
              value={ready ? currencies.coin.toLocaleString() : dash}
            />
            {/* Orders sits with the counters, not with the account chrome — it
                is something you have progress on, not a setting. */}
            <OrdersButton />
          </div>

          {/* Rank lost its tooltip rather than gaining a hint: it is a link,
              and a link cannot live inside a hint's button. The tooltip only
              ever restated the bar — so the bar shows at every width now
              instead of hiding below `sm`, and the exact xp lives one tap away
              on the page this already goes to. */}
          <Link
            href="/profile"
            aria-label="Account rank"
            className="flex min-h-11 shrink-0 items-center gap-2 border border-hairline bg-void px-2 transition-colors hover:border-edge-strong"
          >
            <span
              className={`font-body text-[11px] font-bold tracking-title ${ready && !progress ? "text-el-light" : "text-signal"}`}
            >
              {ready ? `R${account.rank}` : "R—"}
            </span>
            <span className="block h-1 w-10 overflow-hidden border border-hairline bg-void sm:w-14">
              <span
                className={`block h-full transition-[width] duration-500 ${ready && !progress ? "bg-el-light" : "bg-signal"}`}
                style={{ width: ready ? `${rankPercent}%` : "0%" }}
              />
            </span>
          </Link>
          <Hint
            ariaLabel="World level"
            content="World level — the difficulty everything scales to"
            className="hidden min-h-11 shrink-0 cursor-help items-center border border-hairline bg-void px-2 font-body text-[10px] font-bold uppercase tracking-label text-readout-dim transition-colors hover:border-edge-strong sm:flex"
          >
            World {ready ? worldLevel : dash}
          </Hint>
          <Link
            href={user ? "/profile" : "/login"}
            aria-label={user ? "Profile" : "Sign in"}
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-edge-strong bg-panel font-heading text-sm text-readout-strong transition-colors hover:border-signal hover:text-signal"
          >
            {(user?.displayName || user?.email || "G").charAt(0).toUpperCase()}
          </Link>
        </div>
      ) : null}

    </nav>
  );

  return (
    <>
      {nav}
      {/* Portalled to <body>, and that is load-bearing rather than tidiness.
          Rendered inside the nav it lands at the *top* of the screen: the nav
          carries `backdrop-blur-sm`, a `backdrop-filter` establishes a
          containing block, and `position: fixed` then resolves against the
          44px nav instead of the viewport. `bottom-0` put the tab bar over the
          nav it was supposed to replace. (Sticky alone would not have done
          this — it creates a stacking context, not a containing block. The
          blur is the culprit, which is the same family of bug
          `tests/overlayStacking.test.ts` was written for.) */}
      {mounted
        ? createPortal(
            <BottomTabs pathname={pathname} signedIn={!!user} />,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Primary navigation on a phone.
 *
 * Five destinations, every one visible, every one in the thumb third — which
 * is the half of ruling #107 a horizontal scroller can never satisfy however
 * big its targets are. Measured on the live build 2026-09-01: the strip this
 * replaces was 234px wide holding 332px of routes, so News and Profile were
 * off-screen at rest behind a swipe with no affordance, and the short labels
 * written in `routes.ts` for exactly this width were `hidden sm:inline` and
 * had never rendered on a phone at all.
 *
 * **Archive, Practice and News do not get a slot.** Five is the number that
 * fits at 390 without the labels shrinking below legibility, and those three
 * are already tiles on the hub — which is what `Menu` opens.
 *
 * **Four since 2026-09-26**, when story mode was removed and took its tab
 * with it. What, if anything, fills the fifth slot is his call.
 */
function BottomTabs({
  pathname,
  signedIn,
}: {
  pathname: string;
  signedIn: boolean;
}): React.JSX.Element {
  const tabs = [
    { href: "/", label: "Menu", icon: Home },
    { href: "/events", label: "Events", icon: Skull },
    { href: "/gacha", label: "Gacha", icon: Sparkles },
    {
      href: signedIn ? "/profile" : "/login",
      label: "You",
      icon: UserIcon,
    },
  ];

  return (
    <div
      // `fixed`, not `sticky`: the nav it lives in is itself sticky at the top,
      // and a sticky child cannot escape to the other edge of the viewport.
      // `body` reserves the space through `--tabbar-h` (styles/globals.css).
      className="app-tabbar pb-safe fixed inset-x-0 bottom-0 z-50 flex border-t border-edge bg-void/95 backdrop-blur-sm sm:hidden"
    >
      {tabs.map((tab) => {
        const active = isRouteActive(tab.href, pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-13 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 transition-colors ${
              active ? "text-signal" : "text-readout-muted"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2.2} />
            <span className="font-body text-[9px] font-bold uppercase tracking-label">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

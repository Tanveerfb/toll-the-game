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
import { Badge } from "@/components/ui/badge";
import ItemIcon from "@/components/game/ItemIcon";
import OrdersButton from "@/components/game/OrdersButton";
import Hint from "@/components/ui/Hint";
import { NAV_CHIP } from "@/components/ui/navChip";
import { Skeleton } from "@/components/ui/skeleton";
import { GAME_ROUTES, isRouteActive } from "@/lib/nav/routes";
import { useAuth } from "@/hooks/AuthProvider";
import { useGameStore } from "@/store/gameStore";
import { usePlayerStore } from "@/store/playerStore";
import { getCurrentStamina, STAMINA_CAP } from "@/lib/game/stamina";
import { summariseRank } from "@/lib/game/accountSummary";
import RankBar from "@/components/game/RankBar";
import { useNow } from "@/hooks/useNow";
import { claimableCount, evaluateOrders, ORDERS_OPEN } from "@/lib/game/orders";
import { firebaseEnabled } from "@/lib/firebase";
import { cn } from "@/lib/utils";


/** Never resubscribes — it exists only so the server snapshot and the client
 *  snapshot differ, which is how a client-only branch stays hydration-safe. */
const NO_SUBSCRIBE = () => () => {};

const ROUTE_ICON: Record<string, React.ElementType> = {
  "/": Home,
  "/events": Skull,
  "/gacha": Sparkles,
  "/archive": BookOpen,
  "/practice": Swords,
  "/news": Newspaper,
  "/profile": UserIcon,
};

/** The wordmark: a skewed paper label with a yellow slab, the mockup's
 *  (`docs/design/mockups/motif-options.html`). */
const WORDMARK =
  "ink-skew inline-flex min-h-11 shrink-0 items-center bg-card px-2 font-heading text-xl tracking-title text-card-foreground ink-slab-primary";

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
  value: React.ReactNode;
  suffix?: string;
  title: string;
}): React.JSX.Element {
  const glyph = (
    <Icon className="h-3 w-3 shrink-0 text-muted-foreground" strokeWidth={2.4} />
  );
  return (
    <Hint
      ariaLabel={title}
      content={title}
      // A counter shows a number and hides its meaning behind the hint, so the
      // hint is the only thing that says what the number *is* — which made a
      // hover-only tooltip the wrong container for it on a phone. `min-h-11`
      // because this row is a row of controls, not a readout.
      className={cn(NAV_CHIP, "cursor-help")}
    >
      {iconId ? (
        <ItemIcon id={iconId} size={16} alt="" fallback={glyph} />
      ) : (
        glyph
      )}
      <span className="tabular-nums">
        {value}
        {suffix ? (
          <span className="font-medium text-muted-foreground">{suffix}</span>
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

  // Stamina regenerates 1 per 5 minutes; the shared 30s clock keeps the bar
  // honest without a per-second timer nobody is watching.
  const now = useNow();
  const ready = mounted && hasHydrated && now !== 0;
  // A block the size of the number, not a dash: "—" means no value (conventions.md).
  const pending = <Skeleton className="h-3.5 w-6" />;

  // The resource strip stands down during a fight: the battle screen is the
  // one place that needs every pixel, and none of these numbers change mid-
  // battle anyway. Gated on `mounted` because `battlePhase` comes back from
  // sessionStorage — branching on it during the first render would mismatch.
  const inBattle = mounted && battlePhase !== "initializing";
  const rows = inBattle ? 1 : 2;

  const currentStamina = ready ? getCurrentStamina(stamina, now) : 0;
  // A walled rank (XP banking until the band's trial is cleared) gets its own
  // marker on the bar; see `summariseRank`.
  const rank = summariseRank(account);

  // Gated on `ready` for the same reason as the resource strip: the store
  // rehydrates from localStorage, and a badge that appears and then vanishes
  // reads as a bug.
  //
  // Also gated on being signed in: claiming needs an account, and a count on
  // every screen that leads to a locked panel is nagging, not enticing. The
  // pitch belongs on the home panel, once.
  const canClaimOrders = !firebaseEnabled || !!user;
  // And on the board being open at all: closed for the overhaul (#159).
  const readyOrders =
    ORDERS_OPEN && ready && canClaimOrders ? claimableCount(orderBoard) : 0;

  const nav = (
    <nav
      // `--nav-h` is derived from this attribute (styles/globals.css), and
      // `.screen-below-nav` is what every full-height screen measures against.
      data-nav-rows={rows}
      className="sticky top-0 z-50 border-b-2 border-ground-line bg-background"
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
          <span className={WORDMARK}>TOLL</span>
        ) : (
        <Link
          href="/"
          aria-label={
            readyOrders > 0
              ? `Home — ${readyOrders} Bureau order${readyOrders > 1 ? "s" : ""} ready to claim`
              : "Home"
          }
          className={cn(WORDMARK, "relative")}
        >
          TOLL
          {/* Orders live on the home screen, so the count rides the one link
              that goes there. Without it a claimable reward is invisible from
              every other screen. */}
          {readyOrders > 0 ? (
            <Badge
              variant="reward"
              size="tight"
              className="absolute -right-2 -top-1 h-4 min-w-4 justify-center leading-none tabular-nums"
            >
              {readyOrders}
            </Badge>
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
            const Icon = ROUTE_ICON[route.href] ?? Swords;
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
                className={cn(
                  "flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 border-2 px-2 font-body text-caption font-bold uppercase tracking-label transition-colors",
                  active
                    ? "ink-skew border-border bg-card text-card-foreground ink-slab-primary"
                    : "border-transparent text-ground-dim hover:text-foreground",
                )}
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
        {inBattle ? null : (
          <div className="flex items-center gap-1.5 sm:hidden">
            <Resource
              icon={Zap}
              iconId="stamina"
              title="Stamina — spent entering World Boss runs"
              value={ready ? `${currentStamina}` : pending}
              suffix={`/${STAMINA_CAP}`}
            />
            <Resource
              icon={Gem}
              iconId="gems"
              title="Gems — premium summon currency"
              value={ready ? currencies.gems.toLocaleString() : pending}
            />
          </div>
        )}
        <AudioControl />
      </div>

      {/* Row 2 — what you have. Lived only on the home screen before, which
          meant no gem count on the gacha page and no stamina on the boss page. */}
      {rows === 2 ? (
        <div className="mx-auto hidden h-12 w-full max-w-6xl items-center gap-1.5 border-t-2 border-ground-line px-4 sm:flex md:px-8">
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
              value={ready ? `${currentStamina}` : pending}
              suffix={`/${STAMINA_CAP}`}
            />
            <Resource
              icon={Gem}
              iconId="gems"
              title="Gems — premium summon currency"
              value={ready ? currencies.gems.toLocaleString() : pending}
            />
            <Resource
              icon={Coins}
              iconId="coin"
              title="Coin — spent on levelling and ascension"
              value={ready ? currencies.coin.toLocaleString() : pending}
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
            className={cn(NAV_CHIP, "gap-2")}
          >
            <span className="tracking-title">
              {ready ? `R${account.rank}` : <Skeleton className="h-3.5 w-5" />}
            </span>
            <RankBar
              percent={rank.percent}
              walled={rank.walled}
              ready={ready}
              className="w-10 sm:w-14"
            />
          </Link>
          <Hint
            ariaLabel="World level"
            content="World level — the difficulty everything scales to"
            className={cn(NAV_CHIP, "hidden cursor-help sm:flex")}
          >
            World {ready ? worldLevel : pending}
          </Hint>
          <Link
            href={user ? "/profile" : "/login"}
            aria-label={user ? "Profile" : "Sign in"}
            className={cn(NAV_CHIP, "w-11 px-0 font-heading text-sm")}
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
          `tests/overlayStacking.test.ts` was written for.)

          Shonen Ink dropped the blur (2026-09-26: glass is excluded from the
          motif). The portal stays anyway: the next filter or transform
          added to the nav would bring the bug straight back. */}
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
 * Every destination visible, every one in the thumb third — which is the half
 * of ruling #107 a horizontal scroller can never satisfy however big its
 * targets are. Measured on the live build 2026-09-01: the strip this
 * replaces was 234px wide holding 332px of routes, so News and Profile were
 * off-screen at rest behind a swipe with no affordance, and the short labels
 * written in `routes.ts` for exactly this width were `hidden sm:inline` and
 * had never rendered on a phone at all.
 *
 * **The tabs are the `GAME_ROUTES` entries flagged `tab`**, not a list of
 * their own. Five is the most that fits at 390 without the labels shrinking
 * below legibility; there are four since 2026-09-26, when story mode was
 * removed and took its tab with it. Characters, Practice and News have no
 * slot: they are tiles on the hub, which is what `Menu` opens. What, if
 * anything, fills the fifth slot is his call.
 */
function BottomTabs({
  pathname,
  signedIn,
}: {
  pathname: string;
  signedIn: boolean;
}): React.JSX.Element {
  const tabs = GAME_ROUTES.filter((route) => route.tab).map((route) => ({
    // A guest's "You" tab leads to the sign-in screen, not a profile.
    href: route.href === "/profile" && !signedIn ? "/login" : route.href,
    label: route.tabLabel ?? route.navLabel ?? route.label,
    icon: ROUTE_ICON[route.href] ?? Swords,
  }));

  return (
    <div
      // `fixed`, not `sticky`: the nav it lives in is itself sticky at the top,
      // and a sticky child cannot escape to the other edge of the viewport.
      // `body` reserves the space through `--tabbar-h` (styles/globals.css).
      className="app-tabbar pb-safe fixed inset-x-0 bottom-0 z-50 flex border-t-2 border-border bg-card text-card-foreground sm:hidden"
    >
      {tabs.map((tab) => {
        const active = isRouteActive(tab.href, pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-13 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-card-foreground",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.2} />
            <span className="font-body text-label font-bold uppercase tracking-label">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

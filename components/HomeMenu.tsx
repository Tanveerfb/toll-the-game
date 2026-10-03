"use client";

import React from "react";
import OrdersButton from "@/components/game/OrdersButton";
import { useAuth } from "@/hooks/AuthProvider";
import { useScreenMusic } from "@/hooks/useScreenMusic";
import { usePlayerStore } from "@/store/playerStore";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";
import { getGemBanner } from "@/lib/gacha/banners";
import { NEWS_OPEN } from "@/lib/news/open";
import NavTile from "@/components/ui/NavTile";
import { Screen } from "@/components/ui/Screen";

// Static catalog reads — these resolve at module load from the same JSON the
// engine uses, so the hub can't advertise a roster or banner that doesn't exist.
const PLAYABLE_COUNT = getPlayableCharacters().length;
const GEM_BANNER = getGemBanner();

export default function HomeMenu() {
  const { user } = useAuth();

  // The hub no longer hosts a battle (see the note where it used to, below),
  // so it only ever plays its own theme.
  useScreenMusic("menu");

  const playerHydrated = usePlayerStore((s) => s.hasHydrated);
  const roster = usePlayerStore((s) => s.roster);

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

        {/* The rest. Quiet on purpose — the nav already routes to all of them;
            these exist so the hub isn't a dead end, not to compete with the
            hero for attention. */}
        <div className="mt-2.5 grid grid-cols-2 gap-2 md:grid-cols-3">
          <NavTile title="World Boss" subtitle="Molvarr" href="/events" />
          <NavTile title="Gacha" subtitle={GEM_BANNER.name} href="/gacha" />
          <NavTile
            title="Characters"
            subtitle={
              playerHydrated
                ? `${roster.length} of ${PLAYABLE_COUNT} owned`
                : `${PLAYABLE_COUNT} characters`
            }
            href="/archive"
          />
          <NavTile
            title="Practice"
            subtitle="Sandbox — pick both teams"
            href="/practice"
          />
          <NavTile
            title="News"
            subtitle={NEWS_OPEN ? "Updates & notices" : "Coming soon"}
            href="/news"
          />
          <NavTile
            title={user ? "Profile" : "Sign in"}
            subtitle={user ? "Account & cloud save" : "Sync progress"}
            href={user ? "/profile" : "/login"}
          />
        </div>
    </Screen>
  );
}

"use client";

import React from "react";
import { Boxes, UserCog } from "lucide-react";
import ItemIcon from "@/components/game/ItemIcon";
import { useAuth } from "@/hooks/AuthProvider";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { summariseRank, summariseWorldLevel } from "@/lib/game/accountSummary";
import RankBar from "@/components/game/RankBar";
import PlayerAvatar from "@/components/game/PlayerAvatar";
import InventoryModal from "@/components/game/InventoryModal";
import AccountModal from "@/components/game/AccountModal";
import DevGrantPanel from "@/components/game/DevGrantPanel";
import SoundSettings from "@/components/game/SoundSettings";
import NavTile from "@/components/ui/NavTile";
import { Screen } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/skeleton";
import { panelVariants } from "@/components/ui/Panel";
import { cn } from "@/lib/utils";

function Resource({
  label,
  iconId,
  value,
}: {
  label: string;
  /** Currency/material id whose icon sits beside the name. */
  iconId?: string;
  value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        panelVariants({ surface: "paper", density: "tight" }),
        // 8rem: local floor, so two readouts share a row at 390px.
        "flex min-w-[8rem] flex-1 flex-col gap-1",
      )}
    >
      <span className="flex items-center gap-1.5 font-body text-label font-bold uppercase tracking-label text-muted-foreground">
        {iconId ? <ItemIcon id={iconId} size={18} alt="" /> : null}
        {label}
      </span>
      <span className="font-heading text-xl leading-none tracking-title tabular-nums">
        {value}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  // A guest is a player too: this page renders for them, and the Account
  // dialog carries the sign-in button (a guest was redirected away before).
  const { user } = useAuth();
  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const currencies = usePlayerStore((s) => s.currencies);
  const account = usePlayerStore((s) => s.account);
  const worldLevel = usePlayerStore((s) => s.worldLevel);
  const avatarId = useSettingsStore((s) => s.avatarCharacterId);

  const [showInventory, setShowInventory] = React.useState(false);
  const [showAccount, setShowAccount] = React.useState(false);

  const ready = hasHydrated;
  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Guest";

  // Walled means XP banks but the rank can't rise until the band's ascension
  // trial is cleared. A bar pinned at 100% with no explanation is
  // indistinguishable from a bug, so the walled case says so.
  const rank = summariseRank(account);
  const worldCap = summariseWorldLevel(account.rank);

  return (
    <Screen width="app">
        {/* The page opens with what it's about. It used to open with a Stamina
            card, and the account itself was a line of email text near the
            bottom above the logout button. */}
        <header
          className={cn(
            panelVariants({ surface: "paper", density: "roomy", lift: "slab" }),
            "flex flex-wrap items-center gap-4",
          )}
        >
          <PlayerAvatar
            characterId={avatarId}
            fallback={displayName}
            size={52}
          />
          {/* `min-w-36` rather than `min-w-0`: the row wraps, but with a zero
              floor this column shrank instead of pushing the rank block onto
              the next line — at 393px the name got 72px for 138px of text, so
              "Tanveer Singh" rendered as "Tanv…" and the email beside it as
              nine characters. A floor wide enough to be worth reading is what
              makes `flex-wrap` actually wrap. Measured in a browser
              2026-09-01. */}
          <div className="min-w-36 flex-1">
            <h1 className="truncate font-heading text-2xl leading-none tracking-title md:text-3xl">
              {displayName}
            </h1>
            <p className="mt-1 truncate font-body text-caption text-muted-foreground">
              {user?.email ?? user?.uid ?? "Guest"}
            </p>
          </div>

          <div className="flex flex-col gap-1 border-l-2 border-rule pl-4">
            <span className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
              Account rank
            </span>
            <span className="font-heading text-3xl leading-none">
              {ready ? account.rank : <Skeleton className="h-[1em] w-8" />}
            </span>
            <RankBar
              percent={rank.percent}
              walled={rank.walled}
              ready={ready}
              className="w-36"
            />
            <span className="font-body text-label font-bold text-muted-foreground">
              {!ready
                ? " "
                : rank.progress
                  ? `${rank.progress.current} / ${rank.progress.required} xp to rank ${rank.nextRank}`
                  : "Clear the ascension trial to rank up"}
            </span>
          </div>

          <div className="flex flex-col gap-1 border-l-2 border-rule pl-4">
            <span className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
              World level
            </span>
            <span className="font-heading text-3xl leading-none">
              {ready ? worldLevel : <Skeleton className="h-[1em] w-8" />}
            </span>
            <span className="max-w-[16ch] font-body text-label font-bold leading-snug text-muted-foreground">
              {!ready
                ? " "
                : worldCap.atMaximum
                  ? "At the current maximum"
                  : worldCap.nextWall
                    ? `Capped at ${worldCap.cap} until rank ${worldCap.nextWall}`
                    : `Capped at ${worldCap.cap}`}
            </span>
          </div>
        </header>

        <div className="mt-3 flex flex-wrap gap-2">
          <Resource
            label="Coin"
            iconId="coin"
            value={
              ready ? (
                currencies.coin.toLocaleString()
              ) : (
                <Skeleton className="h-[1em] w-16" />
              )
            }
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <NavTile
            icon={Boxes}
            title="Inventory"
            chevron
            onClick={() => setShowInventory(true)}
          />
          <NavTile
            icon={UserCog}
            title="Account"
            chevron
            onClick={() => setShowAccount(true)}
          />
        </div>

        {/* The character listing lives under Characters — it has the
            portraits, the filters and the element data this page never had
            (Tanveer, 2026-08-11). This is the pointer, not a second copy. */}
        <NavTile
          href="/archive"
          title="Characters"
          chevron
          className="mt-2"
        />

        <div className="mt-4">
          <SoundSettings />
        </div>

        <div className="mt-4">
          <DevGrantPanel />
        </div>
      {/* Both overlays are the shadcn `Dialog`, which portals to <body>, so
          sitting inside the column rather than beside it does not change
          where they render. */}
      {showInventory ? (
        <InventoryModal onClose={() => setShowInventory(false)} />
      ) : null}
      {showAccount ? (
        <AccountModal onClose={() => setShowAccount(false)} />
      ) : null}
    </Screen>
  );
}

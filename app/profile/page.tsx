"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes, ChevronRight, UserCog } from "lucide-react";
import ItemIcon from "@/components/game/ItemIcon";
import { useAuth } from "@/hooks/AuthProvider";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { getCurrentStamina, STAMINA_CAP } from "@/lib/game/stamina";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";
import { MAX_ACCOUNT_RANK, rankProgress } from "@/lib/game/accountRank";
import { MAX_WORLD_LEVEL, worldLevelCapForRank } from "@/lib/game/worldLevel";
import { RANK_WALLS } from "@/lib/game/accountRank";
import PlayerAvatar from "@/components/game/PlayerAvatar";
import InventoryModal from "@/components/game/InventoryModal";
import AccountModal from "@/components/game/AccountModal";
import DevGrantPanel from "@/components/game/DevGrantPanel";
import SoundSettings from "@/components/game/SoundSettings";
import { Screen } from "@/components/ui/Screen";
import { panelVariants } from "@/components/ui/Panel";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** A tile on this page that goes somewhere (ruling #154). */
const PROFILE_TILE = panelVariants({ surface: "paper", density: "none", press: true });

const PLAYABLE_COUNT = getPlayableCharacters().length;

/** Stamina regenerates on a clock; floored to the tick window so repeated
 *  snapshot reads return an identical value. */
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

function Resource({
  label,
  iconId,
  value,
  suffix,
  percent,
}: {
  label: string;
  /** Currency/material id whose icon sits beside the name. Omitted for the
   *  figures that aren't things you hold (roster count). */
  iconId?: string;
  value: string;
  suffix?: string;
  /** Adds a fill bar — only worth it for a value that refills on its own. */
  percent?: number;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        panelVariants({ surface: "paper", density: "tight" }),
        "flex min-w-[8rem] flex-1 flex-col gap-1",
      )}
    >
      <span className="flex items-center gap-1.5 font-body text-label font-bold uppercase tracking-label text-muted-foreground">
        {iconId ? <ItemIcon id={iconId} size={18} alt="" /> : null}
        {label}
      </span>
      <span className="font-heading text-xl leading-none tracking-title tabular-nums">
        {value}
        {suffix ? (
          <span className="font-body text-xs font-bold text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </span>
      {percent !== undefined ? <Progress value={percent} /> : null}
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const roster = usePlayerStore((s) => s.roster);
  const currencies = usePlayerStore((s) => s.currencies);
  const stamina = usePlayerStore((s) => s.stamina);
  const account = usePlayerStore((s) => s.account);
  const worldLevel = usePlayerStore((s) => s.worldLevel);
  const avatarId = useSettingsStore((s) => s.avatarCharacterId);

  const [showInventory, setShowInventory] = React.useState(false);
  const [showAccount, setShowAccount] = React.useState(false);

  const now = React.useSyncExternalStore(
    subscribeClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (!loading && !user) {
    return null;
  }

  const ready = hasHydrated && now !== 0;
  const dash = "—";
  const currentStamina = ready ? getCurrentStamina(stamina, now) : 0;
  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Guest";

  // `null` means walled: XP banks but the rank can't rise until the band's
  // ascension trial is cleared. A bar pinned at 100% with no explanation is
  // indistinguishable from a bug, so the walled case says so.
  const progress = rankProgress(account, account.clearedWalls);
  const rankPercent = progress
    ? Math.min(100, (progress.current / progress.required) * 100)
    : 100;
  const cap = worldLevelCapForRank(account.rank);
  const nextWall = RANK_WALLS.find((wall) => wall > account.rank);

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
              {ready ? account.rank : dash}
            </span>
            {/* Walled (XP banking, rank capped until the trial) fills gold
                rather than yellow: a full bar that never moves reads as a
                state, not a bug. */}
            <span className="block h-2 w-36 overflow-hidden border border-border bg-muted">
              <span
                className={`block h-full transition-[width] duration-500 ${progress ? "bg-primary" : "bg-el-light"}`}
                style={{ width: ready ? `${rankPercent}%` : "0%" }}
              />
            </span>
            <span className="font-body text-label font-bold text-muted-foreground">
              {!ready
                ? " "
                : progress
                  ? `${progress.current} / ${progress.required} xp to rank ${Math.min(account.rank + 1, MAX_ACCOUNT_RANK)}`
                  : "Clear the ascension trial to rank up"}
            </span>
          </div>

          <div className="flex flex-col gap-1 border-l-2 border-rule pl-4">
            <span className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
              World level
            </span>
            <span className="font-heading text-3xl leading-none">
              {ready ? worldLevel : dash}
            </span>
            <span className="max-w-[16ch] font-body text-label font-bold leading-snug text-muted-foreground">
              {!ready
                ? " "
                : cap >= MAX_WORLD_LEVEL
                  ? "At the current maximum"
                  : nextWall
                    ? `Capped at ${cap} until rank ${nextWall}`
                    : `Capped at ${cap}`}
            </span>
          </div>
        </header>

        <div className="mt-3 flex flex-wrap gap-2">
          <Resource
            label="Stamina"
            iconId="stamina"
            value={ready ? `${currentStamina}` : dash}
            suffix={`/${STAMINA_CAP}`}
            percent={ready ? (currentStamina / STAMINA_CAP) * 100 : 0}
          />
          <Resource
            label="Gems"
            iconId="gems"
            value={ready ? currencies.gems.toLocaleString() : dash}
          />
          <Resource
            label="Coin"
            iconId="coin"
            value={ready ? currencies.coin.toLocaleString() : dash}
          />
          <Resource
            label="Roster"
            value={ready ? `${roster.length}` : dash}
            suffix={`/${PLAYABLE_COUNT}`}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setShowInventory(true)}
            className={cn(PROFILE_TILE, "flex items-center gap-3 px-4 py-3")}
          >
            <Boxes className="h-5 w-5 shrink-0" strokeWidth={2} />
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-lg tracking-title">
                Inventory
              </span>
              <span className="block font-body text-caption text-muted-foreground">
                Currencies, materials and what you&rsquo;ve invested
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => setShowAccount(true)}
            className={cn(PROFILE_TILE, "flex items-center gap-3 px-4 py-3")}
          >
            <UserCog className="h-5 w-5 shrink-0" strokeWidth={2} />
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-lg tracking-title">
                Account
              </span>
              <span className="block font-body text-caption text-muted-foreground">
                Sign-in, cloud save and display picture
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>

        {/* The roster listing lives in the archive now — it has the portraits,
            the filters and the element data this page never had (Tanveer,
            2026-08-11). This is the pointer, not a second copy of it. */}
        <Link
          href="/archive"
          className={cn(PROFILE_TILE, "mt-2 flex items-center gap-3 px-4 py-3")}
        >
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-lg tracking-title">
              Your characters
            </span>
            <span className="block font-body text-caption text-muted-foreground">
              {ready
                ? `${roster.length} recruited — levels, ascension and kits in the archive`
                : "Levels, ascension and kits in the archive"}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>

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

"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boxes, ChevronRight, UserCog } from "lucide-react";
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
  value,
  suffix,
  percent,
}: {
  label: string;
  value: string;
  suffix?: string;
  /** Adds a fill bar — only worth it for a value that refills on its own. */
  percent?: number;
}): React.JSX.Element {
  return (
    <div className="flex min-w-[8rem] flex-1 flex-col gap-1 border border-hairline bg-panel px-3 py-2">
      <span className="font-body text-[9px] font-bold uppercase tracking-[0.18em] text-readout-muted">
        {label}
      </span>
      <span className="font-heading text-xl leading-none tracking-[0.04em] text-readout-strong tabular-nums">
        {value}
        {suffix ? (
          <span className="font-body text-xs font-semibold text-readout-muted">
            {suffix}
          </span>
        ) : null}
      </span>
      {percent !== undefined ? (
        <span className="block h-1 overflow-hidden border border-hairline bg-void">
          <span
            className="block h-full bg-readout transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </span>
      ) : null}
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
    <main className="terminal-grid min-h-dvh bg-void">
      <section className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
        {/* The page opens with what it's about. It used to open with a Stamina
            card, and the account itself was a line of email text near the
            bottom above the logout button. */}
        <header className="flex flex-wrap items-center gap-4 border border-edge bg-inset px-4 py-4">
          <PlayerAvatar
            characterId={avatarId}
            fallback={displayName}
            size={52}
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-2xl leading-none tracking-[0.06em] text-readout-strong md:text-3xl">
              {displayName}
            </h1>
            <p className="mt-1 truncate font-body text-[11px] text-readout-muted">
              {user?.email ?? user?.uid ?? "Guest"}
            </p>
          </div>

          <div className="flex flex-col gap-1 border-l border-edge pl-4">
            <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-readout-muted">
              Account rank
            </span>
            <span
              className={`font-heading text-3xl leading-none ${progress ? "text-signal" : "text-el-light"}`}
            >
              {ready ? account.rank : dash}
            </span>
            <span className="block h-1 w-36 overflow-hidden border border-hairline bg-void">
              <span
                className={`block h-full transition-[width] duration-500 ${progress ? "bg-signal" : "bg-el-light"}`}
                style={{ width: ready ? `${rankPercent}%` : "0%" }}
              />
            </span>
            <span className="font-body text-[10px] font-semibold text-readout-muted">
              {!ready
                ? " "
                : progress
                  ? `${progress.current} / ${progress.required} xp to rank ${Math.min(account.rank + 1, MAX_ACCOUNT_RANK)}`
                  : "Clear the ascension trial to rank up"}
            </span>
          </div>

          <div className="flex flex-col gap-1 border-l border-edge pl-4">
            <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-readout-muted">
              World level
            </span>
            <span className="font-heading text-3xl leading-none text-readout-strong">
              {ready ? worldLevel : dash}
            </span>
            <span className="max-w-[16ch] font-body text-[10px] font-semibold leading-snug text-readout-muted">
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
            value={ready ? `${currentStamina}` : dash}
            suffix={`/${STAMINA_CAP}`}
            percent={ready ? (currentStamina / STAMINA_CAP) * 100 : 0}
          />
          <Resource
            label="Gems"
            value={ready ? currencies.gems.toLocaleString() : dash}
          />
          <Resource
            label="Coin"
            value={ready ? currencies.coin.toLocaleString() : dash}
          />
          <Resource
            label="Roster"
            value={ready ? `${roster.length}` : dash}
            suffix={`/${PLAYABLE_COUNT}`}
          />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setShowInventory(true)}
            className="flex items-center gap-3 border border-hairline bg-panel px-4 py-3 text-left transition-colors hover:border-edge-strong"
          >
            <Boxes className="h-5 w-5 shrink-0 text-readout-dim" strokeWidth={2} />
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-lg tracking-[0.05em] text-readout-strong">
                Inventory
              </span>
              <span className="block font-body text-[11px] text-readout-muted">
                Currencies, materials and what you&rsquo;ve invested
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-readout-muted" />
          </button>
          <button
            type="button"
            onClick={() => setShowAccount(true)}
            className="flex items-center gap-3 border border-hairline bg-panel px-4 py-3 text-left transition-colors hover:border-edge-strong"
          >
            <UserCog className="h-5 w-5 shrink-0 text-readout-dim" strokeWidth={2} />
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-lg tracking-[0.05em] text-readout-strong">
                Account
              </span>
              <span className="block font-body text-[11px] text-readout-muted">
                Sign-in, cloud save and display picture
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-readout-muted" />
          </button>
        </div>

        {/* The roster listing lives in the archive now — it has the portraits,
            the filters and the element data this page never had (Tanveer,
            2026-08-11). This is the pointer, not a second copy of it. */}
        <Link
          href="/archive"
          className="mt-2 flex items-center gap-3 border border-hairline bg-inset px-4 py-3 transition-colors hover:border-edge-strong"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-lg tracking-[0.05em] text-readout-strong">
              Your characters
            </span>
            <span className="block font-body text-[11px] text-readout-muted">
              {ready
                ? `${roster.length} recruited — levels, ascension and kits in the archive`
                : "Levels, ascension and kits in the archive"}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-readout-muted" />
        </Link>

        <div className="mt-4">
          <DevGrantPanel />
        </div>
      </section>

      {showInventory ? (
        <InventoryModal onClose={() => setShowInventory(false)} />
      ) : null}
      {showAccount ? (
        <AccountModal onClose={() => setShowAccount(false)} />
      ) : null}
    </main>
  );
}

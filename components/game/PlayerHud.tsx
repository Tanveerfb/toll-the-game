"use client";

import React from "react";
import { Coins, Gem, User as UserIcon, Zap } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { usePlayerStore } from "@/store/playerStore";
import { getCurrentStamina, STAMINA_CAP } from "@/lib/game/stamina";

/** Stamina regenerates 1 per 5 minutes; re-reading every 30s keeps the bar
 *  honest without a per-second timer nobody is watching. */
const CLOCK_TICK_MS = 30_000;

// The wall clock is an external store, same treatment as localStorage in
// HomeMenu. The snapshot is FLOORED to the tick window so repeated calls
// return an identical value — returning a raw Date.now() would make
// useSyncExternalStore re-render forever.
function subscribeClock(onStoreChange: () => void): () => void {
  const id = setInterval(onStoreChange, CLOCK_TICK_MS);
  return () => clearInterval(id);
}

function getClockSnapshot(): number {
  return Math.floor(Date.now() / CLOCK_TICK_MS) * CLOCK_TICK_MS;
}

/** The server has no clock worth trusting; 0 marks "not ready yet" so both
 *  sides render the same placeholder and hydration stays quiet. */
function getServerClockSnapshot(): number {
  return 0;
}

function Meter({
  icon: Icon,
  value,
  tone,
  title,
}: {
  icon: React.ElementType;
  value: string;
  tone: string;
  title: string;
}): React.JSX.Element {
  return (
    <div
      title={title}
      className="flex items-center gap-1.5 border border-zinc-700 bg-black/50 px-2 py-1"
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${tone}`} strokeWidth={2.4} />
      <span className="font-body text-xs font-semibold tracking-[0.08em] text-zinc-100 tabular-nums">
        {value}
      </span>
    </div>
  );
}

/**
 * Persistent player strip for the home hub: who you are, and the three
 * resources that gate what you can do next (stamina → world boss, gems →
 * gacha, coin → ascension).
 *
 * Both the player store and the stamina clock are client-only, so everything
 * renders as placeholders until `hasHydrated` flips AND the clock resolves —
 * the server and the first client render agree on the placeholder, so there's
 * no hydration mismatch and no value flash.
 */
export default function PlayerHud(): React.JSX.Element {
  const { user } = useAuth();
  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const currencies = usePlayerStore((s) => s.currencies);
  const stamina = usePlayerStore((s) => s.stamina);

  const now = React.useSyncExternalStore(
    subscribeClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );

  const ready = hasHydrated && now !== 0;
  const currentStamina = ready ? getCurrentStamina(stamina, now) : 0;
  const staminaPercent = (currentStamina / STAMINA_CAP) * 100;
  const dash = "—";

  const displayName =
    user?.displayName || user?.email?.split("@")[0] || "Guest";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-2 border-zinc-700 bg-black/55 px-3 py-2 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-zinc-600 bg-zinc-900">
          <UserIcon className="h-4 w-4 text-zinc-400" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm tracking-[0.1em] text-zinc-100">
            {displayName}
          </p>
          <p className="font-body text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            {user ? "Signed in" : "Guest — progress is local"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Stamina carries a fill bar as well as numerals — it's the one
            resource that refills on its own, so "how close to full" matters. */}
        <div
          title="Stamina — spent entering World Boss runs"
          className="flex items-center gap-1.5 border border-zinc-700 bg-black/50 px-2 py-1"
        >
          <Zap className="h-3.5 w-3.5 shrink-0 text-amber-300" strokeWidth={2.4} />
          <span className="font-body text-xs font-semibold tracking-[0.08em] text-zinc-100 tabular-nums">
            {ready ? `${currentStamina}/${STAMINA_CAP}` : `${dash}/${STAMINA_CAP}`}
          </span>
          <span className="hidden h-1.5 w-14 overflow-hidden border border-zinc-700 bg-zinc-900 sm:block">
            <span
              className="block h-full bg-amber-400 transition-[width] duration-500"
              style={{ width: ready ? `${staminaPercent}%` : "0%" }}
            />
          </span>
        </div>

        <Meter
          icon={Gem}
          tone="text-pink-300"
          title="Gems — premium summon currency"
          value={ready ? currencies.gems.toLocaleString() : dash}
        />
        <Meter
          icon={Coins}
          tone="text-yellow-300"
          title="Coin — spent on leveling and ascension"
          value={ready ? currencies.coin.toLocaleString() : dash}
        />
      </div>
    </div>
  );
}

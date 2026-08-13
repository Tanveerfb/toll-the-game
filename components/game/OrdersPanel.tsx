"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Lock } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { firebaseEnabled } from "@/lib/firebase";
import { usePlayerStore } from "@/store/playerStore";
import { useStoryStore } from "@/store/storyStore";
import {
  allOrdersClaimed,
  claimableCount,
  evaluateOrders,
  getStarterOrders,
  orderCompletion,
  summariseRewards,
  type OrderProgress,
  type OrderReward,
} from "@/lib/game/orders";
import { materialLabel } from "@/lib/game/materials";
import { getCharacterById } from "@/lib/game/characterCatalog";

/**
 * Bureau Orders on the home screen.
 *
 * The starter checklist that answers "what do I do next" — see
 * `lib/game/orders.ts` for why it exists and `docs/STATUS.md` for the FTUE
 * plan it belongs to.
 *
 * Presentational on purpose: every rule lives in the evaluator, and claiming
 * re-checks in the store. This decides only what a row looks like.
 */

/** One reward, written the way the rest of the game writes rewards. */
function rewardLine(reward: OrderReward): string {
  const parts: string[] = [];
  // A character leads: it's the only reward worth changing your plans for.
  if (reward.character) {
    parts.push(getCharacterById(reward.character)?.name ?? reward.character);
  }
  if (reward.gems) parts.push(`${reward.gems} gems`);
  if (reward.coin) parts.push(`${reward.coin.toLocaleString()} coin`);
  if (reward.permanentTicket) {
    parts.push(
      `${reward.permanentTicket} ticket${reward.permanentTicket > 1 ? "s" : ""}`,
    );
  }
  for (const [id, count] of Object.entries(reward.materials ?? {})) {
    parts.push(`${count}× ${materialLabel(id)}`);
  }
  return parts.join(" · ");
}

function OrderRow({
  entry,
  onClaim,
  onGo,
}: {
  entry: OrderProgress;
  onClaim: () => void;
  onGo: () => void;
}): React.JSX.Element {
  const { order, current, required, claimed, claimable, lockedBy } = entry;
  const percent = required > 0 ? Math.min(100, (current / required) * 100) : 0;
  // A one-step order ("save a preset") has no meaningful bar — 0% or 100% is
  // just a restatement of the tick.
  const showBar = required > 1 && !claimed;

  return (
    <div className="flex items-center gap-2.5 border-b border-hairline px-3 py-2 last:border-b-0">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
          claimed
            ? "border-el-green text-el-green"
            : lockedBy
              ? "border-hairline text-readout-muted"
              : "border-edge text-readout-muted"
        }`}
      >
        {claimed ? (
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        ) : lockedBy ? (
          <Lock className="h-2.5 w-2.5" strokeWidth={2.4} />
        ) : null}
      </span>

      {/* Content tier, not label tier: an order's title and hint are sentences
          you read. They were 12px and 10px — the uppercase-chip sizing of the
          surrounding UI applied to prose (Tanveer, 2026-08-13). */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={`font-body text-sm ${claimed ? "text-readout-muted line-through" : "text-readout"}`}
        >
          {order.title}
        </span>
        <span className="font-body text-xs leading-snug text-readout-muted">
          {claimed
            ? "Claimed"
            : lockedBy
              ? `Complete “${lockedBy.title}” first`
              : order.hint}
        </span>
        {showBar ? (
          <span className="mt-1 flex items-center gap-1.5">
            <span className="block h-[3px] w-full max-w-40 bg-inset">
              <span
                className="block h-full bg-signal transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="font-body text-[11px] tabular-nums text-readout-muted">
              {current}/{required}
            </span>
          </span>
        ) : null}
      </span>

      {!claimed ? (
        <span className="hidden shrink-0 font-body text-xs tabular-nums text-el-light sm:block">
          {rewardLine(order.reward)}
        </span>
      ) : null}

      {claimable ? (
        <button
          type="button"
          onClick={onClaim}
          className="shrink-0 border border-el-light bg-el-light/12 px-3 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] text-el-light transition-colors hover:bg-el-light/25"
        >
          Claim
        </button>
      ) : !claimed && !lockedBy ? (
        <button
          type="button"
          onClick={onGo}
          title={`Go to ${order.routeLabel}`}
          className="flex shrink-0 items-center gap-0.5 border border-hairline px-2.5 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] text-readout-dim transition-colors hover:border-edge-strong hover:text-signal"
        >
          {order.routeLabel}
          <ChevronRight className="h-3 w-3" strokeWidth={2.6} />
        </button>
      ) : null}
    </div>
  );
}

/**
 * What a signed-out player sees instead of the checklist.
 *
 * Orders are claimable only with an account (Tanveer, 2026-08-13). Progress
 * still accrues while signed out — the evaluator reads game state, not auth —
 * so anything already earned is waiting the moment they sign in. That's the
 * point: the pitch is a stack of rewards you've already worked for, not
 * "sync your progress".
 */
function LockedOrders({ onSignIn }: { onSignIn: () => void }): React.JSX.Element {
  const total = summariseRewards(getStarterOrders());
  const prizes: string[] = [];
  for (const id of total.characters) {
    prizes.push(getCharacterById(id)?.name ?? id);
  }
  if (total.gems) prizes.push(`${total.gems.toLocaleString()} gems`);
  if (total.coin) prizes.push(`${total.coin.toLocaleString()} coin`);
  for (const [id, count] of Object.entries(total.materials)) {
    prizes.push(`${count}× ${materialLabel(id)}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
      <span className="flex min-w-[14rem] flex-1 flex-col gap-1">
        <span className="font-body text-sm text-readout">
          Create an account or log in to access Bureau Orders.
        </span>
        <span className="font-body text-xs leading-snug text-readout-muted">
          Waiting to be claimed:{" "}
          <span className="text-el-light">{prizes.join(" · ")}</span>
        </span>
        <span className="font-body text-xs leading-snug text-readout-muted">
          You keep making progress while signed out — it&apos;s all here when
          you come back.
        </span>
      </span>
      <button
        type="button"
        onClick={onSignIn}
        className="shrink-0 border border-signal bg-signal/12 px-4 py-2 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-signal transition-colors hover:bg-signal/25"
      >
        Sign in
      </button>
    </div>
  );
}

export default function OrdersPanel(): React.JSX.Element | null {
  const router = useRouter();
  const { user } = useAuth();

  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const stats = usePlayerStore((s) => s.stats);
  const presets = usePlayerStore((s) => s.presets);
  const roster = usePlayerStore((s) => s.roster);
  const account = usePlayerStore((s) => s.account);
  const characters = usePlayerStore((s) => s.characters);
  const claimedOrders = usePlayerStore((s) => s.claimedOrders);
  const claimOrder = usePlayerStore((s) => s.claimOrder);

  const completed = useStoryStore((s) => s.completed);
  const storyHydrated = useStoryStore((s) => s.hasHydrated);

  const board = React.useMemo(
    () =>
      evaluateOrders({
        completedChapters: completed,
        pulls: stats.pulls,
        bossClears: stats.bossClears,
        presetsSaved: presets.length,
        rosterSize: roster.length,
        accountRank: account.rank,
        characters,
        claimed: claimedOrders,
      }),
    [
      completed,
      stats,
      presets.length,
      roster.length,
      account.rank,
      characters,
      claimedOrders,
    ],
  );

  // Both stores are localStorage-backed, so anything rendered before they
  // rehydrate would be a wrong answer that then visibly corrects itself.
  if (!hasHydrated || !storyHydrated) return null;

  // Claiming needs an account. Gated only when signing in is actually
  // possible: without Firebase env this build has no auth at all (see
  // lib/firebase.ts), and locking the board there would make it permanently
  // unreachable rather than enticing.
  const locked = firebaseEnabled && !user;

  // The board retires once it's finished — a permanently ticked checklist on
  // the home screen is clutter, and daily missions will want the space. A
  // signed-out player never reaches that state, so the check follows the gate.
  if (!locked && allOrdersClaimed(board)) return null;

  const ready = claimableCount(board);
  const { claimed, total } = orderCompletion(board);

  return (
    <section className="mt-2.5 border border-edge-strong bg-panel">
      <header className="flex items-baseline gap-2 border-b border-hairline bg-inset px-3 py-2">
        <h2 className="font-body text-[11px] font-bold uppercase tracking-[0.2em] text-signal">
          Bureau orders
        </h2>
        <span className="ml-auto font-body text-[11px] tabular-nums text-readout-muted">
          {locked ? (
            <span className="text-el-light">Account required</span>
          ) : (
            <>
              {claimed} / {total}
              {ready > 0 ? (
                <span className="ml-2 text-el-light">{ready} to claim</span>
              ) : null}
            </>
          )}
        </span>
      </header>

      {locked ? (
        <LockedOrders onSignIn={() => router.push("/login")} />
      ) : (
        <div className="flex flex-col">
          {board.map((entry) => (
            <OrderRow
              key={entry.order.id}
              entry={entry}
              onClaim={() => claimOrder(entry.order.id, completed)}
              onGo={() => router.push(entry.order.route)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

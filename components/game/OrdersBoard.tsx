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
  currentStep,
  evaluateOrders,
  getStarterOrders,
  isStepUnlocked,
  ORDER_STEPS,
  orderCompletion,
  summariseRewards,
  type OrderContext,
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
  const { order, current, required, claimed, claimable, lockedBy, stepLocked } =
    entry;
  // Both read as "locked" on the row; only the explanation differs, and the
  // step reason is already stated once above the list rather than ten times
  // inside it.
  const anyLock = lockedBy !== null || stepLocked;
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
            : anyLock
              ? "border-hairline text-readout-muted"
              : "border-edge text-readout-muted"
        }`}
      >
        {claimed ? (
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        ) : anyLock ? (
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
      ) : !claimed && !anyLock ? (
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

/**
 * Everything the Bureau Orders board needs, evaluated once.
 *
 * Split out of the panel on 2026-08-13 when Orders moved from the home screen
 * into a navbar button + modal (Tanveer): the button needs the claimable count
 * to badge itself, and the board needs the full evaluation. Running the
 * evaluator twice would be wasteful and — worse — could disagree with itself
 * for a frame after a claim.
 *
 * `hidden` is the panel's old "return null" cases hoisted into data, so the
 * navbar can decide not to render a button at all rather than rendering one
 * that opens an empty modal.
 */
export interface OrdersState {
  /** Stores haven't rehydrated, or the board is finished — show nothing. */
  hidden: boolean;
  /** Signed out with auth available: readable, not claimable. */
  locked: boolean;
  /** Claimable orders across every unlocked step, not just the visible tab. */
  ready: number;
  claimed: number;
  total: number;
  board: OrderProgress[];
  wholeBoard: OrderProgress[];
  activeStep: number;
  setViewedStep: (step: number) => void;
  claimedOrders: Record<string, boolean>;
  /** Cleared story stages, keyed `chapterId:stageId` — passed straight back into
   *  `claimOrder`, which re-checks the goal before paying. */
  cleared: Record<string, boolean>;
  claimOrder: (orderId: string, clearedStages: Record<string, boolean>) => boolean;
}

export function useOrdersState(): OrdersState {
  const { user } = useAuth();

  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const stats = usePlayerStore((s) => s.stats);
  const presets = usePlayerStore((s) => s.presets);
  const roster = usePlayerStore((s) => s.roster);
  const account = usePlayerStore((s) => s.account);
  const characters = usePlayerStore((s) => s.characters);
  const claimedOrders = usePlayerStore((s) => s.claimedOrders);
  const claimOrder = usePlayerStore((s) => s.claimOrder);

  const cleared = useStoryStore((s) => s.cleared);
  const storyHydrated = useStoryStore((s) => s.hasHydrated);

  const context: OrderContext = React.useMemo(
    () => ({
      clearedStages: cleared,
      pulls: stats.pulls,
      bossClears: stats.bossClears,
      presetsSaved: presets.length,
      rosterSize: roster.length,
      accountRank: account.rank,
      characters,
      claimed: claimedOrders,
    }),
    [
      cleared,
      stats,
      presets.length,
      roster.length,
      account.rank,
      characters,
      claimedOrders,
    ],
  );

  const stepOpen = React.useMemo(() => currentStep(context), [context]);
  // Which tab the player is LOOKING at, which is not necessarily the step they
  // are on — they can page back to a finished step to re-read it. Following
  // `stepOpen` automatically would yank the view out from under them the
  // moment they claim the last order of a step.
  const [viewedStep, setViewedStep] = React.useState<number | null>(null);
  const activeStep = viewedStep ?? stepOpen;

  const board = React.useMemo(
    () => evaluateOrders(context, activeStep),
    [context, activeStep],
  );
  const wholeBoard = React.useMemo(() => evaluateOrders(context), [context]);

  // Claiming needs an account. Gated only when signing in is actually
  // possible: without Firebase env this build has no auth at all (see
  // lib/firebase.ts), and locking the board there would make it permanently
  // unreachable rather than enticing.
  const locked = firebaseEnabled && !user;

  // Both stores are localStorage-backed, so anything rendered before they
  // rehydrate would be a wrong answer that then visibly corrects itself. The
  // board also retires once it's finished — a permanently ticked checklist is
  // clutter, and daily missions will want the space. A signed-out player never
  // reaches that state, so the check follows the gate.
  const hidden =
    !hasHydrated ||
    !storyHydrated ||
    (!locked && allOrdersClaimed(wholeBoard));

  const { claimed, total } = orderCompletion(board);

  return {
    hidden,
    locked,
    ready: claimableCount(wholeBoard),
    claimed,
    total,
    board,
    wholeBoard,
    activeStep,
    setViewedStep,
    claimedOrders,
    cleared,
    claimOrder,
  };
}

/**
 * The board itself — step tabs and order rows, no surrounding chrome.
 *
 * Rendered inside a modal opened from the navbar. It used to be a `<section>`
 * pinned to the home screen, which meant the game's "what do I do next"
 * surface was unreachable from every other screen.
 */
export default function OrdersBoard({
  state,
}: {
  state: OrdersState;
}): React.JSX.Element {
  const router = useRouter();
  const {
    locked,
    board,
    wholeBoard,
    activeStep,
    setViewedStep,
    claimedOrders,
    cleared,
    claimOrder,
  } = state;

  if (locked) {
    return <LockedOrders onSignIn={() => router.push("/login")} />;
  }

  return (
    <>
      {/* One tab per step. Shown even when only one step is authored — it
          tells the player the board continues, which a bare list of ten does
          not (Tanveer, 2026-08-13). */}
      <div className="hud-scroll -mx-1 mb-2 flex gap-px overflow-x-auto border-b border-hairline bg-inset">
        {ORDER_STEPS.map((step) => {
          const unlocked = isStepUnlocked(step, claimedOrders);
          const active = step === activeStep;
          const stepReady = claimableCount(
            wholeBoard.filter((e) => e.order.step === step),
          );
          return (
            <button
              key={step}
              type="button"
              // A locked step is readable, not enterable: seeing what is
              // coming is the point of the tab existing.
              onClick={() => setViewedStep(step)}
              className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                active
                  ? "bg-panel text-signal"
                  : "text-readout-muted hover:text-readout"
              }`}
            >
              {!unlocked ? <Lock className="h-3 w-3" strokeWidth={2.4} /> : null}
              Step {step}
              {stepReady > 0 ? (
                <span className="border border-el-light px-1 text-el-light tabular-nums">
                  {stepReady}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {!isStepUnlocked(activeStep, claimedOrders) ? (
        <p className="mb-2 border-b border-hairline pb-2 font-body text-xs text-readout-dim">
          Claim every order in step {activeStep - 1} to open this one. Progress
          you make early still counts — it just waits here.
        </p>
      ) : null}

      <div className="flex flex-col">
        {board.map((entry) => (
          <OrderRow
            key={entry.order.id}
            entry={entry}
            onClaim={() => claimOrder(entry.order.id, cleared)}
            onGo={() => router.push(entry.order.route)}
          />
        ))}
      </div>
    </>
  );
}

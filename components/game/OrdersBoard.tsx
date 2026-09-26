"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Lock } from "lucide-react";
import { useAuth } from "@/hooks/AuthProvider";
import { firebaseEnabled } from "@/lib/firebase";
import { usePlayerStore } from "@/store/playerStore";
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
import ItemIcon from "@/components/game/ItemIcon";
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
 *
 * **Drawn on paper** (Shōnen Ink, ruling #154): it renders inside the Orders
 * `Dialog`. So the text is ink, and every element hue is a FILL with ink on
 * it rather than coloured text, which on paper would not read.
 */

/** One reward, split so the row can draw it. `iconId` is empty for the parts
 *  that aren't an item — a character prize is a name, not a thing you hold. */
function rewardParts(reward: OrderReward): Array<{ iconId: string; text: string }> {
  const parts: Array<{ iconId: string; text: string }> = [];
  // A character leads: it's the only reward worth changing your plans for.
  if (reward.character) {
    parts.push({
      iconId: "",
      text: getCharacterById(reward.character)?.name ?? reward.character,
    });
  }
  if (reward.gems) parts.push({ iconId: "gems", text: `${reward.gems} gems` });
  if (reward.coin)
    parts.push({ iconId: "coin", text: `${reward.coin.toLocaleString()} coin` });
  if (reward.permanentTicket) {
    parts.push({
      iconId: "permanent_ticket",
      text: `${reward.permanentTicket} ticket${reward.permanentTicket > 1 ? "s" : ""}`,
    });
  }
  for (const [id, count] of Object.entries(reward.materials ?? {})) {
    parts.push({ iconId: id, text: `${count}\u00d7 ${materialLabel(id)}` });
  }
  return parts;
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
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-rule px-1 py-2 last:border-b-0">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
          claimed
            ? "border-border bg-el-green"
            : anyLock
              ? "border-muted-foreground text-muted-foreground"
              : "border-border"
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
          className={`font-body text-sm ${claimed ? "text-muted-foreground line-through" : ""}`}
        >
          {order.title}
        </span>
        <span className="font-body text-xs leading-snug text-muted-foreground">
          {claimed
            ? "Claimed"
            : lockedBy
              ? `Complete “${lockedBy.title}” first`
              : order.hint}
        </span>
        {showBar ? (
          <span className="mt-1 flex items-center gap-1.5">
            <Progress value={percent} className="max-w-40" />
            <span className="font-body text-caption tabular-nums text-muted-foreground">
              {current}/{required}
            </span>
          </span>
        ) : null}
      </span>

      {/* What the order pays was `hidden sm:flex` — so on a phone a row said
          what to do and never what for. It wraps to its own line instead now;
          the row is `flex-wrap` for exactly this. */}
      {!claimed ? (
        <span className="order-last flex w-full shrink-0 items-center gap-2.5 pl-6 font-body text-xs font-bold tabular-nums sm:order-none sm:w-auto sm:pl-0">
          {rewardParts(order.reward).map((part) => (
            <span key={part.text} className="flex items-center gap-1.5">
              {part.iconId ? (
                <ItemIcon id={part.iconId} size={20} alt="" />
              ) : null}
              {part.text}
            </span>
          ))}
        </span>
      ) : null}

      {claimable ? (
        <Button variant="claim" size="sm" onClick={onClaim} className="shrink-0">
          Claim
        </Button>
      ) : !claimed && !anyLock ? (
        <Button variant="ghost" size="sm" onClick={onGo} className="shrink-0 gap-0.5">
          {order.routeLabel}
          <ChevronRight className="h-3 w-3" strokeWidth={2.6} />
        </Button>
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
        <span className="font-body text-sm">
          Create an account or log in to access Bureau Orders.
        </span>
        <span className="font-body text-xs leading-snug text-muted-foreground">
          Waiting to be claimed:{" "}
          <span className="font-bold text-card-foreground">
            {prizes.join(" · ")}
          </span>
        </span>
        <span className="font-body text-xs leading-snug text-muted-foreground">
          You keep making progress while signed out — it&apos;s all here when
          you come back.
        </span>
      </span>
      <Button variant="secondary" size="sm" onClick={onSignIn} className="shrink-0">
        Sign in
      </Button>
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
  /** Re-checks the goal before paying — see `playerStore.claimOrder`. */
  claimOrder: (orderId: string) => boolean;
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

  const context: OrderContext = React.useMemo(
    () => ({
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

  // The store is localStorage-backed, so anything rendered before it
  // rehydrates would be a wrong answer that then visibly corrects itself. The
  // board also retires once it's finished — a permanently ticked checklist is
  // clutter, and daily missions will want the space. A signed-out player never
  // reaches that state, so the check follows the gate.
  const hidden = !hasHydrated || (!locked && allOrdersClaimed(wholeBoard));

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
      {/* The shadcn tabs (ruling #154), `line` because they sit inside a
          paper dialog. The rows below are the active step's, so there is no
          `TabsContent` per step: the list is one panel whose contents the
          tab selects. The triggers are 44px now; they were ~28px. */}
      <Tabs
        value={String(activeStep)}
        onValueChange={(value) => setViewedStep(Number(value))}
        className="mb-2"
      >
        <TabsList variant="line" className="hud-scroll overflow-x-auto">
          {ORDER_STEPS.map((step) => {
            const unlocked = isStepUnlocked(step, claimedOrders);
            const stepReady = claimableCount(
              wholeBoard.filter((e) => e.order.step === step),
            );
            return (
              // A locked step is readable, not enterable: seeing what is
              // coming is the point of the tab existing.
              <TabsTrigger
                key={step}
                value={String(step)}
                className="flex-none text-label uppercase tracking-label"
              >
                {!unlocked ? <Lock className="h-3 w-3" strokeWidth={2.4} /> : null}
                Step {step}
                {stepReady > 0 ? (
                  <span className="border border-border bg-el-light px-1 tabular-nums text-card-foreground">
                    {stepReady}
                  </span>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {!isStepUnlocked(activeStep, claimedOrders) ? (
        <p className="mb-2 border-b border-rule pb-2 font-body text-xs text-muted-foreground">
          Claim every order in step {activeStep - 1} to open this one. Progress
          you make early still counts — it just waits here.
        </p>
      ) : null}

      <div className="flex flex-col">
        {board.map((entry) => (
          <OrderRow
            key={entry.order.id}
            entry={entry}
            onClaim={() => claimOrder(entry.order.id)}
            onGo={() => router.push(entry.order.route)}
          />
        ))}
      </div>
    </>
  );
}

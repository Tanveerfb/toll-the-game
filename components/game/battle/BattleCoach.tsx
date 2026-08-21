"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useGameStore } from "@/store/gameStore";
import { useSettingsStore } from "@/store/settingsStore";
import { actionsForTurn } from "@/lib/game/actionEconomy";
import { bonusActionsFor } from "@/lib/game/stageEffects";
import { mergePartnerIds } from "@/lib/game/handTransition";
import {
  pickActiveStep,
  stepApplies,
  tutorialComplete,
  TUTORIAL_STEPS,
  type TutorialAnchor,
  type TutorialStep,
} from "@/lib/tutorial/steps";

/**
 * The battle's four coach marks.
 *
 * Half of the FTUE: the half a checklist can't do (`lib/game/orders.ts` is the
 * other). What to point at and when lives in `lib/tutorial/steps.ts`; this
 * finds the anchor, positions the card, and gets out of the way.
 *
 * **It never blocks play.** The dimming layer is `pointer-events: none`, so
 * every card, button and tile underneath stays live — a step ends because the
 * player did the thing, not because they were made to.
 *
 * Portalled to `document.body`. `BattleArena` applies a shake transform on
 * heavy hits, and an active transform creates a containing block that would
 * silently reinterpret `position: fixed` against it — the same trap that once
 * put the Growth modal behind its own page.
 */

/** Re-measure this often while a step is up. The hand reflows as cards are
 *  played and merged, and an outline left behind on empty space is worse than
 *  no outline. Cheap: one `getBoundingClientRect` on one element. */
const TRACK_INTERVAL_MS = 250;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Value equality, so an unchanged measurement can't trigger a render. */
function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height
  );
}

function measure(anchor: TutorialAnchor): Box | null {
  if (typeof document === "undefined") return null;
  const node = document.querySelector(`[data-tutorial="${anchor}"]`);
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

function CoachCard({
  step,
  box,
  index,
  total,
  onNext,
  onSkipAll,
}: {
  step: TutorialStep;
  box: Box;
  index: number;
  total: number;
  onNext: () => void;
  onSkipAll: () => void;
}): React.JSX.Element {
  const CARD_WIDTH = 260;
  const GAP = 12;

  // Prefer above the anchor; fall back below when there isn't room. The hand
  // sits at the bottom of the screen, so "above" is the common case.
  const above = box.top > 170;
  const top = above ? box.top - GAP : box.top + box.height + GAP;
  const rawLeft = box.left + box.width / 2 - CARD_WIDTH / 2;
  const left = Math.max(
    8,
    Math.min(rawLeft, (globalThis.innerWidth ?? 1024) - CARD_WIDTH - 8),
  );

  return (
    <div
      role="dialog"
      aria-label={step.title}
      style={{
        position: "fixed",
        top,
        left,
        width: CARD_WIDTH,
        transform: above ? "translateY(-100%)" : undefined,
      }}
      className="pointer-events-auto z-[71] border border-signal bg-panel px-3 py-2.5 shadow-[0_10px_34px_rgba(0,0,0,0.7)]"
    >
      <p className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-signal">
        Step {index + 1} of {total}
      </p>
      <p className="mt-0.5 font-heading text-base leading-tight tracking-[0.04em] text-readout-strong">
        {step.title}
      </p>
      <p className="mt-1 font-body text-[11px] leading-snug text-readout-dim">
        {step.body}
      </p>
      {/* This is the first thing a new player is asked to press, and both
          controls were unpressable on a phone: Skip all was bare 9px text with
          no padding at all (~12px tall) and Got it was ~22px. */}
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={onSkipAll}
          className="flex min-h-11 items-center pr-3 font-body text-[9px] font-bold uppercase tracking-[0.14em] text-readout-muted transition-colors hover:text-el-red"
        >
          Skip all
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex min-h-11 items-center border border-signal px-4 font-body text-[9px] font-bold uppercase tracking-[0.14em] text-signal transition-colors hover:bg-signal/20"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export default function BattleCoach(): React.JSX.Element | null {
  const battlePhase = useGameStore((s) => s.battlePhase);
  const deck = useGameStore((s) => s.deck);
  const actionQueue = useGameStore((s) => s.actionQueue);
  const queuedNullCount = useGameStore((s) => s.queuedNullCount);
  const playerTeam = useGameStore((s) => s.playerTeam);
  const stageEffects = useGameStore((s) => s.stageEffects);

  const seen = useSettingsStore((s) => s.seenTutorialSteps);
  const dismissed = useSettingsStore((s) => s.tutorialDismissed);
  const markSeen = useSettingsStore((s) => s.markTutorialStepSeen);
  const setDismissed = useSettingsStore((s) => s.setTutorialDismissed);

  const finished = dismissed || tutorialComplete(seen);

  const context = React.useMemo(
    () => ({
      playerActing: battlePhase === "PlayerAction",
      handSize: deck.length,
      mergeAvailable: deck.some(
        (card) => mergePartnerIds(card, deck).length > 0,
      ),
      queuedActions: actionQueue.length + queuedNullCount,
      actionCap: actionsForTurn(
        playerTeam,
        bonusActionsFor(stageEffects, "player"),
      ),
      hasBench: playerTeam.some((unit) => unit.isSub && unit.currentHP > 0),
    }),
    [
      battlePhase,
      deck,
      actionQueue.length,
      queuedNullCount,
      playerTeam,
      stageEffects,
    ],
  );

  // Memoised because `pickActiveStep` builds a fresh object every call. Left
  // bare, `step` changed identity on every render, which re-ran the measuring
  // effect below, which set state, which rendered again — "Maximum update
  // depth exceeded", live, in a battle (2026-08-13).
  const step = React.useMemo(
    () => (finished ? null : pickActiveStep(context, seen, dismissed)),
    [finished, context, seen, dismissed],
  );

  // Doing the thing is what finishes a step. When the situation a step
  // describes stops being true while the player is still acting, they just did
  // it — mark it learned rather than showing it again next turn. Gated on
  // `playerActing` so a step that merely went off screen because the enemy's
  // turn started isn't counted as read.
  const showing = React.useRef<string | null>(null);
  const stepId = step?.id ?? null;
  React.useEffect(() => {
    const previous = showing.current;
    if (
      previous &&
      previous !== stepId &&
      context.playerActing &&
      !stepApplies(previous, context)
    ) {
      markSeen(previous);
    }
    showing.current = stepId;
    // Keyed on the id rather than the step object for the same reason as the
    // measuring effect: the object is rebuilt on every pick.
  }, [stepId, context, markSeen]);

  const [box, setBox] = React.useState<Box | null>(null);

  const anchor = step?.anchor ?? null;

  React.useEffect(() => {
    // No step: leave the last box alone rather than clearing it. Nothing reads
    // it while `step` is null, and clearing it here would be a synchronous
    // setState in an effect for no visible benefit.
    if (!anchor) return;
    // Keyed on the anchor, not the step: two consecutive steps can point at
    // the same element, and re-measuring identical geometry is churn.
    const sync = () =>
      setBox((previous) => {
        const next = measure(anchor);
        // Bail out when nothing moved. `measure` returns a new object every
        // call, so without this the 250ms tracker re-rendered the whole arena
        // four times a second for the life of a step.
        return sameBox(previous, next) ? previous : next;
      });
    sync();
    const id = setInterval(sync, TRACK_INTERVAL_MS);
    window.addEventListener("resize", sync);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", sync);
    };
  }, [anchor]);

  if (!step || !box || typeof document === "undefined") return null;

  const index = TUTORIAL_STEPS.findIndex((entry) => entry.id === step.id);

  return createPortal(
    <>
      {/* The spotlight. `pointer-events: none` is the whole contract — the
          screen is dimmed, not disabled. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: box.top - 4,
          left: box.left - 4,
          width: box.width + 8,
          height: box.height + 8,
          boxShadow: "0 0 0 9999px rgba(2, 5, 8, 0.72)",
          outline: "1px solid var(--color-signal)",
        }}
        className="pointer-events-none z-[70]"
      />
      <CoachCard
        step={step}
        box={box}
        index={index}
        total={TUTORIAL_STEPS.length}
        onNext={() => markSeen(step.id)}
        onSkipAll={() => setDismissed(true)}
      />
    </>,
    document.body,
  );
}

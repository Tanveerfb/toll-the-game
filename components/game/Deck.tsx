"use client";

import React from "react";
import Image from "next/image";
import { ChevronsRight, Combine, RotateCcw } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { getCharacterArt } from "@/lib/game/characterArt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MountedDialog from "@/components/ui/MountedDialog";
import { useBattleContext } from "@/hooks/BattleProvider";
import type { ActionCard } from "@/types/action";
import { mergePartnerIds } from "@/lib/game/handTransition";
import { hasMergeablePair } from "@/lib/game/deck";
import Hand from "@/components/game/battle/Hand";
import CardDetail, {
  skillPowerText,
} from "@/components/game/battle/CardDetail";
import {
  useDealSequence,
  usePrefersReducedMotion,
} from "@/hooks/useDealSequence";
import { actionsForTurn } from "@/lib/game/actionEconomy";
import { bonusActionsFor } from "@/lib/game/stageEffects";

// The card face — art, rank pips, skill-type glyph — moved to
// components/game/battle/Hand.tsx with the rest of the hand on 2026-08-12.

function getCharacterInitial(name?: string): string {
  if (!name || name.trim().length === 0) {
    return "?";
  }
  return name.trim().charAt(0).toUpperCase();
}

export default function Deck() {
  const {
    deck,
    actionQueue,
    selectCard,
    deselectCard,
    playerTeam,
    battlePhase,
    mergeDeckCard,
    reorderDeckCard,
    resetHand,
    mergeAllCards,
    handSnapshot,
    queuedNullCount,
    addNullAction,
    removeNullAction,
    bigHitFocus,
  } = useGameStore();

  const slotsUsed = actionQueue.length + queuedNullCount;
  // Living field members +1, capped at 3 — same rule as the enemy side, so a
  // player down to their last unit loses tempo exactly as an enemy would.
  const stageEffects = useGameStore((s) => s.stageEffects);
  const actionCap = actionsForTurn(
    playerTeam,
    bonusActionsFor(stageEffects, "player"),
  );

  const isPlayerActionPhase = battlePhase === "PlayerAction";

  // Auto-execute when the queue reaches this turn's action cap, and auto-pass
  // when there are no cards left to play (e.g. the whole field died and a sub
  // is waiting for the next turn to enter).
  const { resolveplayerTurnWrapper } = useBattleContext();
  React.useEffect(() => {
    if (!isPlayerActionPhase) return;
    // Every slot filled (real actions + passes), or no cards left to play.
    if (slotsUsed >= actionCap || deck.length === 0) {
      resolveplayerTurnWrapper();
    }
  }, [
    slotsUsed,
    actionCap,
    deck.length,
    isPlayerActionPhase,
    resolveplayerTurnWrapper,
  ]);

  // The hand the player is looking at. Equal to `deck` except while a fresh
  // turn's draw is still playing out card by card.
  const presentedDeck = useDealSequence(deck);
  const reducedMotion = usePrefersReducedMotion();

  const [previewCard, setPreviewCard] = React.useState<ActionCard | null>(null);
  const previewShowTimerRef = React.useRef<number | null>(null);
  const previewHideTimerRef = React.useRef<number | null>(null);

  // One rule for every way a card can merge (Tanveer, 2026-08-12): same owner,
  // same skill, same rank. The button used to advertise a looser one and the
  // hold-to-highlight ring the strict one, so the two disagreed on screen.
  const canMergeCard = React.useCallback(
    (card: ActionCard): boolean => mergePartnerIds(card, deck).length > 0,
    [deck],
  );

  /** Drives the Merge All button's disabled state, from the same predicate the
   *  action itself runs — so the button is never live over a hand that cannot
   *  merge, and never dead over one that can. */
  const canMergeAny = React.useMemo(() => hasMergeablePair(deck), [deck]);

  const beginPreview = React.useCallback((card: ActionCard) => {
    if (previewHideTimerRef.current) {
      window.clearTimeout(previewHideTimerRef.current);
      previewHideTimerRef.current = null;
    }

    if (previewShowTimerRef.current) {
      window.clearTimeout(previewShowTimerRef.current);
    }

    previewShowTimerRef.current = window.setTimeout(() => {
      setPreviewCard(card);
    }, 260);
  }, []);

  const endPreview = React.useCallback(() => {
    if (previewShowTimerRef.current) {
      window.clearTimeout(previewShowTimerRef.current);
      previewShowTimerRef.current = null;
    }

    if (previewHideTimerRef.current) {
      window.clearTimeout(previewHideTimerRef.current);
    }

    previewHideTimerRef.current = window.setTimeout(() => {
      setPreviewCard(null);
    }, 120);
  }, []);

  React.useEffect(
    () => () => {
      if (previewShowTimerRef.current) {
        window.clearTimeout(previewShowTimerRef.current);
      }
      if (previewHideTimerRef.current) {
        window.clearTimeout(previewHideTimerRef.current);
      }
    },
    [],
  );

  /**
   * The card a press-and-hold opened.
   *
   * Separate state from `previewCard` on purpose: the preview is transient and
   * pointer-driven (it hides 120ms after the pointer leaves), while this is a
   * modal the player dismisses. Sharing one value would have the hover timers
   * closing a dialogue someone is reading.
   */
  const [detailCard, setDetailCard] = React.useState<ActionCard | null>(null);

  return (
    <div
      // Big-hit focus (spec §1): R3/ultimate reveals momentarily recede the
      // hand while the center battle stage takes visual focus — transient
      // only, the hand stays persistently visible in normal play (never a
      // permanent drawer), so this just dims/shrinks it a touch, not hides it.
      //
      // The player's paper (ruling #156): the same sheet the player's row sits
      // on continues through the queue, the hand and the controls, so the
      // bottom of the screen reads as one page that belongs to you.
      className={`bighit-recede relative z-30 w-full shrink-0 border-t border-rule bg-card px-3 pb-2 pt-1.5 text-card-foreground transition-[opacity,transform] duration-300 ${bigHitFocus ? "scale-[0.98] opacity-60" : "scale-100 opacity-100"}`}
    >
      {previewCard ? (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-3 w-full max-w-xl -translate-x-1/2">
          {/* A paper panel lifted off the page, the same surface as the
              press-and-hold dialog below. */}
          <div className="w-full border-2 border-border bg-card text-card-foreground ink-slab">
            <div className="flex w-full items-start justify-between gap-3 border-b border-rule px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-heading text-xl tracking-title">
                  {previewCard.skill.skillName}
                </p>
                <p className="font-body text-caption font-bold uppercase tracking-label text-muted-foreground">
                  {previewCard.skill.type} • Rank {previewCard.rank} •{" "}
                  {skillPowerText(previewCard)}
                </p>
              </div>
              <Badge variant="secondary">R{previewCard.rank}</Badge>
            </div>
            <div className="px-4 py-3">
              <CardDetail card={previewCard} />
            </div>
          </div>
        </div>
      ) : null}

      {/* The same body, as a modal. Hover can't happen on a phone, so before
          this existed a player on the device the game targets had no way to
          read a card's skill mid-fight. */}
      {detailCard ? (
        <MountedDialog
          title={detailCard.skill.skillName}
          description={`${detailCard.skill.type} · Rank ${detailCard.rank} · ${skillPowerText(detailCard)}`}
          onClose={() => setDetailCard(null)}
          className="sm:max-w-lg"
        >
          <CardDetail card={detailCard} />
        </MountedDialog>
      ) : null}

      {/* Action economy, queue, controls. The queue scrolls; the controls do
          NOT — Reset and End Turn used to sit inside the same overflow
          container, so a full queue on a narrow screen scrolled End Turn off
          the edge. */}
      <div className="mb-1.5 flex items-center gap-1.5">
        {/* Reset is an icon (Tanveer, 2026-09-01: "we don't need text that can
            be assumed by players"). End Turn keeps its word deliberately — it
            is the one irreversible control in a turn, and an unlabelled glyph
            is not what should commit three actions. */}
        <Button
          variant="secondary"
          size="icon"
          disabled={!isPlayerActionPhase || !handSnapshot}
          onClick={resetHand}
          aria-label="Reset the hand"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2.2} />
        </Button>

        {/* Merge All (Tanveer, 2026-09-01), chosen over an auto-merge toggle.
            Auto-merge already runs on every draw and every play, but only
            between *neighbours*; settling a non-adjacent pair meant the
            per-card Merge button, once per pair. This does the lot in one tap
            and still leaves the turn a decision — merging shrinks the hand,
            banks ult gauge and spends cards against the R3 cap, and a toggle
            would do all three unwatched.

            Disabled rather than hidden when nothing can merge: a control that
            vanishes teaches nobody why. */}
        <Button
          variant="secondary"
          size="icon"
          disabled={!isPlayerActionPhase || !canMergeAny}
          onClick={mergeAllCards}
          aria-label="Merge every matching pair in the hand"
        >
          <Combine className="h-4 w-4" strokeWidth={2.2} />
        </Button>

        {/* The queue. It had 83px to show three 56px slots — 97px clipped, so
            two of the three actions you had committed were invisible, which is
            most of what the turn's state is. Measured 2026-09-01.

            Reclaimed from the ACTIONS chip that used to sit to the left: it
            spent 124px restating what filled and empty slots already show, so
            it is gone and its `aria-label` and tutorial anchor moved here.
            Empty slots are `flex-1` now, so the row always fills its width and
            the count is legible without counting pips. */}
        <div
          data-tutorial="actions"
          aria-label={`${actionCap} action${actionCap > 1 ? "s" : ""} this turn, ${Math.max(0, actionCap - slotsUsed)} remaining`}
          className="hud-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        >
          {actionQueue.map((card) => {
            const char = playerTeam.find(
              (c) => c.instanceId === card.sourceInstanceId,
            );
            const isUlt = card.skill.type === "ultimate";
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => isPlayerActionPhase && deselectCard(card.id)}
                onMouseEnter={() => beginPreview(card)}
                onMouseLeave={endPreview}
                onFocus={() => beginPreview(card)}
                onBlur={endPreview}
                // A committed action: yellow, the "this is going to happen"
                // cue, on the tray's paper. An ultimate carries the five-hue
                // frame it has in the hand (#133) rather than a glow.
                //
                // `flex-1`, the same share as an empty slot (mockup C, his pick
                // 2026-09-27). It was `shrink-0 max-w-44`: one queued action
                // took 176px of a ~200px strip, scrolling the second and third
                // slots off-screen — the 2026-09-01 "two of three actions
                // invisible" finding, back through the filled slots.
                className={`flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-1 border-2 bg-primary px-1 text-primary-foreground transition-colors hover:bg-primary/90 ${isUlt ? "frame-ultimate [--frame-fill:var(--primary)]" : "border-border"}`}
              >
                {char && getCharacterArt(char.id) ? (
                  <Image
                    src={getCharacterArt(char.id)!}
                    alt={char.name}
                    width={48}
                    height={48}
                    className="h-6 w-6 shrink-0 border border-border object-cover object-top"
                  />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-border font-heading text-sm">
                    {getCharacterInitial(char?.name)}
                  </span>
                )}
                {/* At a third of the strip there is room for the portrait
                    and the skill name on two lines, which is what mockup C
                    drew. Who and which rank are in the label, and on the card
                    in the hand the slot was filled from. */}
                <span className="flex min-w-0 flex-col text-left leading-tight">
                  <span className="sr-only">
                    {char?.name} {isUlt ? "ultimate" : `rank ${card.rank}`}:
                  </span>
                  <span className="line-clamp-2 break-words text-label font-bold">
                    {card.skill.skillName}
                  </span>
                </span>
              </button>
            );
          })}
          {/* Queued passes — tap to take back */}
          {Array.from({ length: queuedNullCount }).map((_, i) => (
            <button
              key={`pass-${i}`}
              type="button"
              onClick={() => isPlayerActionPhase && removeNullAction()}
              className="flex min-h-11 min-w-14 flex-1 items-center justify-center border-2 border-border bg-muted font-body text-label font-bold uppercase tracking-label transition-colors hover:bg-destructive/30"
            >
              Pass
            </button>
          ))}
          {/* Empty slots — tap to pass */}
          {Array.from({ length: Math.max(0, actionCap - slotsUsed) }).map((_, i) => (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={() => isPlayerActionPhase && addNullAction()}
              disabled={!isPlayerActionPhase}
              aria-label="Pass this action"
              className="flex min-h-11 min-w-14 flex-1 items-center justify-center border-2 border-dashed border-muted-foreground font-heading text-base text-muted-foreground transition-colors enabled:hover:border-border enabled:hover:text-card-foreground disabled:cursor-not-allowed"
            >
              {slotsUsed + i + 1}
            </button>
          ))}
        </div>

        {/* Pinned outside the scroll container above — End Turn scrolling off
            the edge behind a full queue is the bug that put it here. */}
        {/* The one thing a turn wants pressed: the primary button. */}
        <Button
          disabled={!isPlayerActionPhase || actionQueue.length === 0}
          onClick={resolveplayerTurnWrapper}
          className="shrink-0 gap-1.5"
        >
          <ChevronsRight className="h-4 w-4" strokeWidth={2.2} />
          End
        </Button>
      </div>

      {/* The hand — always visible, and every card interaction inside it is
          animated (components/game/battle/Hand.tsx). Cards flex to fill the
          row so the whole hand shows at once, 7DSGC-style.

          `-mx-3` cancels this panel's `px-3`, because the hand is the one row
          that needs every pixel of the screen and gains nothing from aligning
          with the controls above it. Eight cards is the hard maximum (4v4) and
          the arithmetic is tight: at 390px the padded 366px row fits eight 44px
          cards plus gaps in 370px — 4px over, so the last card clipped. Full
          width gives 372px of room for 8 x 46.5px, which clears the 44px floor
          instead of sitting exactly on it. Measured 2026-09-01. */}
      <div className="-mx-3">
        <Hand
          cards={presentedDeck}
          playerTeam={playerTeam}
          interactive={isPlayerActionPhase}
          queueFull={slotsUsed >= actionCap}
          reducedMotion={reducedMotion}
          onSelect={selectCard}
          onMerge={mergeDeckCard}
          onReorder={reorderDeckCard}
          onPreviewStart={beginPreview}
          onPreviewEnd={endPreview}
          onDetail={setDetailCard}
          canUseMergeButton={canMergeCard}
        />
      </div>

      {/* Where the arena's Speed / Skip / Controls row paints (Tanveer,
          2026-09-01). It lives in `BattleArena` because it needs the
          sequencer bound to the arena's own ref and the controls sheet needs a
          dozen arena locals, so it stays in that component's React tree and
          portals into this slot — which is how it can be the last thing on the
          screen while `BattleArena` is still the first of the two siblings.

          This replaces the team-bar dots that used to close the screen. They
          duplicated the HP bar already on every unit tile and cost a row at the
          one edge a thumb reaches most easily. */}
      <div data-battle-control-slot className="mt-1.5 empty:hidden" />
    </div>
  );
}

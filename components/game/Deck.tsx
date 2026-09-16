"use client";

import React from "react";
import Image from "next/image";
import { ChevronsRight, Combine, RotateCcw } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import { getCharacterArt } from "@/lib/game/characterArt";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBattleContext } from "@/hooks/BattleProvider";
import type { ActionCard } from "@/types/action";
import { mergePartnerIds } from "@/lib/game/handTransition";
import { hasMergeablePair } from "@/lib/game/deck";
import Hand from "@/components/game/battle/Hand";
import CardDetail, {
  skillPowerText,
} from "@/components/game/battle/CardDetail";
import DetailOverlay from "@/components/game/DetailOverlay";
import {
  useDealSequence,
  usePrefersReducedMotion,
} from "@/hooks/useDealSequence";
import { actionsForTurn } from "@/lib/game/actionEconomy";
import { bonusActionsFor } from "@/lib/game/stageEffects";

/** Merge tier. Deliberately not stars — a star row reads as rarity, which is
 *  a different axis and one this game also has. */
function getRankPips(rank: 1 | 2 | 3): string {
  return `${"◆".repeat(rank)}${"◇".repeat(3 - rank)}`;
}

// The card face — art, rank pips, skill-type glyph — moved to
// components/game/battle/Hand.tsx with the rest of the hand on 2026-08-12.

function getCharacterInitial(name?: string): string {
  if (!name || name.trim().length === 0) {
    return "?";
  }
  return name.trim().charAt(0).toUpperCase();
}

function getColorTokenClasses(color?: string): string {
  switch (color) {
    case "red":
      return "border-el-red/80 bg-el-red/10";
    case "blue":
      return "border-el-blue/80 bg-el-blue/10";
    case "green":
      return "border-el-green/80 bg-el-green/10";
    case "dark":
      return "border-el-dark/80 bg-el-dark/10";
    case "light":
    default:
      return "border-el-light/80 bg-el-light/10";
  }
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
      className={`bighit-recede relative z-30 w-full shrink-0 border-t border-hairline bg-linear-to-t from-black/95 to-black/70 px-3 pb-2 pt-1.5 backdrop-blur-md transition-[opacity,transform] duration-300 ${bigHitFocus ? "scale-[0.98] opacity-60" : "scale-100 opacity-100"}`}
    >
      {previewCard ? (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-3 w-full max-w-xl -translate-x-1/2">
          <Card className="w-full">
            <CardHeader className="px-4 py-3">
              <div className="flex w-full items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    {previewCard.skill.skillName}
                  </CardTitle>
                  <CardDescription className="tracking-[0.12em]">
                    {previewCard.skill.type} • Rank {previewCard.rank} •{" "}
                    {skillPowerText(previewCard)}
                  </CardDescription>
                </div>
                <span className="rounded-none border border-el-light/70 bg-el-light/15 px-2 py-0.5 font-body text-xs uppercase tracking-[0.12em] text-el-light">
                  R{previewCard.rank}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 py-3">
              <CardDetail card={previewCard} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* The same body, as a modal. Hover can't happen on a phone, so before
          this existed a player on the device the game targets had no way to
          read a card's skill mid-fight. */}
      {detailCard ? (
        <DetailOverlay
          title={detailCard.skill.skillName}
          subtitle={`${detailCard.skill.type} · Rank ${detailCard.rank} · ${skillPowerText(detailCard)}`}
          onClose={() => setDetailCard(null)}
        >
          <CardDetail card={detailCard} />
        </DetailOverlay>
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
          variant="ghost"
          size="sm"
          disabled={!isPlayerActionPhase || !handSnapshot}
          onClick={resetHand}
          aria-label="Reset the hand"
          className="w-11 shrink-0 px-0"
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
          variant="ghost"
          size="sm"
          disabled={!isPlayerActionPhase || !canMergeAny}
          onClick={mergeAllCards}
          aria-label="Merge every matching pair in the hand"
          className="w-11 shrink-0 px-0"
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
                className={`flex min-h-11 min-w-0 max-w-44 shrink-0 cursor-pointer items-center gap-1.5 border px-1.5 transition-colors ${getColorTokenClasses(char?.color)} ${isUlt ? "ring-1 ring-el-light/80 shadow-[0_0_8px_rgba(232,209,116,0.45)]" : ""}`}
              >
                {char && getCharacterArt(char.id) ? (
                  <Image
                    src={getCharacterArt(char.id)!}
                    alt={char.name}
                    width={48}
                    height={48}
                    className="h-6 w-6 shrink-0 border border-edge object-cover object-top"
                  />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-edge font-heading text-sm text-readout-strong/90">
                    {getCharacterInitial(char?.name)}
                  </span>
                )}
                <span className="flex min-w-0 flex-col text-left leading-tight">
                  <span className="truncate text-[10px] font-bold text-readout-strong">
                    {char?.name}
                  </span>
                  <span
                    className={`truncate text-[9px] ${isUlt ? "text-el-light" : "text-readout"}`}
                  >
                    {isUlt ? "ULT" : getRankPips(card.rank)} •{" "}
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
              className="flex min-h-11 min-w-14 flex-1 items-center justify-center border border-edge bg-panel-raised/60 font-body text-[9px] uppercase tracking-widest text-readout-dim transition-colors hover:border-el-red/70 hover:text-el-red"
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
              className="flex min-h-11 min-w-14 flex-1 items-center justify-center border border-dashed border-edge font-body text-[10px] text-readout-muted transition-colors enabled:hover:border-edge-strong enabled:hover:text-readout-dim disabled:cursor-not-allowed"
            >
              {slotsUsed + i + 1}
            </button>
          ))}
        </div>

        {/* Pinned outside the scroll container above — End Turn scrolling off
            the edge behind a full queue is the bug that put it here. */}
        <Button
          variant="secondary"
          size="sm"
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

"use client";

import React from "react";
import Image from "next/image";
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
import KeyworkHighlighter from "@/components/ui/KeyworkHighlighter";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";
import {
  buildDescriptionForRank,
  buildSkillKeywordGlossary,
} from "@/lib/game/descriptionTranslator";
import { mechanicGlossary } from "@/lib/game/mechanicGlossary";
import { mergePartnerIds } from "@/lib/game/handTransition";
import Hand from "@/components/game/battle/Hand";
import {
  useDealSequence,
  usePrefersReducedMotion,
} from "@/hooks/useDealSequence";
import { actionsForTurn } from "@/lib/game/actionEconomy";
import { bonusActionsFor } from "@/lib/game/stageEffects";
import { ELEMENT_SWATCH } from "@/lib/game/elementSwatch";
import type { BattleCharacter } from "@/types/character";
import {
  extractKeywordFootnotes,
  formatFootnoteLabel,
} from "@/lib/game/keywordFootnotes";

function getSkillPowerText(card: ActionCard): string {
  if (card.skill.type === "ultimate") {
    return `Power ${card.skill.damage}`;
  }
  return `Power ${card.skill.damageRanked[card.rank - 1]}`;
}

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

function getSkillDescription(card: ActionCard): string {
  const skillData = card.skill as CharacterSkillData;

  if (!skillData.description || skillData.description.trim().length === 0) {
    return "No description available.";
  }

  return buildDescriptionForRank(skillData, card.rank - 1);
}

// Compact per-unit dots (spec §1 item 6, "Team bar") — an at-a-glance
// who's-alive readout, one row per side.
function TeamBarDots({
  units,
  presentedHp,
}: {
  units: BattleCharacter[];
  /** HP as currently shown by the sequencer. These dots read store truth
   *  directly, so without this they went dark the moment the engine
   *  committed — announcing a death while the tile was still mid-lunge. */
  presentedHp: Record<string, number>;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1">
      {/* Field only — the bench isn't part of the battlefield readout; it
          lives in the Team list (Tanveer, 2026-08-11). */}
      {units
        .filter((unit) => !unit.isSub)
        .map((unit) => {
          const shownHp = presentedHp[unit.instanceId] ?? unit.currentHP;
          return (
            <span
              key={unit.instanceId}
              title={`${unit.name} — ${Math.max(0, shownHp)}/${unit.hp} HP`}
              className={`h-2 w-2 rounded-full ${ELEMENT_SWATCH[unit.color]} ${
                shownHp <= 0 ? "opacity-25 grayscale" : "opacity-100"
              }`}
            />
          );
        })}
    </div>
  );
}

export default function Deck() {
  const {
    deck,
    actionQueue,
    selectCard,
    deselectCard,
    playerTeam,
    enemyTeam,
    battlePhase,
    mergeDeckCard,
    reorderDeckCard,
    resetHand,
    handSnapshot,
    queuedNullCount,
    addNullAction,
    removeNullAction,
    bigHitFocus,
  } = useGameStore();

  const presentedHp = useGameStore((s) => s.presentedHp);

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

  const previewDescription = React.useMemo(
    () => (previewCard ? getSkillDescription(previewCard) : ""),
    [previewCard],
  );

  // Tiered stat wording ("raises", "greatly lowers") resolves to this card's
  // actual numbers at its rank
  const previewGlossary = React.useMemo(
    () =>
      previewCard
        ? {
            ...mechanicGlossary,
            ...buildSkillKeywordGlossary(
              previewCard.skill as CharacterSkillData,
              previewCard.rank - 1,
            ),
          }
        : mechanicGlossary,
    [previewCard],
  );

  const previewKeywordDefinitions = React.useMemo(
    () => extractKeywordFootnotes(previewDescription, previewGlossary),
    [previewDescription, previewGlossary],
  );

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
          <Card className="w-full rounded-none border border-edge bg-panel/95 ring-0">
            <CardHeader className="border-b border-hairline px-4 py-3">
              <div className="flex w-full items-start justify-between gap-3">
                <div>
                  <CardTitle className="font-heading text-xl tracking-[0.08em] text-readout-strong">
                    {previewCard.skill.skillName}
                  </CardTitle>
                  <CardDescription className="font-body text-xs uppercase tracking-[0.12em] text-readout-dim">
                    {previewCard.skill.type} • Rank {previewCard.rank} •{" "}
                    {getSkillPowerText(previewCard)}
                  </CardDescription>
                </div>
                <span className="rounded-none border border-el-light/70 bg-el-light/15 px-2 py-0.5 font-body text-xs uppercase tracking-[0.12em] text-el-light">
                  R{previewCard.rank}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 py-3">
              <p className="font-body text-sm text-readout">
                <KeyworkHighlighter
                  text={previewDescription}
                  className="font-body text-sm text-readout"
                  glossary={previewGlossary}
                  keywordClassName="inline-flex cursor-help items-center rounded-none border border-edge-strong bg-transparent px-1 py-[1px] font-body text-xs uppercase tracking-[0.06em] text-readout-strong"
                />
              </p>

              {previewKeywordDefinitions.length > 0 ? (
                <>
                  <div className="my-3 border-t border-edge" />
                  <div className="space-y-1">
                    {previewKeywordDefinitions.map((entry) => (
                      <p
                        key={entry.keyword}
                        className="font-body text-xs text-readout-dim"
                      >
                        <span className="mr-1 text-readout-muted">※</span>
                        <span className="font-semibold text-signal">
                          {formatFootnoteLabel(entry.keyword)}
                        </span>
                        <span className="text-readout"> — {entry.meaning}</span>
                      </p>
                    ))}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Action economy, queue, controls. The queue scrolls; the controls do
          NOT — Reset and End Turn used to sit inside the same overflow
          container, so a full queue on a narrow screen scrolled End Turn off
          the edge. */}
      <div className="mb-1.5 flex items-center gap-2">
        {/* The cap used to be inferable only by counting leftover empty boxes. */}
        <div
          data-tutorial="actions"
          className="flex shrink-0 items-center gap-1 border border-hairline bg-inset px-1.5 py-1"
          title={`${actionCap} action${actionCap > 1 ? "s" : ""} this turn`}
        >
          <span className="mr-0.5 font-body text-[8px] font-bold uppercase tracking-[0.16em] text-readout-muted">
            Actions
          </span>
          {Array.from({ length: actionCap }).map((_, i) => (
            <span
              key={`pip-${i}`}
              className={`block h-3 w-2 border ${i < slotsUsed ? "border-signal bg-signal" : "border-edge bg-void"}`}
            />
          ))}
          <span className="ml-1 font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-dim">
            {Math.max(0, actionCap - slotsUsed)} left
          </span>
        </div>

        <div className="hud-scroll flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
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
                className={`flex h-9 min-w-0 max-w-44 shrink-0 cursor-pointer items-center gap-1.5 border px-1.5 transition-colors ${getColorTokenClasses(char?.color)} ${isUlt ? "ring-1 ring-el-light/80 shadow-[0_0_8px_rgba(232,209,116,0.45)]" : ""}`}
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
              className="flex h-9 w-14 shrink-0 items-center justify-center border border-edge bg-panel-raised/60 font-body text-[9px] uppercase tracking-widest text-readout-dim transition-colors hover:border-el-red/70 hover:text-el-red"
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
              title="Tap to pass this action"
              className="flex h-9 w-14 shrink-0 items-center justify-center border border-dashed border-edge font-body text-[10px] text-readout-muted transition-colors enabled:hover:border-edge-strong enabled:hover:text-readout-dim disabled:cursor-not-allowed"
            >
              {slotsUsed + i + 1}
            </button>
          ))}
        </div>

        {/* Pinned outside the scroll container above. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            disabled={!isPlayerActionPhase || !handSnapshot}
            onClick={resetHand}
            className="shrink-0 rounded-none border border-edge px-2 text-[11px] uppercase tracking-widest text-readout-dim hover:border-edge-strong disabled:border-hairline disabled:text-readout-muted"
          >
            Reset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!isPlayerActionPhase || actionQueue.length === 0}
            onClick={resolveplayerTurnWrapper}
            className="shrink-0 rounded-none border border-signal bg-signal/10 px-3 text-[11px] uppercase tracking-widest text-signal hover:bg-signal/20 disabled:border-hairline disabled:bg-transparent disabled:text-readout-muted"
          >
            End Turn
          </Button>
        </div>
      </div>

      {/* The hand — always visible, and every card interaction inside it is
          animated (components/game/battle/Hand.tsx). Cards flex to fill the
          row so the whole hand shows at once, 7DSGC-style. */}
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
        canUseMergeButton={canMergeCard}
      />

      {/* Team bar — bottom edge of the screen (spec §1 item 6), below the
          always-visible hand. */}
      <div className="mt-1.5 flex items-center justify-center gap-3">
        <TeamBarDots units={playerTeam} presentedHp={presentedHp} />
        <span className="font-body text-[9px] uppercase tracking-[0.2em] text-readout-muted">
          vs
        </span>
        <TeamBarDots units={enemyTeam} presentedHp={presentedHp} />
      </div>
    </div>
  );
}

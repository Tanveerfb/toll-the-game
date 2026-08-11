"use client";

import React from "react";
import Image from "next/image";
import { useGameStore } from "@/store/gameStore";
import { getCharacterArt, getSkillArt } from "@/lib/game/characterArt";
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
import {
  ArrowBigDown,
  ArrowBigUp,
  Heart,
  Sword,
  Swords,
} from "lucide-react";
import { mechanicGlossary } from "@/lib/game/mechanicGlossary";
import { getCardFrameStyle } from "@/lib/game/cardFrameStyle";
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

// Skill-type badge (7DSGC-style, top-right corner of a card). Collapses the
// full SkillType union into the five gameplay categories: attack, attack-debuff
// (an attack that also inflicts a debuff), buff, debuff, heal.
type SkillTypeCategory =
  | "attack"
  | "attackDebuff"
  | "buff"
  | "debuff"
  | "heal";

const DEBUFF_MECHANICS = new Set([
  "debuff",
  "seal",
  "stun",
  "shock",
  "bleed",
  "corrosion",
  "decay",
  "weaken",
  "extort",
  "rupture",
  "disable",
  "ignite",
]);

function skillTypeCategory(skill: ActionCard["skill"]): SkillTypeCategory {
  switch (skill.type) {
    case "heal":
    case "cleanse":
      return "heal";
    case "buff":
    case "stance":
      return "buff";
    case "debuff":
    case "disable":
      return "debuff";
    // attack + ultimate (ultimates are offensive super-attacks): tag as
    // attack-debuff when the skill also carries a debuff-type mechanic.
    default: {
      const hasDebuff = (skill.mechanics ?? []).some((m) =>
        DEBUFF_MECHANICS.has(m.type),
      );
      return hasDebuff ? "attackDebuff" : "attack";
    }
  }
}

/**
 * Skill type is a glyph, not a colour. The five badges used to be red /
 * fuchsia / sky / purple / emerald — five hues spent restating what the icon
 * already says, on a screen that also has to carry five element hues.
 */
const SKILL_TYPE_ICON: Record<SkillTypeCategory, React.ElementType> = {
  attack: Sword,
  attackDebuff: Swords,
  buff: ArrowBigUp,
  debuff: ArrowBigDown,
  heal: Heart,
};

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

  const [previewCard, setPreviewCard] = React.useState<ActionCard | null>(null);
  const [draggedCardId, setDraggedCardId] = React.useState<string | null>(null);
  const previewShowTimerRef = React.useRef<number | null>(null);
  const previewHideTimerRef = React.useRef<number | null>(null);

  const canMergeCard = React.useCallback(
    (card: ActionCard): boolean => {
      if (card.rank >= 3) return false;
      return (
        deck.filter(
          (c) =>
            c.sourceInstanceId === card.sourceInstanceId &&
            c.skill.skillName === card.skill.skillName,
        ).length >= 2
      );
    },
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

      {/* Deck — always visible. Cards flex to fill the row width so the whole
          hand (up to 8 cards at 4v4) shows at once without scrolling, 7DSGC-
          style; hud-scroll stays as a safety net for any overflow edge case. */}
      <div className="hud-scroll flex w-full justify-center gap-1 overflow-x-auto border border-hairline bg-void/70 p-2">
        {deck.map((card) => {
          const char = playerTeam.find(
            (c) => c.instanceId === card.sourceInstanceId,
          );
          const isUlt = card.skill.type === "ultimate";
          const isStunned = char?.debuffs.some((d) => d.type === "stun");
          const isSealed =
            card.skill.type === "attack" &&
            char?.debuffs.some(
              (d) => d.type === "seal" && d.sealType === "attack",
            );
          // Enemy targeting is optional (unmarked = random at execution).
          // Single-target ally skills open the ally chooser on select, so no
          // pre-selection marker is needed here.
          const queueFull = slotsUsed >= actionCap;
          const frame = getCardFrameStyle(card.rank, isUlt);

          return (
            <Card
              key={card.id}
              onClick={() => isPlayerActionPhase && selectCard(card.id)}
              onMouseEnter={() => beginPreview(card)}
              onMouseLeave={endPreview}
              onFocus={() => beginPreview(card)}
              onBlur={endPreview}
              draggable={isPlayerActionPhase}
              onDragStart={() => {
                setDraggedCardId(card.id);
                beginPreview(card);
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!draggedCardId || draggedCardId === card.id) return;
                reorderDeckCard(draggedCardId, card.id);
                setDraggedCardId(null);
              }}
              onDragEnd={() => {
                setDraggedCardId(null);
              }}
              className={`
                relative flex h-32 min-w-0 max-w-24 flex-1 select-none flex-col overflow-hidden bg-panel p-0 transition-all
                ${frame.borderClass}
                ${isPlayerActionPhase ? "cursor-pointer hover:-translate-y-2 hover:shadow-lg" : "cursor-not-allowed opacity-50"}
                ${isStunned || isSealed ? "grayscale brightness-50" : ""}
                ${queueFull ? "opacity-70" : ""}
                ${draggedCardId === card.id ? "opacity-40" : ""}
                ${canMergeCard(card) && isPlayerActionPhase ? "ring-1 ring-signal/70" : ""}
              `}
            >
              {frame.accentBarClass ? (
                <span
                  className={`absolute inset-x-0 top-0 z-10 h-1 ${frame.accentBarClass}`}
                />
              ) : null}

              {/* Art fills the card; rank and skill-type ride on top of it, and
                  the name/power footer sits under it. The face used to carry
                  neither — you hovered for 260ms to find out what a card did,
                  which on touch meant you never found out at all. */}
              <div className="relative min-h-0 flex-1 overflow-hidden bg-inset">
                {(() => {
                  // Per-skill art when available; otherwise the character
                  // portrait (docs/design/SKILL_ART_PLAN.md).
                  const art = char
                    ? (getSkillArt(char.id, card.skill.skillName) ??
                      getCharacterArt(char.id))
                    : null;
                  return art ? (
                    <Image
                      src={art}
                      alt={char?.name ?? card.skill.skillName}
                      width={160}
                      height={160}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-heading text-3xl leading-none text-readout-strong">
                      {getCharacterInitial(char?.name)}
                    </span>
                  );
                })()}

                {/* Diamonds, not stars: stars read as rarity in every other
                    game on the phone, and these are merge tiers. */}
                <span className="absolute left-0 top-0 bg-void/80 px-1 py-px font-body text-[9px] font-bold leading-none tracking-[0.08em]">
                  {isUlt ? (
                    <span className="uppercase tracking-[0.12em] text-el-light">
                      Ult
                    </span>
                  ) : (
                    <span className="text-readout">
                      {getRankPips(card.rank)}
                    </span>
                  )}
                </span>

                {/* Monochrome: the five coloured badges spent five hues on a
                    fact the glyph already carries. */}
                {(() => {
                  const BadgeIcon =
                    SKILL_TYPE_ICON[skillTypeCategory(card.skill)];
                  return (
                    <span
                      title={skillTypeCategory(card.skill)}
                      className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center bg-void/80 text-readout-dim"
                    >
                      <BadgeIcon className="h-2.5 w-2.5" strokeWidth={2.6} />
                    </span>
                  );
                })()}
              </div>

              <div className="shrink-0 border-t border-hairline bg-inset px-1 py-0.5">
                <p className="truncate font-body text-[9px] font-semibold leading-tight text-readout-strong">
                  {card.skill.skillName}
                </p>
                <p className="truncate font-body text-[8px] font-bold leading-tight tabular-nums text-readout-muted">
                  {getSkillPowerText(card)}
                </p>
              </div>

              {canMergeCard(card) && isPlayerActionPhase && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    mergeDeckCard(card.id);
                  }}
                  className="absolute bottom-6 right-0.5 h-5 rounded-none border border-signal bg-void/85 px-1 text-[9px] uppercase tracking-[0.08em] text-signal hover:bg-signal/20"
                >
                  Merge
                </Button>
              )}

              {isStunned && (
                <div className="absolute inset-0 flex items-center justify-center bg-void/40 font-body text-[10px] font-bold uppercase tracking-widest text-readout-strong">
                  Stunned
                </div>
              )}
            </Card>
          );
        })}
      </div>

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

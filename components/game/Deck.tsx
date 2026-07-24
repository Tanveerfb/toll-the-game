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

function getRankStars(rank: 1 | 2 | 3): string {
  return `${"⭐".repeat(rank)}${"☆".repeat(3 - rank)}`;
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

const SKILL_TYPE_BADGE: Record<
  SkillTypeCategory,
  { Icon: React.ElementType; cls: string }
> = {
  attack: { Icon: Sword, cls: "bg-red-600 text-white" },
  attackDebuff: { Icon: Swords, cls: "bg-fuchsia-700 text-white" },
  buff: { Icon: ArrowBigUp, cls: "bg-sky-600 text-white" },
  debuff: { Icon: ArrowBigDown, cls: "bg-purple-700 text-white" },
  heal: { Icon: Heart, cls: "bg-emerald-600 text-white" },
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
      return "border-rose-400/80 bg-rose-950/25";
    case "blue":
      return "border-sky-400/80 bg-sky-950/25";
    case "green":
      return "border-emerald-400/80 bg-emerald-950/25";
    case "dark":
      return "border-violet-400/80 bg-violet-950/25";
    case "light":
    default:
      return "border-amber-300/80 bg-amber-950/20";
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
}: {
  units: BattleCharacter[];
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1">
      {units.map((unit) => (
        <span
          key={unit.instanceId}
          title={`${unit.name} — ${Math.max(0, unit.currentHP)}/${unit.hp} HP`}
          className={`h-2 w-2 rounded-full border border-black/40 ${ELEMENT_SWATCH[unit.color]} ${
            unit.currentHP <= 0
              ? "opacity-25 grayscale"
              : unit.isSub
                ? "opacity-50"
                : "opacity-100"
          }`}
        />
      ))}
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

  const slotsUsed = actionQueue.length + queuedNullCount;

  const isPlayerActionPhase = battlePhase === "PlayerAction";

  // Auto-execute when the queue reaches its maximum size (3 actions), and
  // auto-pass when there are no cards left to play (e.g. the whole field
  // died and a sub is waiting for the next turn to enter).
  const { resolveplayerTurnWrapper } = useBattleContext();
  React.useEffect(() => {
    if (!isPlayerActionPhase) return;
    // All three slots filled (real actions + passes), or no cards left to play.
    if (slotsUsed === 3 || deck.length === 0) {
      resolveplayerTurnWrapper();
    }
  }, [
    slotsUsed,
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
      className={`bighit-recede relative z-30 w-full shrink-0 border-t border-zinc-800 bg-linear-to-t from-black/95 to-black/70 px-3 pb-2 pt-1.5 backdrop-blur-md transition-[opacity,transform] duration-300 ${bigHitFocus ? "scale-[0.98] opacity-60" : "scale-100 opacity-100"}`}
    >
      {previewCard ? (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-3 w-full max-w-xl -translate-x-1/2">
          <Card className="w-full rounded-none border border-zinc-700 bg-zinc-950/95 ring-0">
            <CardHeader className="border-b border-zinc-800 px-4 py-3">
              <div className="flex w-full items-start justify-between gap-3">
                <div>
                  <CardTitle className="font-heading text-xl tracking-[0.08em] text-zinc-100">
                    {previewCard.skill.skillName}
                  </CardTitle>
                  <CardDescription className="font-body text-xs uppercase tracking-[0.12em] text-zinc-400">
                    {previewCard.skill.type} • Rank {previewCard.rank} •{" "}
                    {getSkillPowerText(previewCard)}
                  </CardDescription>
                </div>
                <span className="rounded border border-amber-300/70 bg-amber-400/15 px-2 py-0.5 font-body text-xs uppercase tracking-[0.12em] text-amber-100">
                  R{previewCard.rank}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 py-3">
              <p className="font-body text-sm text-zinc-200">
                <KeyworkHighlighter
                  text={previewDescription}
                  className="font-body text-sm text-zinc-200"
                  glossary={previewGlossary}
                  keywordClassName="inline-flex cursor-help items-center rounded-none border border-white/70 bg-transparent px-1 py-[1px] font-body text-xs uppercase tracking-[0.06em] text-zinc-100"
                />
              </p>

              {previewKeywordDefinitions.length > 0 ? (
                <>
                  <div className="my-3 border-t border-zinc-700" />
                  <div className="space-y-1">
                    {previewKeywordDefinitions.map((entry) => (
                      <p
                        key={entry.keyword}
                        className="font-body text-xs text-zinc-400"
                      >
                        <span className="mr-1 text-zinc-500">※</span>
                        <span className="font-semibold text-sky-300">
                          {formatFootnoteLabel(entry.keyword)}
                        </span>
                        <span className="text-zinc-300"> — {entry.meaning}</span>
                      </p>
                    ))}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Queue chips + controls — always visible */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="hud-scroll flex min-w-0 items-center gap-1.5 overflow-x-auto">
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
                className={`flex h-9 min-w-0 max-w-44 shrink-0 cursor-pointer items-center gap-1.5 border px-1.5 transition-colors ${getColorTokenClasses(char?.color)} ${isUlt ? "ring-1 ring-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.45)]" : ""}`}
              >
                {char && getCharacterArt(char.id) ? (
                  <Image
                    src={getCharacterArt(char.id)!}
                    alt={char.name}
                    width={48}
                    height={48}
                    className="h-6 w-6 shrink-0 border border-zinc-700 object-cover object-top"
                  />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-zinc-700 font-heading text-sm text-white/90">
                    {getCharacterInitial(char?.name)}
                  </span>
                )}
                <span className="flex min-w-0 flex-col text-left leading-tight">
                  <span className="truncate text-[10px] font-bold text-zinc-100">
                    {char?.name}
                  </span>
                  <span
                    className={`truncate text-[9px] ${isUlt ? "text-amber-300" : "text-zinc-300"}`}
                  >
                    {isUlt ? "ULT" : getRankStars(card.rank)} •{" "}
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
              className="flex h-9 w-14 shrink-0 items-center justify-center border border-zinc-600 bg-zinc-800/60 font-body text-[9px] uppercase tracking-widest text-zinc-400 transition-colors hover:border-rose-400/70 hover:text-rose-200"
            >
              Pass
            </button>
          ))}
          {/* Empty slots — tap to pass */}
          {Array.from({ length: Math.max(0, 3 - slotsUsed) }).map((_, i) => (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={() => isPlayerActionPhase && addNullAction()}
              disabled={!isPlayerActionPhase}
              title="Tap to pass this action"
              className="flex h-9 w-14 shrink-0 items-center justify-center border border-dashed border-zinc-700 font-body text-[10px] text-zinc-600 transition-colors enabled:hover:border-zinc-500 enabled:hover:text-zinc-400 disabled:cursor-not-allowed"
            >
              {slotsUsed + i + 1}
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            disabled={!isPlayerActionPhase || !handSnapshot}
            onClick={resetHand}
            className="shrink-0 border border-amber-300/60 rounded-none px-2 text-[11px] uppercase tracking-widest text-amber-200 disabled:border-zinc-800 disabled:text-zinc-600"
          >
            Reset Hand
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!isPlayerActionPhase || actionQueue.length === 0}
            onClick={resolveplayerTurnWrapper}
            className="shrink-0 rounded-none border border-emerald-400/60 px-2 text-[11px] uppercase tracking-widest text-emerald-200 disabled:border-zinc-800 disabled:text-zinc-600"
          >
            End Turn
          </Button>
        </div>
      </div>

      {/* Deck — always visible. Cards flex to fill the row width so the whole
          hand (up to 8 cards at 4v4) shows at once without scrolling, 7DSGC-
          style; hud-scroll stays as a safety net for any overflow edge case. */}
      <div className="hud-scroll flex w-full justify-center gap-1 overflow-x-auto border border-zinc-800 bg-black/60 p-2">
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
          const queueFull = slotsUsed >= 3;
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
                h-28 relative min-w-0 flex-1 max-w-20 select-none flex flex-col overflow-hidden bg-zinc-900/80 p-1 transition-all
                ${frame.borderClass}
                ${isPlayerActionPhase ? "cursor-pointer hover:-translate-y-2 hover:shadow-lg" : "cursor-not-allowed opacity-50"}
                ${isStunned || isSealed ? "grayscale brightness-50" : ""}
                ${queueFull ? "opacity-70" : ""}
                ${draggedCardId === card.id ? "opacity-40" : ""}
              `}
            >
              {frame.accentBarClass ? (
                <span
                  className={`absolute inset-x-0 top-0 h-1 ${frame.accentBarClass}`}
                />
              ) : null}
              {/* 7DSGC-style card, top -> bottom:
                  1. one row: rank stars / ULT badge and the skill-type icon,
                     spaced apart (justify-around)
                  2. skill artwork (defaults to character art until per-skill
                     art is generated via ComfyUI). */}
              {(() => {
                const badge = SKILL_TYPE_BADGE[skillTypeCategory(card.skill)];
                const BadgeIcon = badge.Icon;
                return (
                  <div className="flex items-center justify-around gap-1">
                    <span className="text-[11px] leading-none tracking-tight">
                      {isUlt ? (
                        <span className="font-bold text-[9px] uppercase tracking-widest text-cyan-300">
                          ULT
                        </span>
                      ) : (
                        <span className="text-zinc-100">
                          {getRankStars(card.rank)}
                        </span>
                      )}
                    </span>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${badge.cls}`}
                    >
                      <BadgeIcon className="h-2.5 w-2.5" strokeWidth={2.6} />
                    </span>
                  </div>
                );
              })()}
              <div className="relative mt-0.5 flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                {(() => {
                  // Per-skill art when available; otherwise the character
                  // portrait (docs/design/SKILL_ART_PLAN.md).
                  const art = char
                    ? getSkillArt(char.id, card.skill.skillName) ??
                      getCharacterArt(char.id)
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
                  <span className="text-center font-heading text-3xl leading-none text-white/90 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                    {getCharacterInitial(char?.name)}
                  </span>
                );
                })()}
              </div>

              {canMergeCard(card) && isPlayerActionPhase && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    mergeDeckCard(card.id);
                  }}
                  className="absolute bottom-1 right-1 h-5 rounded border border-sky-300/70 bg-sky-900/70 px-1 text-[9px] uppercase tracking-[0.08em] text-sky-100 hover:bg-sky-800/70"
                >
                  Merge
                </Button>
              )}

              {isStunned && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-[10px] font-bold text-white uppercase tracking-widest rounded-xl">
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
        <TeamBarDots units={playerTeam} />
        <span className="font-body text-[9px] uppercase tracking-[0.2em] text-zinc-600">
          vs
        </span>
        <TeamBarDots units={enemyTeam} />
      </div>
    </div>
  );
}

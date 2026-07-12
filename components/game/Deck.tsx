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

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatKeywordLabel(keyword: string): string {
  return keyword
    .split(" ")
    .map((chunk) => (chunk ? chunk[0].toUpperCase() + chunk.slice(1) : chunk))
    .join(" ");
}

function getKeywordDefinitions(
  description: string,
  glossary: Record<string, string> = mechanicGlossary,
): Array<{ keyword: string; meaning: string }> {
  const lowerDescription = description.toLowerCase();
  const matches = Object.entries(glossary)
    .map(([keyword, meaning]) => {
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
      const isMatched = regex.test(description);
      const position = lowerDescription.indexOf(keyword.toLowerCase());
      return {
        keyword,
        meaning,
        isMatched,
        position,
      };
    })
    .filter((entry) => entry.isMatched)
    .sort((a, b) => a.position - b.position);

  const deduped: Array<{ keyword: string; meaning: string }> = [];
  const seen = new Set<string>();

  for (const entry of matches) {
    const normalized = entry.keyword.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push({ keyword: entry.keyword, meaning: entry.meaning });
  }

  return deduped;
}

function getSkillPowerText(card: ActionCard): string {
  if (card.skill.type === "ultimate") {
    return `Power ${card.skill.damage}`;
  }
  return `Power ${card.skill.damageRanked[card.rank - 1]}`;
}

function getRankStars(rank: 1 | 2 | 3): string {
  return `${"⭐".repeat(rank)}${"☆".repeat(3 - rank)}`;
}

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
    handSnapshot,
    queuedNullCount,
    addNullAction,
    removeNullAction,
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
    () => getKeywordDefinitions(previewDescription, previewGlossary),
    [previewDescription, previewGlossary],
  );

  return (
    <div className="relative z-30 w-full shrink-0 border-t border-zinc-800 bg-linear-to-t from-black/95 to-black/70 px-3 pb-2 pt-1.5 backdrop-blur-md">
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
                        className="font-body text-xs text-zinc-300"
                      >
                        <span className="mr-1 inline-flex items-center rounded-none border border-white/70 px-1 py-px font-body text-[10px] uppercase tracking-[0.08em] text-zinc-100">
                          {formatKeywordLabel(entry.keyword)}
                        </span>
                        - {entry.meaning}
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
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 font-body text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            Queue
          </span>
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

        <span className="shrink-0 font-body text-[11px] uppercase tracking-[0.12em] text-zinc-500">
          {isPlayerActionPhase ? "Your turn" : "Waiting…"} •{" "}
          {slotsUsed}/3 queued
        </span>
      </div>

      {/* Deck — always visible */}
      <div className="flex w-full gap-2 overflow-x-auto border border-zinc-800 bg-black/60 p-2">
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
          const colorTokenClass = getColorTokenClasses(char?.color);

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
                h-32.5 w-22.5! relative shrink-0 select-none flex flex-col p-2 transition-all
                ${colorTokenClass}
                ${isUlt ? "ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.55)]" : ""}
                ${isPlayerActionPhase ? "cursor-pointer hover:-translate-y-2 hover:shadow-lg" : "cursor-not-allowed opacity-50"}
                ${isStunned || isSealed ? "grayscale brightness-50" : ""}
                ${queueFull ? "opacity-70" : ""}
                ${draggedCardId === card.id ? "opacity-40" : ""}
                border
              `}
            >
              <div className="mb-1 flex items-start justify-between gap-1">
                <div className="font-bold text-[10px] text-zinc-100 truncate">
                  {char?.name}
                </div>
                <div className="text-[11px] leading-none tracking-tight">
                  {isUlt ? (
                    <span className="font-bold text-[9px] uppercase tracking-widest text-amber-300">
                      ULT
                    </span>
                  ) : (
                    <span className="text-zinc-100">
                      {getRankStars(card.rank)}
                    </span>
                  )}
                </div>
              </div>
              <div className="relative my-auto flex flex-1 items-center justify-center overflow-hidden">
                {char && getCharacterArt(char.id) ? (
                  <Image
                    src={getCharacterArt(char.id)!}
                    alt={char.name}
                    width={160}
                    height={160}
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <span className="text-center font-heading text-3xl leading-none text-white/90 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                    {getCharacterInitial(char?.name)}
                  </span>
                )}
              </div>
              <div
                className={`text-[10px] mt-auto font-medium ${isUlt ? "text-amber-400" : "text-white"}`}
              >
                {card.skill.skillName}
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
    </div>
  );
}

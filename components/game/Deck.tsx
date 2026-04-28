"use client";

import React from "react";
import { useGameStore } from "@/store/gameStore";
import { Button, Card } from "@heroui/react";
import { useBattleContext } from "@/hooks/BattleProvider";
import type { ActionCard } from "@/types/action";
import KeyworkHighlighter from "@/components/ui/KeyworkHighlighter";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";
import { buildDescriptionForRank } from "@/lib/game/descriptionTranslator";
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
): Array<{ keyword: string; meaning: string }> {
  const lowerDescription = description.toLowerCase();
  const matches = Object.entries(mechanicGlossary)
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
    selectedEnemyMarker,
    battlePhase,
    mergeDeckCard,
    reorderDeckCard,
    initializeDeck,
  } = useGameStore();

  const isPlayerActionPhase = battlePhase === "PlayerAction";

  // Auto‑execute when the queue reaches its maximum size (3 actions).
  const { resolveplayerTurnWrapper } = useBattleContext();
  React.useEffect(() => {
    if (actionQueue.length === 3 && isPlayerActionPhase) {
      resolveplayerTurnWrapper();
    }
  }, [actionQueue.length, isPlayerActionPhase, resolveplayerTurnWrapper]);

  const [previewCard, setPreviewCard] = React.useState<ActionCard | null>(null);
  const [draggedCardId, setDraggedCardId] = React.useState<string | null>(null);
  const [isDockExpanded, setIsDockExpanded] = React.useState(false);
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

  const previewKeywordDefinitions = React.useMemo(
    () => getKeywordDefinitions(previewDescription),
    [previewDescription],
  );

  return (
    <div className="sticky bottom-0 z-30 mt-4 w-full border-t border-zinc-800 bg-linear-to-t from-black/95 to-black/60 p-4 backdrop-blur-md">
      {previewCard ? (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-3 w-full max-w-xl -translate-x-1/2">
          <Card
            variant="secondary"
            className="w-full rounded-none border border-zinc-700 bg-zinc-950/95"
          >
            <Card.Header className="border-b border-zinc-800 px-4 py-3">
              <div className="flex w-full items-start justify-between gap-3">
                <div>
                  <Card.Title className="font-heading text-xl tracking-[0.08em] text-zinc-100">
                    {previewCard.skill.skillName}
                  </Card.Title>
                  <Card.Description className="font-body text-xs uppercase tracking-[0.12em] text-zinc-400">
                    {previewCard.skill.type} • Rank {previewCard.rank} •{" "}
                    {getSkillPowerText(previewCard)}
                  </Card.Description>
                </div>
                <span className="rounded border border-amber-300/70 bg-amber-400/15 px-2 py-0.5 font-body text-xs uppercase tracking-[0.12em] text-amber-100">
                  R{previewCard.rank}
                </span>
              </div>
            </Card.Header>
            <Card.Content className="px-4 py-3">
              <p className="font-body text-sm text-zinc-200">
                <KeyworkHighlighter
                  text={previewDescription}
                  className="font-body text-sm text-zinc-200"
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
            </Card.Content>
          </Card>
        </div>
      ) : null}

      {/* Action Queue */}
      {isDockExpanded ? (
        <div className="mb-3 flex min-h-30 gap-3 overflow-x-auto pb-1">
          {actionQueue.map((card, i) => {
            const char = playerTeam.find(
              (c) => c.instanceId === card.sourceInstanceId,
            );
            const isUlt = card.skill.type === "ultimate";
            return (
              <Card
                key={card.id}
                onClick={() => isPlayerActionPhase && deselectCard(card.id)}
                onMouseEnter={() => beginPreview(card)}
                onMouseLeave={endPreview}
                onFocus={() => beginPreview(card)}
                onBlur={endPreview}
                className={`h-35 w-25 shrink-0 -translate-y-1 cursor-pointer select-none flex flex-col border-2 p-2 transition-transform ${getColorTokenClasses(char?.color)} ${isUlt ? "ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.55)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="text-[10px] text-zinc-300">
                    Action {i + 1}
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
                <div className="font-bold text-[12px] mt-1 text-white truncate">
                  {char?.name}
                </div>
                <div className="my-auto text-center font-heading text-3xl leading-none text-white/90 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                  {getCharacterInitial(char?.name)}
                </div>
                <div
                  className={`text-[11px] mt-auto font-semibold ${card.skill.type === "ultimate" ? "text-amber-400" : "text-zinc-200"}`}
                >
                  {card.skill.skillName}
                </div>
              </Card>
            );
          })}
          {/* Placeholder for remaining actions */}
          {Array.from({ length: Math.max(0, 3 - actionQueue.length) }).map(
            (_, i) => (
              <div
                key={`empty-${i}`}
                className="h-35 w-25 shrink-0 flex items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 font-bold text-zinc-700"
              >
                {actionQueue.length + i + 1}
              </div>
            ),
          )}
        </div>
      ) : null}

      <div className="mb-2 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onPress={() => setIsDockExpanded((prev) => !prev)}
          className="border border-zinc-700 rounded-none px-2 text-[11px] uppercase tracking-widest text-zinc-300"
        >
          {isDockExpanded ? "Collapse Deck" : "Expand Deck"}
        </Button>

        <Button
          variant="secondary"
          onPress={initializeDeck}
          isDisabled={!isPlayerActionPhase}
        >
          Reset Deck
        </Button>
      </div>
      {!isDockExpanded ? (
        <div className="flex w-full items-center justify-between gap-2 border border-zinc-800 bg-black/65 px-3 py-2 font-body text-xs uppercase tracking-[0.12em] text-zinc-400">
          <span>Deck hidden to keep arena clear</span>
          <span>
            Queue {actionQueue.length}/3 • {deck.length} cards ready
          </span>
        </div>
      ) : null}

      {/* Main Deck Dock */}
      <div
        className={`${isDockExpanded ? "flex" : "hidden"} w-full gap-2 overflow-x-auto border border-zinc-800 bg-black/80 p-3 shadow-2xl`}
      >
        {deck.map((card) => {
          const char = playerTeam.find(
            (c) => c.instanceId === card.sourceInstanceId,
          );
          const isUlt = card.skill.type === "ultimate";
          const isStunned = char?.debuffs.some((d) => d.type === "stun");
          const requiresEnemyTarget = [
            "attack",
            "debuff",
            "disable",
            "ultimate",
          ].includes(card.skill.type);
          const missingTarget = requiresEnemyTarget && !selectedEnemyMarker;
          const queueFull = actionQueue.length >= 3;
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
                ${isStunned ? "grayscale brightness-50" : ""}
                ${missingTarget ? "ring-1 ring-red-400/70" : ""}
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
              <div className="my-auto text-center font-heading text-3xl leading-none text-white/90 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                {getCharacterInitial(char?.name)}
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
                  onPress={() => {
                    mergeDeckCard(card.id);
                  }}
                  className="absolute bottom-1 right-1 h-5 rounded border border-sky-300/70 bg-sky-900/70 px-1 text-[9px] uppercase tracking-[0.08em] text-sky-100"
                >
                  Merge
                </Button>
              )}

              {missingTarget && isPlayerActionPhase && !isStunned && (
                <div className="absolute left-1 right-1 top-1 rounded border border-red-400/60 bg-red-900/50 px-1 py-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-red-100">
                  Pick Target
                </div>
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

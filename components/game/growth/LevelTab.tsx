"use client";

import React from "react";

import { GROWTH } from "@/components/game/growth/growthStyle";
import { Alert } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ItemIcon from "@/components/game/ItemIcon";
import CostChip from "@/components/game/growth/CostChip";
import StatDelta from "@/components/game/growth/StatDelta";
import { usePlayerStore, progressFromMap } from "@/store/playerStore";
import {
  MANUAL_TIER_LABELS,
  XP_PER_MANUAL_TIER,
  highestReachableLevel,
  levelTargets,
  planLevelUp,
  xpToNext,
  type ManualSpend,
  type ManualTier,
} from "@/lib/game/leveling";
import { maxLevelForAscension } from "@/lib/game/ascension";
import { progressedStats } from "@/lib/game/progression";
import type { CharacterData } from "@/lib/game/characterCatalog";

/** How close a plan's coin cost has to sit to the purse to blame the purse. */
const COIN_SLACK = 1;

const TIERS: ManualTier[] = [
  "training_manual",
  "training_manual_advanced",
  "training_manual_premium",
];

/**
 * Levelling, as **option C** of `docs/design/mockups/growth-modal.html` —
 * targets on top, stacks underneath, nothing hidden.
 *
 * It replaced one manual per tap: reaching Lv 20 cost **190 presses** on basic
 * manuals, and Lv 20 is what the First Ascension Trial asks for. He picked this
 * option over target-only and spend-only because *"it offers the best of both
 * worlds"* — and over spend-only in particular because a default that dumps a
 * stack serves one play style: *"a lot of people play it conservatively"*
 * (ruling #145).
 */
export default function LevelTab({
  character,
}: {
  character: CharacterData;
}): React.JSX.Element {
  // Selectors, not `usePlayerStore()`. The old panel subscribed to the whole
  // store twice, so every unrelated write re-rendered it — 2 of the app's 3
  // whole-store subscriptions were in that one file, against 88 selectors
  // everywhere else (audit 2026-09-17).
  const characters = usePlayerStore((s) => s.characters);
  const inventory = usePlayerStore((s) => s.inventory);
  const coin = usePlayerStore((s) => s.currencies.coin);
  const levelCharacterTo = usePlayerStore((s) => s.levelCharacterTo);

  const progress = progressFromMap(characters, character.id);
  const maxLevel = maxLevelForAscension(progress.ascension);
  const atCap = progress.level >= maxLevel;

  const reachable = highestReachableLevel(progress, maxLevel, inventory, coin);
  const [target, setTarget] = React.useState<number | null>(null);
  const [pinned, setPinned] = React.useState<ManualSpend>({});

  // Derived, never stored: the reachable ceiling moves as coins and manuals are
  // spent, and a stale target would offer a climb that no longer works. Same
  // rule the ultimate control has always followed.
  const goal = Math.min(Math.max(target ?? reachable, progress.level + 1), maxLevel);
  const plan = planLevelUp(progress, maxLevel, goal, inventory, coin, pinned);

  const after = plan
    ? progressedStats(character, { level: plan.level, ascension: progress.ascension })
    : null;
  const before = progressedStats(character, {
    level: progress.level,
    ascension: progress.ascension,
  });

  if (atCap) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className={GROWTH.big}>
            Lv {progress.level}
            <span className={GROWTH.quiet}> / {maxLevel} cap</span>
          </span>
        </div>
        <Alert variant="info">
          Max level for ascension {progress.ascension}. Ascend to raise the cap.
        </Alert>
      </div>
    );
  }

  // One chip per destination. The presets all clamp to the cap, so near the
  // top they collide - "+5" and "Cap" were both Lv 20 at Lv 18 - and the
  // "lands somewhere the others don't" rule now covers every chip, not just
  // "All I own". See `levelTargets`.
  const targets = levelTargets(progress.level, maxLevel, reachable);

  const xpNeeded = xpToNext(progress.level);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className={GROWTH.big}>
          Lv {progress.level}
          {plan && plan.level > progress.level ? (
            <>
              <span className={GROWTH.quiet}> → </span>
              <span className={GROWTH.gain}>{plan.level}</span>
            </>
          ) : null}
          <span className={GROWTH.quiet}> / {maxLevel} cap</span>
        </span>
        <span className={`${GROWTH.label} tabular-nums`}>
          XP {progress.xp} / {xpNeeded}
        </span>
      </div>
      <Progress value={(progress.xp / xpNeeded) * 100} />

      <p className={`mt-1 ${GROWTH.label}`}>Raise to</p>
      {/* One destination out of several: the shadcn toggle group
          (ruling #154), not a hand-built row of buttons. */}
      <ToggleGroup
        type="single"
        variant="outline"
        value={String(goal)}
        onValueChange={(value) => {
          if (!value) return;
          setTarget(Number(value));
          setPinned({});
        }}
        className="w-full flex-wrap"
        aria-label="Raise to"
      >
        {targets.map((t) => (
          <ToggleGroupItem
            key={t.level}
            value={String(t.level)}
            className="flex-1 flex-col gap-0 px-2.5 py-1"
          >
            <span className="font-heading text-base leading-none tracking-title">
              {t.label}
            </span>
            <span className="font-body text-label font-bold uppercase tracking-label">
              {t.sub}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <p className={`mt-1.5 ${GROWTH.label}`}>Spends</p>
      <div className="flex flex-col gap-1">
        {TIERS.map((tier) => {
          const held = inventory[tier] ?? 0;
          const using = plan?.spend[tier] ?? 0;
          const isPinned = pinned[tier] !== undefined;
          return (
            <div
              key={tier}
              className="grid min-h-11 grid-cols-[1.75rem_1fr_auto_auto] items-center gap-2 border border-rule bg-muted px-2 py-1.5"
            >
              <ItemIcon id={tier} size={24} alt="" />
              <span className="min-w-0">
                <span className="block truncate font-body text-xs">
                  {MANUAL_TIER_LABELS[tier]}
                </span>
                <span className={`block ${GROWTH.label}`}>
                  {XP_PER_MANUAL_TIER[tier]} xp
                </span>
              </span>
              <span className="font-body text-sm font-bold tabular-nums">
                {using} / {held}
              </span>
              <Button
                variant={isPinned ? "secondary" : "outline"}
                size="xs"
                disabled={held < 1}
                onClick={() =>
                  setPinned((prev) => {
                    const next = { ...prev };
                    if (isPinned) delete next[tier];
                    else next[tier] = held;
                    return next;
                  })
                }
              >
                {isPinned ? "Pinned" : "Use all"}
              </Button>
            </div>
          );
        })}
      </div>
      <p className={GROWTH.hint}>
        Auto spends the cheapest manuals first and keeps the rare ones.{" "}
        <b className="text-card-foreground">Use all</b> pins a stack and the rest
        re-solve around it.
      </p>

      {plan ? (
        <>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <CostChip id="coin" label="Coin" cost={plan.coinCost} owned={coin} />
          </div>
          {!plan.reachesTarget ? (
            <Alert variant="destructive">
              {plan.coinCost >= coin - COIN_SLACK
                ? "Coin is what stops you here, not manuals."
                : "Not enough manuals to reach that level."}
            </Alert>
          ) : null}
          {after ? <StatDelta from={before} to={after} /> : null}
          <Button
            className="mt-1"
            onClick={() => {
              if (levelCharacterTo(character.id, goal, pinned)) {
                setTarget(null);
                setPinned({});
              }
            }}
          >
            {plan.level > progress.level
              ? `Raise to Lv ${plan.level} — ${plan.coinCost.toLocaleString()} coin`
              : "Nothing to spend"}
          </Button>
        </>
      ) : (
        <Alert className="mt-1">
          No manuals to feed — they drop from the world boss and from summon
          misses.
        </Alert>
      )}
    </div>
  );
}

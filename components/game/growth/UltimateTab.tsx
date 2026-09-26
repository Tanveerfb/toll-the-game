"use client";

import React from "react";

import { GROWTH } from "@/components/game/growth/growthStyle";

import { Button } from "@/components/ui/button";
import CostChip from "@/components/game/growth/CostChip";
import { usePlayerStore, progressFromMap } from "@/store/playerStore";
import { characterCoinId, materialLabel } from "@/lib/game/materials";
import { MAX_ULT_LEVEL, ultLevelCoinCost } from "@/lib/gacha/dupes";
import type { CharacterData } from "@/lib/game/characterCatalog";

/**
 * Ultimate levels — **the ladder is the control**.
 *
 * This had a slider. His verdict on it: *"the ultimate slider isn't really the
 * best one… it was better than before, but it's not the best thing."* The
 * reason it never felt right is that one decision had **three** controls: a
 * ladder showing what each level is worth, a slider picking a number, and a
 * readout repeating the number the slider already showed.
 *
 * The ladder was always the good part — it is the only thing on screen that
 * says what you are buying — so the ladder became the control and the other two
 * went. Tapping a step sets the target; the button pays for it.
 *
 * Approved from `docs/design/mockups/growth-modal.html`: *"the slider is gone,
 * which is very good… it also shows you where the multiplier goes, for example
 * 385% to 475%, which I like."*
 */
export default function UltimateTab({
  character,
}: {
  character: CharacterData;
}): React.JSX.Element | null {
  const characters = usePlayerStore((s) => s.characters);
  const inventory = usePlayerStore((s) => s.inventory);
  const levelUpUltimate = usePlayerStore((s) => s.levelUpUltimate);

  const progress = progressFromMap(characters, character.id);
  const current = progress.ultLevel;
  const coinId = characterCoinId(character);
  const held = inventory[coinId] ?? 0;
  const ceiling = Math.min(MAX_ULT_LEVEL, current + held);
  const ladder = character.ultimate?.damageByUltLevel;

  const [target, setTarget] = React.useState<number | null>(null);
  // Derived, never stored — the ceiling moves as coins are spent or pulled.
  const goal = Math.min(Math.max(target ?? current, current), ceiling);
  const cost = ultLevelCoinCost(current, goal);

  if (!character.ultimate) return null;

  const maxed = current >= MAX_ULT_LEVEL;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className={GROWTH.big}>
          UL {current}
          {goal > current ? (
            <>
              <span className={GROWTH.quiet}> → </span>
              <span className={GROWTH.gain}>{goal}</span>
            </>
          ) : null}
          <span className={GROWTH.quiet}> / {MAX_ULT_LEVEL}</span>
        </span>
        <span className={GROWTH.label}>
          {materialLabel(coinId)} · {held} held
        </span>
      </div>

      {ladder ? (
        <>
          <p className={`mt-1 ${GROWTH.label}`}>
            {maxed ? "The ladder" : "Tap where to stop"}
          </p>
          <div className="flex flex-wrap gap-1">
            {ladder.map((value, index) => {
              const level = index + 1;
              const isNow = level === current;
              const isBuying = level > current && level <= goal;
              const reachable = level <= ceiling;
              return (
                <button
                  key={level}
                  type="button"
                  disabled={maxed || level <= current || !reachable}
                  onClick={() => setTarget(level)}
                  className={`${GROWTH.tile} transition-colors ${
                    isNow ? GROWTH.tileNow : isBuying ? GROWTH.tileNext : GROWTH.tileIdle
                  } ${!reachable && !isNow ? "opacity-40" : ""}`}
                >
                  <span className={GROWTH.tileLabel}>
                    UL{level}
                    {isNow ? " · now" : ""}
                  </span>
                  <span className={GROWTH.tileValue}>
                    {value}%
                  </span>
                </button>
              );
            })}
          </div>
          <p className={GROWTH.hint}>
            {maxed
              ? "Maxed — further copies bank as coins."
              : ceiling <= current
                ? "Dimmed steps need more coins. A duplicate summon pays one."
                : "Dimmed steps are past what your coins reach."}
          </p>
        </>
      ) : null}

      {!maxed && goal > current ? (
        <>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <CostChip
              id={coinId}
              label={materialLabel(coinId)}
              cost={cost}
              owned={held}
            />
          </div>
          {ladder ? (
            <div className="mt-2.5 border border-rule bg-muted px-2.5 py-2">
              <div className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-2 font-body text-sm tabular-nums">
                <span className={GROWTH.label}>ULT</span>
                <span className="text-muted-foreground">
                  {ladder[current - 1]}% →
                </span>
                <span className={`font-bold ${GROWTH.gain}`}>
                  {ladder[goal - 1]}%
                </span>
              </div>
            </div>
          ) : null}
          <Button
            className="mt-1"
            disabled={cost === 0 || held < cost}
            onClick={() => {
              if (levelUpUltimate(character.id, goal)) setTarget(null);
            }}
          >
            {`Raise to UL ${goal} — ${cost} coin${cost === 1 ? "" : "s"}`}
          </Button>
        </>
      ) : null}
    </div>
  );
}

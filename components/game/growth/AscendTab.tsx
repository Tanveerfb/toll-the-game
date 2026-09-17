"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import CostChip from "@/components/game/growth/CostChip";
import StatDelta from "@/components/game/growth/StatDelta";
import { usePlayerStore, progressFromMap } from "@/store/playerStore";
import { materialLabel } from "@/lib/game/materials";
import {
  ascensionBlocker,
  ascensionLevelRequirement,
  getAscensionCost,
  maxLevelForAscension,
} from "@/lib/game/ascension";
import { ASCENSION_BANDS, progressedStats } from "@/lib/game/progression";
import type { CharacterData } from "@/lib/game/characterCatalog";

/**
 * Ascension — the same skeleton as its neighbours.
 *
 * Structurally this was already the soundest of the three sections; it just
 * said things in a different order from the others and never showed what the
 * spend bought. Now it has the same four slots as every other tab: **where you
 * are · what it costs · what you get · one button**, and it borrows the
 * Ultimate tab's ladder to show the level cap each tier unlocks.
 */
export default function AscendTab({
  character,
}: {
  character: CharacterData;
}): React.JSX.Element {
  const characters = usePlayerStore((s) => s.characters);
  const inventory = usePlayerStore((s) => s.inventory);
  const coin = usePlayerStore((s) => s.currencies.coin);
  const ascendCharacter = usePlayerStore((s) => s.ascendCharacter);

  const progress = progressFromMap(characters, character.id);
  const next = progress.ascension + 1;
  const cost = getAscensionCost(next);
  // The same function the store calls, so an enabled button can never mean
  // something different from what `ascendCharacter` will actually do.
  const blocker = ascensionBlocker(progress, inventory, coin);
  const levelNeeded = ascensionLevelRequirement(next);

  const before = progressedStats(character, {
    level: progress.level,
    ascension: progress.ascension,
  });
  const after = progressedStats(character, {
    level: progress.level,
    ascension: next,
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-heading text-2xl tracking-title text-readout-strong">
          A{progress.ascension}
          {cost ? (
            <>
              <span className="font-body text-sm text-readout-muted"> → </span>
              <span className="text-role-heal">A{next}</span>
            </>
          ) : null}
        </span>
        <span className="font-body text-[10px] font-bold uppercase tracking-label text-readout-muted">
          Cap {maxLevelForAscension(progress.ascension)}
          {cost ? (
            <>
              {" → "}
              <b className="text-role-heal">{maxLevelForAscension(next)}</b>
            </>
          ) : null}
        </span>
      </div>

      {/* The Ultimate tab's ladder, carrying the level cap each tier unlocks. */}
      <div className="mt-1 flex flex-wrap gap-1">
        {Array.from({ length: ASCENSION_BANDS }, (_, index) => index).map((tier) => {
          const isNow = tier === progress.ascension;
          const isNext = tier === next;
          // A tier is real only if it is costed. `maxLevelForAscension`
          // CLAMPS an unknown band to 40, so rendering it raw drew "A3 40,
          // A4 40, A5 40" - three tiers claiming one cap, which reads as
          // "these exist and do nothing". `ascension.ts` says a lookup miss
          // is meant to be a "not costed yet" signal; this honours that
          // instead of printing the clamp (browser check, 2026-09-17).
          const costed = tier === 0 || getAscensionCost(tier) !== null;
          return (
            <span
              key={tier}
              className={`flex min-h-11 flex-1 shrink-0 flex-col items-center justify-center border px-1.5 py-1 ${
                isNow
                  ? "border-signal bg-signal/14"
                  : isNext
                    ? "border-role-heal/60 bg-role-heal/8"
                    : "border-edge bg-inset"
              } ${!costed && !isNow && !isNext ? "opacity-40" : ""}`}
            >
              <span
                className={`font-body text-[9px] font-bold uppercase tracking-label ${
                  isNow ? "text-signal" : isNext ? "text-role-heal" : "text-readout-muted"
                }`}
              >
                A{tier}
                {isNow ? " · now" : ""}
              </span>
              <span
                className={`font-heading text-[15px] leading-none tracking-title ${
                  isNow ? "text-signal" : isNext ? "text-role-heal" : "text-readout-dim"
                }`}
              >
                {costed ? maxLevelForAscension(tier) : "—"}
              </span>
            </span>
          );
        })}
      </div>
      <p className="font-body text-[11px] leading-snug text-readout-muted">
        Each tier raises the level cap. Dimmed tiers are not costed yet.
      </p>

      {cost ? (
        <>
          <p className="mt-1 font-body text-[10px] font-bold uppercase tracking-label text-readout-muted">
            Costs
          </p>
          <div className="flex flex-wrap gap-1.5">
            <CostChip
              id="sea_monster_eye"
              label={materialLabel("sea_monster_eye")}
              cost={cost.sea_monster_eye}
              owned={inventory.sea_monster_eye ?? 0}
            />
            <CostChip
              id="corroded_seaweed"
              label={materialLabel("corroded_seaweed")}
              cost={cost.corroded_seaweed}
              owned={inventory.corroded_seaweed ?? 0}
            />
            <CostChip id="coin" label="Coin" cost={cost.coin} owned={coin} />
          </div>

          {blocker === "level" ? (
            <p className="font-body text-[11px] text-el-light">
              Reach level {levelNeeded} first — this character is{" "}
              {progress.level}.
            </p>
          ) : null}

          <StatDelta
            from={before}
            to={after}
            extra={[
              {
                label: "CAP",
                from: `Lv ${maxLevelForAscension(progress.ascension)}`,
                to: `Lv ${maxLevelForAscension(next)}`,
              },
            ]}
          />

          <Button
            className="mt-1"
            disabled={blocker !== null}
            onClick={() => ascendCharacter(character.id)}
          >
            {blocker === "level"
              ? `Locked until Lv ${levelNeeded}`
              : blocker === "materials"
                ? "Not enough materials"
                : `Ascend to A${next}`}
          </Button>
        </>
      ) : (
        <p className="mt-1 border-l-2 border-edge-strong bg-inset px-3 py-2 font-body text-xs text-readout-dim">
          No further ascension costed yet — bands 4–6 come in a later update.
        </p>
      )}
    </div>
  );
}

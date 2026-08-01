"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlayerStore, getCharacterProgress } from "@/store/playerStore";
import { xpToNext } from "@/lib/game/leveling";
import { getAscensionCost, maxLevelForAscension } from "@/lib/game/ascension";

const MANUAL_TIERS = [
  { id: "training_manual", label: "Training Manual" },
  { id: "training_manual_advanced", label: "Advanced Manual" },
  { id: "training_manual_premium", label: "Premium Manual" },
] as const;

export default function CharacterProgressionPanel({ characterId }: { characterId: string }): React.JSX.Element {
  const state = usePlayerStore();
  const progress = getCharacterProgress(state, characterId);
  const maxLevel = maxLevelForAscension(progress.ascension);
  const nextCost = getAscensionCost(progress.ascension + 1);
  const atMaxLevel = progress.level >= maxLevel;
  const xpNeeded = atMaxLevel ? 0 : xpToNext(progress.level);

  return (
    <Card className="rounded-none border-2 border-zinc-700 bg-black/55 ring-0">
      <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
        <CardTitle className="font-heading text-lg tracking-[0.12em] text-zinc-100">
          Level {progress.level} • Ascension {progress.ascension}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4">
        {!atMaxLevel ? (
          <div>
            <div className="flex items-center justify-between font-body text-xs uppercase tracking-widest text-zinc-500">
              <span>XP</span>
              <span>{progress.xp} / {xpNeeded}</span>
            </div>
            <Progress value={(progress.xp / xpNeeded) * 100} className="mt-1" />
          </div>
        ) : (
          <p className="font-body text-xs uppercase tracking-widest text-amber-300">
            Max level for this ascension tier — ascend to continue leveling.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {MANUAL_TIERS.map((tier) => {
            const owned = state.inventory[tier.id] ?? 0;
            const disabled = atMaxLevel || owned < 1;
            return (
              <Button
                key={tier.id}
                variant="outline"
                disabled={disabled}
                onClick={() => state.feedManualToCharacter(characterId, tier.id)}
                title={atMaxLevel ? "At max level for this ascension tier" : owned < 1 ? `No ${tier.label} owned` : undefined}
              >
                Feed {tier.label} ({owned})
              </Button>
            );
          })}
        </div>

        {nextCost ? (
          <div className="border-t border-zinc-800 pt-3">
            <p className="font-body text-xs uppercase tracking-widest text-zinc-500">
              Ascend to tier {progress.ascension + 1} (unlocks Lv{maxLevelForAscension(progress.ascension + 1)})
            </p>
            <p className="mt-1 font-body text-sm text-zinc-300">
              {nextCost.sea_monster_eye}x Sea Monster&apos;s Eye ({state.inventory.sea_monster_eye ?? 0} owned) •{" "}
              {nextCost.corroded_seaweed}x Corroded Sea Weed ({state.inventory.corroded_seaweed ?? 0} owned) •{" "}
              {nextCost.coin} coin ({state.currencies.coin} owned)
            </p>
            <Button
              className="mt-2"
              onClick={() => state.ascendCharacter(characterId)}
            >
              Ascend
            </Button>
          </div>
        ) : (
          <p className="border-t border-zinc-800 pt-3 font-body text-xs uppercase tracking-widest text-zinc-500">
            No further ascension costed yet (bands 4-6 come in a later update).
          </p>
        )}
      </CardContent>
    </Card>
  );
}

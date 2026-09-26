"use client";

import React from "react";
import { useGameStore } from "@/store/gameStore";
import { useBattleContext } from "@/hooks/BattleProvider";
import Deck from "@/components/game/Deck";
import BattleArena from "@/components/game/BattleArena";
import TeamSelect from "@/components/game/TeamSelect";
import { Screen } from "@/components/ui/Screen";

export default function Practice() {
  const battlePhase = useGameStore((s) => s.battlePhase);
  const ownerRoute = useGameStore((s) => s.battleOwner?.route ?? "/practice");
  const { startCustomBattle } = useBattleContext();

  // Only practice's own battle renders here. This used to render ANY live
  // battle it found, so a world boss fight resumed on this screen with no
  // boss handlers — winning it paid nothing (audit finding F5, 2026-09-26).
  // Another screen's battle is `BattleLock`'s to route back; until it does,
  // this shows the bench rather than someone else's fight.
  const ownBattle = battlePhase !== "initializing" && ownerRoute === "/practice";

  if (!ownBattle) {
    return (
      <Screen className="relative text-readout" width="none">
        <TeamSelect onStart={startCustomBattle} />
      </Screen>
    );
  }

  // Single-viewport battle HUD: arena fills the screen, deck docked at the
  // bottom, no page scroll (STATUS #20). That is exactly `Screen`'s `fixed`
  // variant, and `width="none"` because the arena owns the full area.
  //
  // This used to paint an amber radial over a hand-written gradient
  // (`rgba(245,158,11,…)`, `#09090b`, `#111827`) plus its own grid overlay —
  // the pre-token palette written as inline styles, which is why the class
  // sweep on 2026-08-13 walked straight past it. `.terminal-grid` is the same
  // 44px ground every other screen stands on.
  return (
    <Screen variant="fixed" width="none">
      <BattleArena />
      <Deck />
    </Screen>
  );
}

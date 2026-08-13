"use client";

import React from "react";
import { useGameStore } from "@/store/gameStore";
import { useBattleContext } from "@/hooks/BattleProvider";
import Deck from "@/components/game/Deck";
import BattleArena from "@/components/game/BattleArena";
import TeamSelect from "@/components/game/TeamSelect";

export default function Practice() {
  const { battlePhase } = useGameStore();
  const { startCustomBattle } = useBattleContext();

  const isInitializing = battlePhase === "initializing";

  if (isInitializing) {
    return (
      <main className="relative min-h-screen bg-void text-readout">
        <TeamSelect onStart={startCustomBattle} />
      </main>
    );
  }

  // Single-viewport battle HUD: arena fills the screen, deck docked at the
  // bottom, no page scroll (STATUS #20).
  //
  // This used to paint an amber radial over a hand-written gradient
  // (`rgba(245,158,11,…)`, `#09090b`, `#111827`) plus its own grid overlay —
  // the pre-token palette written as inline styles, which is why the class
  // sweep on 2026-08-13 walked straight past it. `.terminal-grid` is the same
  // 44px ground every other screen stands on.
  return (
    <main className="terminal-grid relative flex screen-below-nav flex-col overflow-hidden bg-void text-readout">
      <BattleArena />
      <Deck />
    </main>
  );
}

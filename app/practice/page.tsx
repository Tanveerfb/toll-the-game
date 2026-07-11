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
      <main className="relative min-h-screen bg-zinc-950 text-zinc-100">
        <TeamSelect onStart={startCustomBattle} />
      </main>
    );
  }

  // Single-viewport battle HUD: arena fills the screen, deck docked at the
  // bottom, no page scroll (STATUS #20)
  return (
    <main
      className="relative flex h-[calc(100dvh-2.875rem)] flex-col overflow-hidden text-zinc-100"
      style={{
        backgroundImage:
          "radial-gradient(70% 50% at 50% 0%, rgba(245,158,11,0.22), transparent 72%), linear-gradient(140deg, #09090b 0%, #111827 52%, #0a0a0a 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[36px_36px]" />
      <BattleArena />
      <Deck />
    </main>
  );
}

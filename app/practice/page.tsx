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

  return (
    <main className="relative min-h-screen bg-zinc-950 text-zinc-100">
      {isInitializing ? (
        <TeamSelect onStart={startCustomBattle} />
      ) : (
        <>
          {/* Battle visual */}
          <section className="mb-4">
            <BattleArena />
          </section>

          {/* Deck & Queue UI — auto-executes when queue is full (3 actions) */}
          <Deck />
        </>
      )}
    </main>
  );
}

"use client";

import React from "react";
import { useGameStore } from "@/store/gameStore";
import { useBattleContext } from "@/hooks/BattleProvider";
import Deck from "@/components/game/Deck";
import BattleArena from "@/components/game/BattleArena";
import { Button } from "@heroui/react";

export default function Practice() {
  const { battlePhase } = useGameStore();
  const { startFullTest } = useBattleContext();

  const isInitializing = battlePhase === "initializing";

  return (
    <main className="relative min-h-screen bg-zinc-950 text-zinc-100">
      {/* Controls for initializing */}
      {isInitializing ? (
        <div className="flex items-center gap-4">
          <Button variant="primary" onPress={startFullTest}>
            Start Practice Battle
          </Button>
        </div>
      ) : (
        <>
          {/* Battle visual */}
          <section className="mb-4">
            <BattleArena />
          </section>

          {/* Deck & Queue UI */}
          <Deck />

          {/* Auto‑execute when queue is full (3 actions) */}
          {/* The Deck component now handles auto‑execution via a useEffect. */}
        </>
      )}
    </main>
  );
}

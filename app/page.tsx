"use client";

import { Button, Card } from "@heroui/react";
import React from "react";
import { useAuth } from "@/hooks/AuthProvider";
import { useGameStore } from "@/store/gameStore";
import { useBattleContext } from "@/hooks/BattleProvider";
import { useRouter } from "next/navigation";
import Deck from "@/components/game/Deck";

export default function Home() {
  const { user } = useAuth();
  const { battlePhase } = useGameStore();
  const { startFullTest } = useBattleContext();
  const router = useRouter();

  const authLabel = user ? "PROFILE" : "LOGIN";
  const authRoute = user ? "/profile" : "/login";

  if (battlePhase !== "initializing") {
    return (
      <main
        className="relative min-h-screen overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(60% 45% at 50% 15%, rgba(217,119,6,0.25), transparent 70%), linear-gradient(120deg, #0c0a09 0%, #111827 55%, #1f2937 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[36px_36px] opacity-20" />
        <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-10">
          <div className="mb-8 border-2 border-zinc-700 bg-black/40 px-6 py-4 backdrop-blur-sm">
            <p className="font-heading text-xl tracking-[0.18em] text-zinc-100 md:text-2xl">
              BATTLE IN PROGRESS
            </p>
            <p className="mt-2 font-body text-sm uppercase tracking-[0.16em] text-zinc-400">
              Queue skills from the deck below to continue the encounter.
            </p>
          </div>
          <div className="flex-1" />
          <Deck />
        </section>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-zinc-950"
      style={{
        backgroundImage:
          "radial-gradient(80% 45% at 85% 0%, rgba(245,158,11,0.18), transparent 72%), radial-gradient(65% 50% at 0% 100%, rgba(16,185,129,0.2), transparent 75%), linear-gradient(145deg, #09090b 0%, #111827 48%, #0a0a0a 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[40px_40px] opacity-25" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10 md:px-10">
        <Card
          variant="tertiary"
          className="w-full rounded-none border-2 border-zinc-700 bg-black/55 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-sm"
        >
          <Card.Header className="border-b border-zinc-700 px-6 py-6 md:px-10 md:py-8">
            <div>
              <p className="font-heading text-2xl tracking-[0.2em] text-zinc-300 md:text-3xl">
                TOLL THE GAME
              </p>
              <Card.Title className="mt-2 font-heading text-5xl tracking-[0.14em] text-zinc-100 md:text-7xl">
                MAIN MENU
              </Card.Title>
            </div>
          </Card.Header>

          <Card.Content className="grid gap-4 px-6 py-6 md:grid-cols-2 md:gap-5 md:px-10 md:py-10">
            <Button
              variant="secondary"
              isDisabled
              className="h-20 rounded-none border-2 border-zinc-700 px-8 text-left font-heading text-2xl tracking-[0.14em] text-zinc-500 md:h-24 md:text-3xl"
            >
              MAIN STORY
            </Button>

            <Button
              variant="outline"
              onPress={() => router.push("/archive")}
              className="h-20 rounded-none border-2 border-zinc-400 px-8 text-left font-heading text-2xl tracking-[0.14em] text-zinc-100 transition-all hover:bg-zinc-100/5 md:h-24 md:text-3xl"
            >
              CHARACTER ARCHIVE
            </Button>

            <Button
              variant="primary"
              onPress={startFullTest}
              className="h-20 rounded-none border-2 border-amber-300 bg-[linear-gradient(90deg,#b45309_0%,#d97706_38%,#f59e0b_70%,#facc15_100%)] px-8 text-left font-heading text-2xl tracking-[0.14em] text-zinc-950 shadow-[0_10px_30px_rgba(245,158,11,0.35)] transition-all hover:brightness-110 md:h-24 md:text-3xl"
            >
              PRACTICE
            </Button>

            <Button
              variant="tertiary"
              onPress={() => router.push(authRoute)}
              className="h-20 rounded-none border-2 border-sky-300 px-8 text-left font-heading text-2xl tracking-[0.14em] text-sky-200 transition-all hover:bg-sky-300/10 md:h-24 md:text-3xl"
            >
              {authLabel}
            </Button>
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}

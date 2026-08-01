"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import React from "react";
import { useAuth } from "@/hooks/AuthProvider";
import { useGameStore } from "@/store/gameStore";
import { useRouter } from "next/navigation";
import BattleArena from "@/components/game/BattleArena";
import {
  getLastViewedNewsDate,
  hasUnreadNews,
  subscribeToNewsReadState,
} from "@/lib/news/readTracking";

interface HomeMenuProps {
  latestNewsDate: string | null;
}

export default function HomeMenu({ latestNewsDate }: HomeMenuProps) {
  const { user } = useAuth();
  const { battlePhase } = useGameStore();
  const router = useRouter();
  // localStorage is an external store, so it's read via useSyncExternalStore
  // rather than effect+setState: the server snapshot is always `false` (avoids
  // a hydration mismatch, since the server has no localStorage), and the
  // client snapshot re-syncs on cross-tab "storage" events.
  const hasUnread = React.useSyncExternalStore(
    subscribeToNewsReadState,
    () => hasUnreadNews(latestNewsDate, getLastViewedNewsDate()),
    () => false
  );

  const authLabel = user ? "PROFILE" : "LOGIN";
  const authRoute = user ? "/profile" : "/login";

  if (battlePhase !== "initializing") {
    return <BattleArena />;
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
        <Card className="w-full rounded-none border-2 border-zinc-700 bg-black/55 shadow-[0_24px_70px_rgba(0,0,0,0.55)] ring-0 backdrop-blur-sm">
          <CardHeader className="border-b border-zinc-700 px-6 py-6 md:px-10 md:py-8">
            <div>
              <p className="font-heading text-2xl tracking-[0.2em] text-zinc-300 md:text-3xl">
                TOLL THE GAME
              </p>
              <CardTitle className="mt-2 font-heading text-5xl tracking-[0.14em] text-zinc-100 md:text-7xl">
                MAIN MENU
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 px-6 py-6 md:grid-cols-2 md:gap-5 md:px-10 md:py-10">
            <Button
              variant="outline"
              onClick={() => router.push("/story")}
              className="h-20 justify-start rounded-none border-2 border-amber-300 bg-transparent px-8 font-heading text-2xl tracking-[0.14em] text-amber-200 transition-all hover:bg-amber-300/10 hover:text-amber-100 md:h-24 md:text-3xl"
            >
              MAIN STORY
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/archive")}
              className="h-20 justify-start rounded-none border-2 border-zinc-400 bg-transparent px-8 font-heading text-2xl tracking-[0.14em] text-zinc-100 transition-all hover:bg-zinc-100/5 md:h-24 md:text-3xl"
            >
              CHARACTER ARCHIVE
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/world-boss")}
              className="h-20 justify-start rounded-none border-2 border-red-400 bg-transparent px-8 font-heading text-2xl tracking-[0.14em] text-red-200 transition-all hover:bg-red-400/10 hover:text-red-100 md:h-24 md:text-3xl"
            >
              WORLD BOSS
            </Button>

            <Button
              onClick={() => router.push("/practice")}
              className="h-20 justify-start rounded-none border-2 border-amber-300 bg-[linear-gradient(90deg,#b45309_0%,#d97706_38%,#f59e0b_70%,#facc15_100%)] px-8 font-heading text-2xl tracking-[0.14em] text-zinc-950 shadow-[0_10px_30px_rgba(245,158,11,0.35)] transition-all hover:brightness-110 md:h-24 md:text-3xl"
            >
              PRACTICE
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/news")}
              className="relative h-20 justify-start rounded-none border-2 border-violet-400 bg-transparent px-8 font-heading text-2xl tracking-[0.14em] text-violet-200 transition-all hover:bg-violet-400/10 hover:text-violet-100 md:h-24 md:text-3xl"
            >
              NEWS
              {hasUnread ? (
                <span className="absolute -top-2 -right-2 rounded-none bg-amber-400 px-1.5 py-0.5 font-body text-[9px] font-black uppercase tracking-widest text-zinc-950">
                  New
                </span>
              ) : null}
            </Button>

            <Button
              variant="ghost"
              onClick={() => router.push(authRoute)}
              className="h-20 justify-start rounded-none border-2 border-sky-300 px-8 font-heading text-2xl tracking-[0.14em] text-sky-200 transition-all hover:bg-sky-300/10 hover:text-sky-100 md:h-24 md:text-3xl"
            >
              {authLabel}
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

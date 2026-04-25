"use client";

import { Button } from "@heroui/react";
import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/AuthProvider';
import { useGameStore } from '@/store/gameStore';
import { useBattleContext } from '@/hooks/BattleProvider';
import { useRouter } from 'next/navigation';
import BattleArena from '@/components/game/BattleArena';

export default function Home() {
  const { user, logout } = useAuth();
  const { battlePhase } = useGameStore();
  const { startFullTest } = useBattleContext();
  const router = useRouter();

  if (battlePhase !== "initializing") {
    return <BattleArena />;
  }

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundImage: `url('/bg-images/vlcsnap-00001.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Header Auth Section */}
      <div className="relative z-10 w-full p-6 flex justify-end items-center">
        {user ? (
          <div className="flex items-center gap-4 bg-black/50 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md">
            <span className="text-zinc-200 text-sm font-body font-semibold">
              {user.email || 'Ledger Member'}
            </span>
            <button
              onClick={logout}
              className="text-amber-400 hover:text-amber-300 text-sm font-bold tracking-wide transition-colors cursor-pointer"
            >
              LOGOUT
            </button>
          </div>
        ) : (
          <button
            onClick={() => router.push('/login')}
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-full font-bold tracking-wide transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)] cursor-pointer"
          >
            LOGIN / SIGN UP
          </button>
        )}
      </div>

      {/* Centered Main Menu */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
        <h1 className="text-8xl font-heading text-white tracking-widest mb-12 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
          TOLL THE GAME
        </h1>

        <div className="flex flex-col gap-4 w-full max-w-sm">
          <Button
            variant="ghost"
            size="lg"
            className="font-heading text-2xl tracking-widest bg-black/60 text-zinc-500 cursor-not-allowed border border-white/5 py-8"
            isDisabled
          >
            MAIN STORY
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="font-heading text-2xl tracking-widest bg-black/60 text-zinc-200 hover:bg-white/10 hover:text-white border border-white/20 hover:border-white/50 hover:scale-105 transition-all py-8"
            onPress={() => router.push('/archive')}
          >
            CHARACTER ARCHIVE
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="font-heading text-2xl tracking-widest bg-black/60 text-zinc-500 cursor-not-allowed border border-white/5 py-8"
            isDisabled
          >
            PROFILE
          </Button>
          <Button
            variant="tertiary"
            size="lg"
            className="font-heading text-2xl tracking-widest bg-gradient-to-r from-amber-600/80 to-yellow-500/80 text-white hover:from-amber-500 hover:to-yellow-400 border border-amber-300/50 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] transition-all py-8"
            onPress={startFullTest}
          >
            PRACTICE
          </Button>
        </div>
      </div>
    </div>
  );
}

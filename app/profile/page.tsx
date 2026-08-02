"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/AuthProvider";
import { usePlayerStore, getCharacterProgress } from "@/store/playerStore";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { getCurrentStamina, STAMINA_CAP } from "@/lib/game/stamina";
import DevGrantPanel from "@/components/game/DevGrantPanel";

const MATERIAL_LABELS: Record<string, string> = {
  sea_monster_eye: "Sea Monster's Eye",
  corroded_seaweed: "Corroded Sea Weed",
  training_manual: "Training Manual",
  training_manual_advanced: "Advanced Training Manual",
  training_manual_premium: "Premium Training Manual",
};

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const store = usePlayerStore();
  const { roster, currencies, inventory, stamina } = store;

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (!loading && !user) {
    return null;
  }

  const currentStamina = getCurrentStamina(stamina);

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950">
      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-6 py-10">
        <h1 className="font-heading text-4xl tracking-[0.14em] text-zinc-100">PROFILE</h1>

        {loading ? (
          <p className="font-body text-sm text-zinc-400">Loading…</p>
        ) : (
          <>
            <Card className="rounded-none border-2 border-zinc-700 bg-black/55 ring-0">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-body text-xs uppercase tracking-[0.16em] text-zinc-500">Stamina</span>
                  <span className="font-heading text-lg text-zinc-100">{currentStamina} / {STAMINA_CAP}</span>
                </div>
                <Progress value={(currentStamina / STAMINA_CAP) * 100} />
              </CardContent>
            </Card>

            <Card className="rounded-none border-2 border-zinc-700 bg-black/55 ring-0">
              <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
                <CardTitle className="font-heading text-lg tracking-[0.12em] text-zinc-100">Currencies</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-6 p-4">
                <div>
                  <p className="font-body text-[10px] uppercase tracking-widest text-zinc-500">Gems</p>
                  <p className="font-heading text-xl text-amber-200">{currencies.gems}</p>
                </div>
                <div>
                  <p className="font-body text-[10px] uppercase tracking-widest text-zinc-500">Coin</p>
                  <p className="font-heading text-xl text-zinc-100">{currencies.coin}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-none border-2 border-zinc-700 bg-black/55 ring-0">
              <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
                <CardTitle className="font-heading text-lg tracking-[0.12em] text-zinc-100">Materials</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3">
                {Object.entries(MATERIAL_LABELS).map(([id, label]) => (
                  <div key={id} className="border border-zinc-800 px-3 py-2">
                    <p className="font-body text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
                    <p className="font-heading text-lg text-zinc-100">{inventory[id] ?? 0}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-none border-2 border-zinc-700 bg-black/55 ring-0">
              <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
                <CardTitle className="font-heading text-lg tracking-[0.12em] text-zinc-100">Roster</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 p-4">
                {roster.map((id) => {
                  const character = getCharacterById(id);
                  const progress = getCharacterProgress(store, id);
                  return (
                    <Link
                      key={id}
                      href={`/archive/${id}`}
                      className="flex items-center justify-between border border-zinc-800 px-3 py-2 hover:border-amber-300"
                    >
                      <span className="font-body text-sm text-zinc-200">{character?.name ?? id}</span>
                      <span className="font-body text-xs uppercase tracking-widest text-zinc-500">
                        Lv {progress.level} • Ascension {progress.ascension}
                      </span>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            <DevGrantPanel />

            <div className="border-2 border-zinc-800 bg-black/40 px-4 py-4">
              <p className="font-body text-[10px] uppercase tracking-[0.2em] text-zinc-500">Signed in as</p>
              <p className="mt-1 font-body text-sm text-zinc-100">{user?.email ?? user?.displayName ?? user?.uid}</p>
            </div>

            <Button
              variant="outline"
              onClick={async () => {
                await logout();
                router.replace("/");
              }}
              className="h-12 rounded-none border-2 border-red-400 bg-transparent font-heading tracking-[0.14em] text-red-200 hover:text-red-100"
            >
              LOGOUT
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          onClick={() => router.push("/")}
          className="h-12 rounded-none border-2 border-zinc-700 font-heading tracking-[0.14em] text-zinc-300"
        >
          BACK TO MENU
        </Button>
      </section>
    </main>
  );
}

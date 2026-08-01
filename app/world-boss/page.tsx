// app/world-boss/page.tsx
"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BattleArena from "@/components/game/BattleArena";
import Deck from "@/components/game/Deck";
import WorldBossTeamSelect, { toWorldBossTeamPicks } from "@/components/game/WorldBossTeamSelect";
import { useBattleContext } from "@/hooks/BattleProvider";
import { useGameStore } from "@/store/gameStore";
import { usePlayerStore } from "@/store/playerStore";
import { getCurrentStamina, STAMINA_CAP } from "@/lib/game/stamina";
import { rollWorldBossRewards, type WorldBossRewards } from "@/lib/game/worldBossRewards";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById, getCharacterPhases, type CharacterData } from "@/lib/game/characterCatalog";

const MOLVARR_ID = "molvarr";
const STAMINA_COST = 40;

type View = { kind: "select" } | { kind: "battle" } | { kind: "results"; rewards: WorldBossRewards };

const PAGE_BG = {
  backgroundImage:
    "radial-gradient(70% 50% at 50% 0%, rgba(245,158,11,0.2), transparent 72%), linear-gradient(140deg, #09090b 0%, #111827 52%, #0a0a0a 100%)",
};

export default function WorldBossPage(): React.JSX.Element {
  const { startCustomBattle } = useBattleContext();
  const { resetBattle } = useGameStore();
  const roster = usePlayerStore((s) => s.roster);
  const stamina = usePlayerStore((s) => s.stamina);
  const spendStaminaAction = usePlayerStore((s) => s.spendStaminaAction);
  const grantWorldBossRewards = usePlayerStore((s) => s.grantWorldBossRewards);

  const [view, setView] = React.useState<View>({ kind: "select" });
  const [team, setTeam] = React.useState<CharacterData[]>([]);
  const [insufficientStaminaNotice, setInsufficientStaminaNotice] = React.useState(false);

  const molvarr = getCharacterById(MOLVARR_ID);
  const phaseCount = molvarr ? getCharacterPhases(molvarr).length || 1 : 1;
  const currentStamina = getCurrentStamina(stamina);
  const canEnter = team.length > 0 && currentStamina >= STAMINA_COST;

  const enter = React.useCallback(() => {
    if (!spendStaminaAction(STAMINA_COST)) {
      setInsufficientStaminaNotice(true);
      setView({ kind: "select" });
      return;
    }
    setInsufficientStaminaNotice(false);
    startCustomBattle(toWorldBossTeamPicks(team), [{ id: MOLVARR_ID }]);
    setView({ kind: "battle" });
  }, [spendStaminaAction, startCustomBattle, team]);

  if (view.kind === "battle") {
    return (
      <main className="relative flex h-[calc(100dvh-2.875rem)] flex-col overflow-hidden text-zinc-100" style={PAGE_BG}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[36px_36px]" />
        <BattleArena
          worldBoss={{
            onContinue: () => {
              const rewards = rollWorldBossRewards();
              grantWorldBossRewards(rewards);
              resetBattle();
              setView({ kind: "results", rewards });
            },
            onRetry: enter,
            onQuit: () => {
              resetBattle();
              setView({ kind: "select" });
            },
          }}
        />
        <Deck />
      </main>
    );
  }

  if (view.kind === "results") {
    const rows: Array<[string, number]> = [
      ["Sea Monster's Eye", view.rewards.sea_monster_eye],
      ["Corroded Sea Weed", view.rewards.corroded_seaweed],
      ["Training Manual", view.rewards.training_manual],
      ["Coin", view.rewards.coin],
    ];
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950" style={PAGE_BG}>
        <Card className="w-full max-w-md rounded-none border-2 border-amber-300 bg-black/70 ring-0">
          <CardHeader className="border-b border-zinc-800 px-6 py-5">
            <CardTitle className="font-heading text-3xl tracking-[0.14em] text-amber-300">
              REWARDS
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-6 py-6">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="font-body text-sm uppercase tracking-[0.12em] text-zinc-400">{label}</span>
                <span className="font-heading text-xl text-zinc-100">+{value}</span>
              </div>
            ))}
            <Button
              onClick={() => setView({ kind: "select" })}
              className="mt-2 h-12 rounded-none border-2 border-amber-300 font-heading text-lg tracking-[0.14em]"
            >
              CONTINUE
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950" style={PAGE_BG}>
      <section className="relative z-10 mx-auto w-full max-w-4xl space-y-4 px-4 py-8 md:px-8">
        <h1 className="font-heading text-4xl tracking-[0.14em] text-zinc-100 md:text-5xl">
          WORLD BOSS
        </h1>

        <Card className="rounded-none border-2 border-rose-400/70 bg-black/50 ring-0">
          <CardContent className="flex items-center gap-4 p-4">
            {molvarr && getCharacterArt(molvarr.id) ? (
              <Image
                src={getCharacterArt(molvarr.id)!}
                alt={molvarr.name}
                width={96}
                height={96}
                className="h-24 w-24 border-2 border-rose-400/70 object-cover object-top"
              />
            ) : null}
            <div>
              <p className="font-heading text-2xl tracking-[0.1em] text-rose-200">
                {molvarr?.name ?? "Molvarr"}
              </p>
              <p className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
                Elite • {phaseCount} phase{phaseCount === 1 ? "" : "s"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 border-zinc-700 bg-black/50 ring-0">
          <CardContent className="flex items-center justify-between p-4">
            <span className="font-body text-sm uppercase tracking-[0.14em] text-zinc-400">Stamina</span>
            <span className="font-heading text-xl text-zinc-100">{currentStamina} / {STAMINA_CAP}</span>
          </CardContent>
        </Card>

        <WorldBossTeamSelect ownedIds={roster} team={team} onChange={setTeam} />

        {insufficientStaminaNotice ? (
          <p className="font-body text-sm text-red-400">Not enough stamina — wait for it to regenerate.</p>
        ) : null}

        <Button
          size="lg"
          disabled={!canEnter}
          onClick={enter}
          className="h-12 w-full rounded-none border-2 border-amber-300 bg-[linear-gradient(90deg,#b45309_0%,#d97706_38%,#f59e0b_70%,#facc15_100%)] font-heading text-lg tracking-[0.14em] text-zinc-950"
        >
          ENTER ({STAMINA_COST} STAMINA)
        </Button>
      </section>
    </main>
  );
}

"use client";

import React from "react";
import { Button, Card, Chip, ProgressBar } from "@heroui/react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { useBattleContext } from "@/hooks/BattleProvider";
import type { BattleCharacter } from "@/types/character";
import BattleEffectsOverlay from "@/components/game/BattleEffectsOverlay";
import Deck from "@/components/game/Deck";

function formatPhaseLabel(phase: string): string {
  return phase
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function getUnitBorderClass(color: BattleCharacter["color"]): string {
  switch (color) {
    case "red":
      return "border-rose-400/80";
    case "blue":
      return "border-sky-400/80";
    case "green":
      return "border-emerald-400/80";
    case "dark":
      return "border-violet-400/80";
    case "light":
    default:
      return "border-amber-300/80";
  }
}

function TeamUnitCard({
  unit,
  isEnemy,
  isMarked,
  queuedHits,
  onMark,
}: {
  unit: BattleCharacter;
  isEnemy: boolean;
  isMarked: boolean;
  queuedHits: number;
  onMark: (instanceId: string) => void;
}): React.JSX.Element {
  const hpPercent =
    unit.hp > 0 ? Math.max(0, (unit.currentHP / unit.hp) * 100) : 0;
  const isDead = unit.currentHP <= 0;

  return (
    <div data-battle-instance={unit.instanceId} className="relative">
      <Card
        variant="secondary"
        className={`rounded-none border ${isMarked ? "border-amber-300" : getUnitBorderClass(unit.color)} bg-black/55`}
        onClick={() => {
          if (isEnemy && !isDead) {
            onMark(unit.instanceId);
          }
        }}
      >
        <Card.Header className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div>
            <Card.Title className="font-heading text-xl tracking-[0.08em] text-zinc-100">
              {unit.name}
            </Card.Title>
            <Card.Description className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
              {isEnemy ? "Enemy" : "Ally"} • {unit.color}
            </Card.Description>
          </div>

          {isMarked ? (
            <Chip
              variant="secondary"
              className="rounded-none border border-amber-300 bg-amber-300/10"
            >
              <Chip.Label className="font-body text-[11px] uppercase tracking-[0.12em] text-amber-200">
                Targeted
              </Chip.Label>
            </Chip>
          ) : null}

          {queuedHits > 0 ? (
            <Chip
              variant="secondary"
              className="rounded-none border border-sky-300 bg-sky-500/15"
            >
              <Chip.Label className="font-body text-[11px] uppercase tracking-[0.12em] text-sky-100">
                {queuedHits} queued
              </Chip.Label>
            </Chip>
          ) : null}
        </Card.Header>

        <Card.Content
          className={`space-y-3 px-4 py-4 ${isDead ? "opacity-55" : ""}`}
        >
          <div>
            <div className="mb-1 flex items-center justify-between font-body text-xs uppercase tracking-[0.12em] text-zinc-400">
              <span>HP</span>
              <span>
                {unit.currentHP}/{unit.hp}
              </span>
            </div>
            <ProgressBar
              value={hpPercent}
              maxValue={100}
              color={isDead ? "danger" : hpPercent < 30 ? "danger" : "success"}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 font-body text-xs uppercase tracking-widest text-zinc-300">
            <div className="border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-center">
              <span className="block text-zinc-500">ATK</span>
              <span className="font-semibold text-zinc-200">
                {unit.currentAttack}
              </span>
            </div>
            <div className="border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-center">
              <span className="block text-zinc-500">DEF</span>
              <span className="font-semibold text-zinc-200">
                {unit.currentDefense}
              </span>
            </div>
            <div className="border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-center">
              <span className="block text-zinc-500">ULT</span>
              <span className="font-semibold text-zinc-200">
                {unit.ultGauge}/5
              </span>
            </div>
          </div>

          <div className="space-y-1 font-body text-[11px] uppercase tracking-widest text-zinc-400">
            <p>Buffs: {unit.buffs.map((b) => b.type).join(", ") || "None"}</p>
            <p>
              Debuffs:{" "}
              {unit.debuffs
                .map((d) => `${d.type}${d.stacks ? `(${d.stacks})` : ""}`)
                .join(", ") || "None"}
            </p>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

export default function BattleArena(): React.JSX.Element {
  const {
    battlePhase,
    currentTurn,
    playerTurns,
    enemyTurns,
    playerTeam,
    enemyTeam,
    selectedEnemyMarker,
    battleLog,
    interactionNotice,
    setEnemyMarker,
    clearInteractionNotice,
    clearActionQueue,
    actionQueue,
  } = useGameStore();

  const { resolveEnemyTurnWrapper, resolveplayerTurnWrapper } =
    useBattleContext();

  React.useEffect(() => {
    if (battlePhase !== "EnemyAction") return;

    const timer = window.setTimeout(() => {
      resolveEnemyTurnWrapper();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [battlePhase, resolveEnemyTurnWrapper]);

  const isPlayerActionPhase = battlePhase === "PlayerAction";
  const isBattleEnd = battlePhase === "victory" || battlePhase === "defeat";
  const phaseLabel = formatPhaseLabel(battlePhase);

  const phaseOrder = [
    "OnBattleStart",
    "OnPlayerTurnStart",
    "PlayerAction",
    "OnPlayerTurnEnd",
    "OnEnemyTurnStart",
    "EnemyAction",
    "OnEnemyTurnEnd",
  ] as const;
  const phaseIndex = phaseOrder.indexOf(
    battlePhase as (typeof phaseOrder)[number],
  );
  const phaseProgress =
    battlePhase === "victory" || battlePhase === "defeat"
      ? 100
      : phaseIndex >= 0
        ? ((phaseIndex + 1) / phaseOrder.length) * 100
        : 0;

  const queuedHitCountByEnemy = React.useMemo(() => {
    const counts: Record<string, number> = {};
    actionQueue.forEach((action) => {
      if (!action.targetInstanceId) return;
      counts[action.targetInstanceId] =
        (counts[action.targetInstanceId] || 0) + 1;
    });
    return counts;
  }, [actionQueue]);

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(70% 50% at 50% 0%, rgba(245,158,11,0.22), transparent 72%), linear-gradient(140deg, #09090b 0%, #111827 52%, #0a0a0a 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-size-[36px_36px]" />
      <BattleEffectsOverlay
        battleLog={battleLog}
        battlePhase={battlePhase}
        units={[...playerTeam, ...enemyTeam].map((unit) => ({
          instanceId: unit.instanceId,
          name: unit.name,
        }))}
      />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-8 md:py-6">
        <Card
          variant="tertiary"
          className="rounded-none border-2 border-zinc-700 bg-black/45"
        >
          <Card.Content className="grid gap-4 px-5 py-4 md:grid-cols-4 md:items-end">
            <div className="md:col-span-2">
              <p className="font-body text-xs uppercase tracking-[0.16em] text-zinc-400">
                Battle Phase
              </p>
              <p className="font-heading text-2xl tracking-[0.12em] text-zinc-100 md:text-3xl">
                {phaseLabel}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden border border-zinc-700 bg-zinc-900/70">
                <motion.div
                  className="h-full bg-linear-to-r from-amber-300 via-orange-400 to-yellow-300"
                  initial={{ width: 0 }}
                  animate={{ width: `${phaseProgress}%` }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </div>
              <p className="mt-1 font-body text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                Turn Flow Progress
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 font-body text-xs uppercase tracking-[0.14em] text-zinc-300 md:col-span-2">
              <div className="border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-center">
                <span className="block text-zinc-500">Turn</span>
                <span className="font-semibold text-zinc-100">
                  {currentTurn + 1}
                </span>
              </div>
              <div className="border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-center">
                <span className="block text-zinc-500">Player</span>
                <span className="font-semibold text-zinc-100">
                  {playerTurns}
                </span>
              </div>
              <div className="border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-center">
                <span className="block text-zinc-500">Enemy</span>
                <span className="font-semibold text-zinc-100">
                  {enemyTurns}
                </span>
              </div>
            </div>
          </Card.Content>
        </Card>

        <section className="grid flex-1 gap-5 lg:grid-cols-2">
          <Card
            variant="secondary"
            className="rounded-none border border-zinc-700 bg-black/45"
          >
            <Card.Header className="border-b border-zinc-800 px-5 py-4">
              <Card.Title className="font-heading text-2xl tracking-widest text-zinc-100">
                Enemy Team
              </Card.Title>
              <Card.Description className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                Select a target for queued attacks
              </Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-3 p-4 sm:grid-cols-2">
              {enemyTeam.map((unit) => (
                <TeamUnitCard
                  key={unit.instanceId}
                  unit={unit}
                  isEnemy
                  isMarked={selectedEnemyMarker === unit.instanceId}
                  queuedHits={queuedHitCountByEnemy[unit.instanceId] || 0}
                  onMark={setEnemyMarker}
                />
              ))}
            </Card.Content>
          </Card>

          <Card
            variant="secondary"
            className="rounded-none border border-zinc-700 bg-black/45"
          >
            <Card.Header className="border-b border-zinc-800 px-5 py-4">
              <Card.Title className="font-heading text-2xl tracking-widest text-zinc-100">
                Player Team
              </Card.Title>
              <Card.Description className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                Monitor allies, statuses, and ultimate gauges
              </Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-3 p-4 sm:grid-cols-2">
              {playerTeam.map((unit) => (
                <TeamUnitCard
                  key={unit.instanceId}
                  unit={unit}
                  isEnemy={false}
                  isMarked={false}
                  queuedHits={0}
                  onMark={setEnemyMarker}
                />
              ))}
            </Card.Content>
          </Card>
        </section>

        <Card
          variant="secondary"
          className="rounded-none border border-zinc-700 bg-black/45"
        >
          <Card.Header className="flex flex-col items-start gap-3 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Card.Title className="font-heading text-2xl tracking-widest text-zinc-100">
                Action Console
              </Card.Title>
              <Card.Description className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                Queue up to three cards and execute during Player Action
              </Card.Description>
            </div>

            <Button
              variant="primary"
              onPress={resolveplayerTurnWrapper}
              isDisabled={
                !isPlayerActionPhase || actionQueue.length === 0 || isBattleEnd
              }
              className="rounded-none border border-amber-200 bg-amber-400/85 px-6 font-heading text-lg tracking-[0.08em] text-zinc-900 disabled:opacity-45"
            >
              Execute Queue
            </Button>

            <Button
              variant="secondary"
              onPress={clearActionQueue}
              isDisabled={actionQueue.length === 0 || isBattleEnd}
              className="rounded-none border border-zinc-500 px-6 font-heading text-lg tracking-[0.08em] text-zinc-100 disabled:opacity-45"
            >
              Clear Queue
            </Button>
          </Card.Header>

          <Card.Content className="grid gap-4 p-4 lg:grid-cols-2">
            <div className="border border-zinc-800 bg-zinc-950/45 p-3">
              {interactionNotice ? (
                <div className="mb-3 flex items-center justify-between gap-2 border border-red-400/60 bg-red-900/35 px-3 py-2">
                  <p className="font-body text-xs uppercase tracking-[0.12em] text-red-100">
                    {interactionNotice}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={clearInteractionNotice}
                    className="rounded-none border border-red-300/70 px-2 text-[11px] uppercase tracking-widest text-red-100"
                  >
                    Dismiss
                  </Button>
                </div>
              ) : null}

              <p className="mb-2 font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                Recent Battle Events
              </p>
              <div className="max-h-36 space-y-1 overflow-y-auto pr-1 font-body text-sm text-zinc-200">
                {(battleLog.length > 0
                  ? battleLog.slice(-8).reverse()
                  : ["No battle events yet."]
                ).map((entry, idx) => (
                  <p
                    key={`${entry}-${idx}`}
                    className="border-b border-zinc-900 pb-1 last:border-b-0"
                  >
                    {entry}
                  </p>
                ))}
              </div>
            </div>

            <div className="border border-zinc-800 bg-zinc-950/45 p-3">
              <p className="mb-2 font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                Turn Guidance
              </p>
              <ul className="space-y-1 font-body text-sm text-zinc-200">
                <li>1. Mark an enemy target from the enemy panel.</li>
                <li>
                  2. Click cards in the deck dock to fill the 3 action slots.
                </li>
                <li>3. Press Execute Queue during Player Action.</li>
                <li>
                  4. Attack/debuff/disable/ultimate cards require a marked
                  target.
                </li>
                <li>5. Enemy turn resolves automatically after your turn.</li>
              </ul>
            </div>
          </Card.Content>
        </Card>

        <Deck />
      </section>
    </main>
  );
}

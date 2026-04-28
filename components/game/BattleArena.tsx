"use client";

import React from "react";
import { Button, Card, Chip, ProgressBar } from "@heroui/react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { useBattleContext } from "@/hooks/BattleProvider";
import type { BattleCharacter } from "@/types/character";
import BattleEffectsOverlay from "@/components/game/BattleEffectsOverlay";

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
  onViewDetails,
}: {
  unit: BattleCharacter;
  isEnemy: boolean;
  isMarked: boolean;
  queuedHits: number;
  onMark: (instanceId: string) => void;
  onViewDetails: (unit: BattleCharacter) => void;
}): React.JSX.Element {
  const hpPercent =
    unit.hp > 0 ? Math.max(0, (unit.currentHP / unit.hp) * 100) : 0;
  const isDead = unit.currentHP <= 0;

  return (
    <div data-battle-instance={unit.instanceId} className="relative">
      <Card
        variant="secondary"
        className={`w-full rounded-none border ${isMarked ? "border-amber-300" : getUnitBorderClass(unit.color)} bg-black/55`}
        onClick={() => {
          if (isEnemy && !isDead) {
            onMark(unit.instanceId);
          }
        }}
      >
        <Card.Header className="flex items-start justify-between gap-2 border-b border-zinc-800 px-3 py-2">
          <div>
            <Card.Title className="font-heading text-base tracking-[0.06em] text-zinc-100">
              {unit.name}
            </Card.Title>
            <Card.Description className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
              {isEnemy ? "Enemy" : "Ally"} • {unit.color}
            </Card.Description>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              onViewDetails(unit);
            }}
            className="rounded-none border border-zinc-600 px-2 text-[10px] uppercase tracking-widest text-zinc-200"
          >
            Details
          </Button>
        </Card.Header>

        <Card.Content
          className={`space-y-2 px-3 py-2 ${isDead ? "opacity-55" : ""}`}
        >
          <div className="flex flex-wrap items-center gap-1">
            {isMarked ? (
              <Chip
                variant="secondary"
                className="rounded-none border border-amber-300 bg-amber-300/10"
              >
                <Chip.Label className="font-body text-[10px] uppercase tracking-[0.12em] text-amber-200">
                  Targeted
                </Chip.Label>
              </Chip>
            ) : null}

            {queuedHits > 0 ? (
              <Chip
                variant="secondary"
                className="rounded-none border border-sky-300 bg-sky-500/15"
              >
                <Chip.Label className="font-body text-[10px] uppercase tracking-[0.12em] text-sky-100">
                  {queuedHits} queued
                </Chip.Label>
              </Chip>
            ) : null}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between font-body text-[11px] uppercase tracking-[0.12em] text-zinc-400">
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

          <div className="grid grid-cols-3 gap-1.5 font-body text-[10px] uppercase tracking-widest text-zinc-300">
            <div className="border border-zinc-800 bg-zinc-900/60 px-1.5 py-1 text-center">
              <span className="block text-zinc-500">ATK</span>
              <span className="font-semibold text-zinc-200">
                {unit.currentAttack}
              </span>
            </div>
            <div className="border border-zinc-800 bg-zinc-900/60 px-1.5 py-1 text-center">
              <span className="block text-zinc-500">DEF</span>
              <span className="font-semibold text-zinc-200">
                {unit.currentDefense}
              </span>
            </div>
            <div className="border border-zinc-800 bg-zinc-900/60 px-1.5 py-1 text-center">
              <span className="block text-zinc-500">ULT</span>
              <span className="font-semibold text-zinc-200">
                {unit.ultGauge}/5
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 font-body text-[10px] uppercase tracking-widest text-zinc-400">
            <p className="border border-zinc-800 bg-zinc-900/40 px-1.5 py-1 text-center">
              Buffs: {unit.buffs.length}
            </p>
            <p className="border border-zinc-800 bg-zinc-900/40 px-1.5 py-1 text-center">
              Debuffs: {unit.debuffs.length}
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
    actionQueue,
  } = useGameStore();

  const { resolveEnemyTurnWrapper } = useBattleContext();

  React.useEffect(() => {
    if (battlePhase !== "EnemyAction") return;

    const timer = window.setTimeout(() => {
      resolveEnemyTurnWrapper();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [battlePhase, resolveEnemyTurnWrapper]);

  const phaseLabel = formatPhaseLabel(battlePhase);
  const [detailUnit, setDetailUnit] = React.useState<BattleCharacter | null>(
    null,
  );

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

  const actionLog = React.useMemo(
    () => battleLog.filter((entry) => entry.startsWith("[Action] ")),
    [battleLog],
  );

  const describeEffect = React.useCallback(
    (effect: BattleCharacter["buffs"][number]) => {
      const stacksText = effect.stacks
        ? `, ${effect.stacks} stack${effect.stacks > 1 ? "s" : ""}`
        : "";
      const valueText =
        effect.valuePercent !== undefined
          ? `${effect.valuePercent}%`
          : effect.value !== undefined
            ? `${effect.value}`
            : "";
      const statText = effect.stat ? ` ${effect.stat}` : "";
      const duration = effect.buffDuration ?? effect.debuffDuration;
      const durationText = duration
        ? `, ${duration} turn${duration > 1 ? "s" : ""}`
        : "";
      const payload = `${valueText}${statText}`.trim();
      return payload.length > 0
        ? `${effect.type} (${payload}${stacksText}${durationText})`
        : `${effect.type} (${`no numeric value${stacksText}${durationText}`.trim()})`;
    },
    [],
  );

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

        <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_330px]">
          <div className="grid gap-5">
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
              <Card.Content className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                {enemyTeam.map((unit) => (
                  <TeamUnitCard
                    key={unit.instanceId}
                    unit={unit}
                    isEnemy
                    isMarked={selectedEnemyMarker === unit.instanceId}
                    queuedHits={queuedHitCountByEnemy[unit.instanceId] || 0}
                    onMark={setEnemyMarker}
                    onViewDetails={setDetailUnit}
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
              <Card.Content className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                {playerTeam.map((unit) => (
                  <TeamUnitCard
                    key={unit.instanceId}
                    unit={unit}
                    isEnemy={false}
                    isMarked={false}
                    queuedHits={0}
                    onMark={setEnemyMarker}
                    onViewDetails={setDetailUnit}
                  />
                ))}
              </Card.Content>
            </Card>
          </div>

          <aside className="grid content-start gap-5 lg:sticky lg:top-5">
            <Card
              variant="secondary"
              className="rounded-none border border-zinc-700 bg-black/45"
            >
              <Card.Header className="flex flex-col items-start gap-3 border-b border-zinc-800 px-5 py-4">
                <div>
                  <Card.Title className="font-heading text-2xl tracking-widest text-zinc-100">
                    Action Console
                  </Card.Title>
                  <Card.Description className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                    Standardized action feed.
                  </Card.Description>
                </div>
              </Card.Header>

              <Card.Content className="grid gap-4 p-4">
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
                  <div className="max-h-65 space-y-1 overflow-y-auto pr-1 font-body text-sm text-zinc-200">
                    {(actionLog.length > 0
                      ? actionLog
                          .slice(-14)
                          .reverse()
                          .map((entry) => entry.replace(/^\[Action\]\s*/, ""))
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
              </Card.Content>
            </Card>
          </aside>
        </section>
      </section>

      {detailUnit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <Card
            variant="secondary"
            className="w-full max-w-2xl rounded-none border border-zinc-600 bg-zinc-950/95"
          >
            <Card.Header className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
              <div>
                <Card.Title className="font-heading text-2xl tracking-[0.08em] text-zinc-100">
                  {detailUnit.name}
                </Card.Title>
                <Card.Description className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Full active status details
                </Card.Description>
              </div>
              <Button
                variant="ghost"
                onPress={() => setDetailUnit(null)}
                className="rounded-none border border-zinc-600 text-xs uppercase tracking-widest"
              >
                Close
              </Button>
            </Card.Header>

            <Card.Content className="grid gap-4 px-5 py-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Stats Snapshot
                </p>
                <div className="grid grid-cols-2 gap-2 font-body text-xs uppercase tracking-widest text-zinc-300">
                  <div className="border border-zinc-800 bg-zinc-900/50 px-2 py-1">
                    HP: {detailUnit.currentHP}/{detailUnit.hp}
                  </div>
                  <div className="border border-zinc-800 bg-zinc-900/50 px-2 py-1">
                    ULT: {detailUnit.ultGauge}/5
                  </div>
                  <div className="border border-zinc-800 bg-zinc-900/50 px-2 py-1">
                    ATK: {detailUnit.currentAttack}
                  </div>
                  <div className="border border-zinc-800 bg-zinc-900/50 px-2 py-1">
                    DEF: {detailUnit.currentDefense}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="mb-1 font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                    Active Buffs
                  </p>
                  <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                    {detailUnit.buffs.length > 0 ? (
                      detailUnit.buffs.map((effect, idx) => (
                        <p
                          key={`buff-${effect.type}-${idx}`}
                          className="border border-emerald-700/60 bg-emerald-950/30 px-2 py-1 font-body text-xs text-emerald-100"
                        >
                          {describeEffect(effect)}
                        </p>
                      ))
                    ) : (
                      <p className="font-body text-xs text-zinc-400">
                        No active buffs.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-1 font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                    Active Debuffs
                  </p>
                  <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                    {detailUnit.debuffs.length > 0 ? (
                      detailUnit.debuffs.map((effect, idx) => (
                        <p
                          key={`debuff-${effect.type}-${idx}`}
                          className="border border-rose-700/60 bg-rose-950/30 px-2 py-1 font-body text-xs text-rose-100"
                        >
                          {describeEffect(effect)}
                        </p>
                      ))
                    ) : (
                      <p className="font-body text-xs text-zinc-400">
                        No active debuffs.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>
      ) : null}
    </main>
  );
}

"use client";

import React from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { getCharacterArt } from "@/lib/game/characterArt";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
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

function describeEffect(effect: BattleCharacter["buffs"][number]): string {
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
  const isBenched = unit.isSub === true;

  return (
    <div data-battle-instance={unit.instanceId} className="relative">
      <Card
        className={`w-full rounded-none border ${isMarked ? (isEnemy ? "border-amber-300" : "border-emerald-300") : getUnitBorderClass(unit.color)} bg-black/55 ring-0 ${isBenched ? "opacity-60" : ""}`}
        onClick={() => {
          if (!isDead && !isBenched) {
            onMark(unit.instanceId);
          }
        }}
      >
        <CardHeader className="flex items-center justify-between gap-2 border-b border-zinc-800 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {getCharacterArt(unit.id) ? (
              <Image
                src={getCharacterArt(unit.id)!}
                alt={unit.name}
                width={48}
                height={48}
                className={`h-7 w-7 shrink-0 border border-zinc-700 object-cover object-top ${isDead ? "grayscale" : ""}`}
              />
            ) : null}
            <CardTitle className="truncate font-heading text-base tracking-[0.06em] text-zinc-100">
              {unit.name}
            </CardTitle>
            {isBenched ? (
              <Badge className="rounded-none bg-amber-300 px-1 py-0 font-body text-[9px] font-bold uppercase tracking-widest text-zinc-950">
                Sub
              </Badge>
            ) : null}
            {isMarked ? (
              <Badge
                variant="outline"
                className={`rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest ${isEnemy ? "border-amber-300 bg-amber-300/10 text-amber-200" : "border-emerald-300 bg-emerald-300/10 text-emerald-200"}`}
              >
                Target
              </Badge>
            ) : null}
            {queuedHits > 0 ? (
              <Badge
                variant="outline"
                className="rounded-none border-sky-300 bg-sky-500/15 px-1 py-0 font-body text-[9px] uppercase tracking-widest text-sky-100"
              >
                {queuedHits}×
              </Badge>
            ) : null}
          </div>

          <Button
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(unit);
            }}
            className="shrink-0 rounded-none border border-zinc-700 px-1.5 text-[9px] uppercase tracking-widest text-zinc-300"
          >
            Info
          </Button>
        </CardHeader>

        <CardContent
          className={`space-y-1.5 px-2.5 py-2 ${isDead ? "opacity-55" : ""}`}
        >
          <div>
            <div className="mb-0.5 flex items-center justify-between font-body text-[10px] uppercase tracking-[0.1em] text-zinc-400">
              <span>HP</span>
              <span>
                {unit.currentHP}/{unit.hp}
              </span>
            </div>
            <Progress
              value={hpPercent}
              className={
                isDead || hpPercent < 30
                  ? "**:data-[slot=progress-indicator]:bg-red-500"
                  : "**:data-[slot=progress-indicator]:bg-emerald-500"
              }
            />
          </div>

          <div className="flex items-center justify-between gap-1 font-body text-[10px] uppercase tracking-wider text-zinc-400">
            <span>
              <span className="text-zinc-600">ATK </span>
              <span className="font-semibold text-zinc-200">
                {unit.currentAttack}
              </span>
            </span>
            <span>
              <span className="text-zinc-600">DEF </span>
              <span className="font-semibold text-zinc-200">
                {unit.currentDefense}
              </span>
            </span>
            <span>
              <span className="text-zinc-600">ULT </span>
              <span
                className={`font-semibold ${unit.ultGauge >= 5 ? "text-amber-300" : "text-zinc-200"}`}
              >
                {unit.ultGauge}/5
              </span>
            </span>
            {(() => {
              // Ruling #30: uncancellable entries are grey "effects" — they
              // don't count as buffs/debuffs
              const buffs = unit.buffs.filter((b) => !b.uncancellable);
              const debuffs = unit.debuffs.filter((d) => !d.uncancellable);
              const effects = [
                ...unit.buffs.filter((b) => b.uncancellable),
                ...unit.debuffs.filter((d) => d.uncancellable),
              ];
              const counters = (
                <>
                  <span className="text-emerald-500">▲{buffs.length}</span>{" "}
                  <span className="text-rose-500">▼{debuffs.length}</span>
                  {effects.length > 0 ? (
                    <>
                      {" "}
                      <span className="text-zinc-400">◆{effects.length}</span>
                    </>
                  ) : null}
                </>
              );
              if (
                buffs.length === 0 &&
                debuffs.length === 0 &&
                effects.length === 0
              ) {
                return <span>{counters}</span>;
              }
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help underline decoration-dotted underline-offset-2">
                      {counters}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <span className="block space-y-0.5 font-body text-xs normal-case tracking-normal">
                      {buffs.map((effect, idx) => (
                        <span
                          key={`b-${effect.type}-${idx}`}
                          className="block text-emerald-300"
                        >
                          ▲ {effect.name ?? describeEffect(effect)}
                          {effect.name ? ` — ${describeEffect(effect)}` : ""}
                        </span>
                      ))}
                      {debuffs.map((effect, idx) => (
                        <span
                          key={`d-${effect.type}-${idx}`}
                          className="block text-rose-300"
                        >
                          ▼ {effect.name ?? describeEffect(effect)}
                          {effect.name ? ` — ${describeEffect(effect)}` : ""}
                        </span>
                      ))}
                      {effects.map((effect, idx) => (
                        <span
                          key={`e-${effect.type}-${idx}`}
                          className="block text-zinc-400"
                        >
                          ◆ {effect.name ?? describeEffect(effect)}
                          {effect.name ? ` — ${describeEffect(effect)}` : ""}
                        </span>
                      ))}
                    </span>
                  </TooltipContent>
                </Tooltip>
              );
            })()}
          </div>
        </CardContent>
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
    selectedAllyMarker,
    battleLog,
    interactionNotice,
    battleSpeed,
    setBattleSpeed,
    setEnemyMarker,
    setAllyMarker,
    clearInteractionNotice,
    actionQueue,
    resetBattle,
  } = useGameStore();

  const { resolveEnemyTurnWrapper, startCustomBattle, lastBattleConfig } =
    useBattleContext();
  const router = useRouter();
  const isBattleOver = battlePhase === "victory" || battlePhase === "defeat";

  React.useEffect(() => {
    if (battlePhase !== "EnemyAction") return;

    const timer = window.setTimeout(() => {
      resolveEnemyTurnWrapper();
    }, 450 / battleSpeed);

    return () => window.clearTimeout(timer);
  }, [battlePhase, resolveEnemyTurnWrapper, battleSpeed]);

  const phaseLabel = formatPhaseLabel(battlePhase);
  const [detailUnit, setDetailUnit] = React.useState<BattleCharacter | null>(
    null,
  );
  const [showAllEvents, setShowAllEvents] = React.useState(false);

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

  // Playtest request: dump the full match (teams + every event) to
  // <project>/battle-log/ for post-battle debugging
  const [logSaveResult, setLogSaveResult] = React.useState<string | null>(
    null,
  );
  // Clear the save receipt when a new battle starts (adjust-during-render
  // pattern — the overlay component persists across rematches)
  const [wasBattleOver, setWasBattleOver] = React.useState(isBattleOver);
  if (wasBattleOver !== isBattleOver) {
    setWasBattleOver(isBattleOver);
    if (!isBattleOver) setLogSaveResult(null);
  }
  const saveBattleLog = async () => {
    const stamp = new Date()
      .toISOString()
      .replace(/[:T]/g, "-")
      .slice(0, 19);
    const unitLine = (u: BattleCharacter) =>
      `  ${u.name} (${u.id})${u.isSub ? " [sub]" : ""} — HP ${u.currentHP}/${u.hp}, ATK ${u.currentAttack}, DEF ${u.currentDefense}, ULT ${u.ultGauge}/5`;
    const content = [
      `Battle log — ${new Date().toString()}`,
      `Result: ${battlePhase.toUpperCase()} on turn ${currentTurn + 1} (${playerTurns} player / ${enemyTurns} enemy turns resolved)`,
      "",
      "Player team (final state):",
      ...playerTeam.map(unitLine),
      "Enemy team (final state):",
      ...enemyTeam.map(unitLine),
      "",
      `--- Full event log (${battleLog.length} entries) ---`,
      ...battleLog,
      "",
    ].join("\n");
    try {
      const res = await fetch("/api/battle-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: `battle_${stamp}`, content }),
      });
      const data = await res.json();
      setLogSaveResult(res.ok ? `Saved to ${data.saved}` : "Save failed");
    } catch {
      setLogSaveResult("Save failed");
    }
  };

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
        <Card className="rounded-none border-2 border-zinc-700 bg-black/45 ring-0">
          <CardContent className="grid gap-4 px-5 py-4 md:grid-cols-4 md:items-end">
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

            <div className="grid grid-cols-4 gap-2 font-body text-xs uppercase tracking-[0.14em] text-zinc-300 md:col-span-2">
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
              <button
                type="button"
                onClick={() => setBattleSpeed(battleSpeed === 1 ? 2 : 1)}
                className={`cursor-pointer border px-3 py-2 text-center uppercase tracking-[0.14em] transition-colors ${battleSpeed === 2 ? "border-amber-300 bg-amber-300/10 text-amber-200" : "border-zinc-700 bg-zinc-900/60 text-zinc-300"}`}
              >
                <span className="block text-zinc-500">Speed</span>
                <span className="font-semibold">{battleSpeed}×</span>
              </button>
            </div>
          </CardContent>
        </Card>

        <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_330px]">
          <div className="grid gap-5">
            <Card className="rounded-none border border-zinc-700 bg-black/45 ring-0">
              <CardHeader className="border-b border-zinc-800 px-5 py-4">
                <CardTitle className="font-heading text-2xl tracking-widest text-zinc-100">
                  Enemy Team
                </CardTitle>
                <CardDescription className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Select a target for queued attacks
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
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
              </CardContent>
            </Card>

            <Card className="rounded-none border border-zinc-700 bg-black/45 ring-0">
              <CardHeader className="border-b border-zinc-800 px-5 py-4">
                <CardTitle className="font-heading text-2xl tracking-widest text-zinc-100">
                  Player Team
                </CardTitle>
                <CardDescription className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Select a target for single-ally buffs and heals
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                {playerTeam.map((unit) => (
                  <TeamUnitCard
                    key={unit.instanceId}
                    unit={unit}
                    isEnemy={false}
                    isMarked={selectedAllyMarker === unit.instanceId}
                    queuedHits={queuedHitCountByEnemy[unit.instanceId] || 0}
                    onMark={setAllyMarker}
                    onViewDetails={setDetailUnit}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          <aside className="grid content-start gap-5 lg:sticky lg:top-5">
            <Card className="rounded-none border border-zinc-700 bg-black/45 ring-0">
              <CardHeader className="flex flex-col items-start gap-3 border-b border-zinc-800 px-5 py-4">
                <div>
                  <CardTitle className="font-heading text-2xl tracking-widest text-zinc-100">
                    Action Console
                  </CardTitle>
                  <CardDescription className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                    Standardized action feed.
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="grid gap-4 p-4">
                <div className="border border-zinc-800 bg-zinc-950/45 p-3">
                  {interactionNotice ? (
                    <div className="mb-3 flex items-center justify-between gap-2 border border-red-400/60 bg-red-900/35 px-3 py-2">
                      <p className="font-body text-xs uppercase tracking-[0.12em] text-red-100">
                        {interactionNotice}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearInteractionNotice}
                        className="rounded-none border border-red-300/70 px-2 text-[11px] uppercase tracking-widest text-red-100"
                      >
                        Dismiss
                      </Button>
                    </div>
                  ) : null}

                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Recent Battle Events
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAllEvents((prev) => !prev)}
                      className={`cursor-pointer border px-2 py-0.5 font-body text-[10px] uppercase tracking-widest transition-colors ${showAllEvents ? "border-amber-300 bg-amber-300/10 text-amber-200" : "border-zinc-700 text-zinc-400"}`}
                    >
                      {showAllEvents ? "All events" : "Actions only"}
                    </button>
                  </div>
                  <div className="max-h-65 space-y-1 overflow-y-auto pr-1 font-body text-sm text-zinc-200">
                    {((showAllEvents ? battleLog : actionLog).length > 0
                      ? (showAllEvents ? battleLog : actionLog)
                          .slice(-20)
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
              </CardContent>
            </Card>
          </aside>
        </section>
      </section>

      {isBattleOver ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <Card
            className={`w-full max-w-md rounded-none border-2 ${battlePhase === "victory" ? "border-amber-300" : "border-red-500"} bg-zinc-950/95 ring-0`}
          >
            <CardHeader className="border-b border-zinc-800 px-6 py-6 text-center">
              <CardTitle
                className={`font-heading text-6xl tracking-[0.16em] ${battlePhase === "victory" ? "text-amber-300" : "text-red-400"}`}
              >
                {battlePhase === "victory" ? "VICTORY" : "DEFEAT"}
              </CardTitle>
              <CardDescription className="mt-2 font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                Turn {currentTurn + 1} • {playerTurns} player /{" "}
                {enemyTurns} enemy actions resolved
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-6 py-6">
              {lastBattleConfig ? (
                <Button
                  onClick={() =>
                    startCustomBattle(
                      lastBattleConfig.playerPicks,
                      lastBattleConfig.enemyPicks,
                    )
                  }
                  className="h-12 rounded-none border-2 border-amber-300 font-heading text-lg tracking-[0.14em]"
                >
                  REMATCH
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={saveBattleLog}
                className="h-12 rounded-none border-2 border-sky-400 bg-transparent font-heading text-lg tracking-[0.14em] text-sky-200"
              >
                SAVE BATTLE LOG
              </Button>
              {logSaveResult ? (
                <p className="text-center font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                  {logSaveResult}
                </p>
              ) : null}
              <Button
                variant="outline"
                onClick={resetBattle}
                className="h-12 rounded-none border-2 border-zinc-400 bg-transparent font-heading text-lg tracking-[0.14em] text-zinc-100"
              >
                CHANGE TEAMS
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  resetBattle();
                  router.push("/");
                }}
                className="h-12 rounded-none border-2 border-zinc-700 font-heading text-lg tracking-[0.14em] text-zinc-300"
              >
                MAIN MENU
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {detailUnit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <Card className="w-full max-w-2xl rounded-none border border-zinc-600 bg-zinc-950/95 ring-0">
            <CardHeader className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
              <div>
                <CardTitle className="font-heading text-2xl tracking-[0.08em] text-zinc-100">
                  {detailUnit.name}
                </CardTitle>
                <CardDescription className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                  Full active status details
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                onClick={() => setDetailUnit(null)}
                className="rounded-none border border-zinc-600 text-xs uppercase tracking-widest"
              >
                Close
              </Button>
            </CardHeader>

            <CardContent className="grid gap-4 px-5 py-4 md:grid-cols-2">
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
                    {detailUnit.buffs.some((b) => !b.uncancellable) ? (
                      detailUnit.buffs
                        .filter((b) => !b.uncancellable)
                        .map((effect, idx) => (
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
                    {detailUnit.debuffs.some((d) => !d.uncancellable) ? (
                      detailUnit.debuffs
                        .filter((d) => !d.uncancellable)
                        .map((effect, idx) => (
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

                {[...detailUnit.buffs, ...detailUnit.debuffs].some(
                  (e) => e.uncancellable,
                ) ? (
                  <div>
                    <p className="mb-1 font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                      Effects
                    </p>
                    <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                      {[...detailUnit.buffs, ...detailUnit.debuffs]
                        .filter((e) => e.uncancellable)
                        .map((effect, idx) => (
                          <p
                            key={`effect-${effect.type}-${idx}`}
                            className="border border-zinc-600/60 bg-zinc-900/50 px-2 py-1 font-body text-xs text-zinc-300"
                          >
                            {describeEffect(effect)}
                          </p>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}

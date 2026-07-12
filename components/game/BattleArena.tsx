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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { useBattleContext } from "@/hooks/BattleProvider";
import type { BattleCharacter } from "@/types/character";
import type { Color } from "@/types/color";
import BattleEffectsOverlay from "@/components/game/BattleEffectsOverlay";
import {
  useBattleSequencer,
  type SequencerFlash,
} from "@/hooks/useBattleSequencer";

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
  // Decay/DoT carry their per-turn hit in capturedDamage (decay) or value
  // (Bleed/Shock) rather than a percent — surface it so the tooltip never
  // reads "no numeric value" for a damage-over-time effect.
  const perTurnDamage =
    effect.capturedDamage !== undefined
      ? effect.capturedDamage
      : effect.type === "decay" || effect.type === "damageOverTime"
        ? effect.value
        : undefined;
  const valueText =
    perTurnDamage !== undefined
      ? `${perTurnDamage}/turn`
      : effect.valuePercent !== undefined
        ? `${effect.valuePercent}%`
        : effect.value !== undefined
          ? `${effect.value}`
          : "";
  const statText =
    effect.stat && perTurnDamage === undefined ? ` ${effect.stat}` : "";
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

function EffectCounters({
  unit,
}: {
  unit: BattleCharacter;
}): React.JSX.Element {
  // Ruling #30: uncancellable entries are grey "effects" — they don't count
  // as buffs/debuffs
  const buffs = unit.buffs.filter((b) => !b.uncancellable);
  const debuffs = unit.debuffs.filter((d) => !d.uncancellable);
  const effects = [
    ...unit.buffs.filter((b) => b.uncancellable),
    ...unit.debuffs.filter((d) => d.uncancellable),
  ];
  const counters = (
    <>
      {buffs.length > 0 ? (
        <span className="text-emerald-400">▲{buffs.length}</span>
      ) : null}
      {debuffs.length > 0 ? (
        <span className="text-rose-400">▼{debuffs.length}</span>
      ) : null}
      {effects.length > 0 ? (
        <span className="text-zinc-400">◆{effects.length}</span>
      ) : null}
    </>
  );
  if (buffs.length === 0 && debuffs.length === 0 && effects.length === 0) {
    return <span />;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex cursor-help items-center gap-1 font-body text-[10px]">
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
}

const FLASH_TINTS: Record<Color, string> = {
  red: "rgba(244,63,94,0.55)",
  blue: "rgba(56,189,248,0.55)",
  green: "rgba(52,211,153,0.5)",
  dark: "rgba(167,139,250,0.55)",
  light: "rgba(252,211,77,0.55)",
};

interface TileFx {
  hpOverride?: number;
  shaking?: boolean;
  evading?: boolean;
  flash?: SequencerFlash;
}

function TeamUnitTile({
  unit,
  isEnemy,
  isMarked,
  queuedHits,
  fx,
  onMark,
  onViewDetails,
}: {
  unit: BattleCharacter;
  isEnemy: boolean;
  isMarked: boolean;
  queuedHits: number;
  fx: TileFx;
  onMark: (instanceId: string) => void;
  onViewDetails: (unit: BattleCharacter) => void;
}): React.JSX.Element {
  // During playback the sequencer feeds exact per-event HP snapshots so the
  // bar (and the DOWN stamp) land at the impact moment, not at resolve time
  const displayHP = fx.hpOverride ?? unit.currentHP;
  const hpPercent = unit.hp > 0 ? Math.max(0, (displayHP / unit.hp) * 100) : 0;
  const isDead = displayHP <= 0;
  const isBenched = unit.isSub === true;
  const art = getCharacterArt(unit.id);
  const markColorClass = isEnemy
    ? "border-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.45)]"
    : "border-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.45)]";

  return (
    <div
      data-battle-instance={unit.instanceId}
      className={`relative min-h-0 h-full ${fx.shaking ? "battle-shake" : ""} ${fx.evading ? "battle-evade" : ""}`}
    >
      <div
        onClick={() => {
          if (!isDead && !isBenched) {
            onMark(unit.instanceId);
          }
        }}
        className={`flex h-full min-h-0 flex-col overflow-hidden border-2 bg-black/55 transition-colors ${isMarked ? markColorClass : getUnitBorderClass(unit.color)} ${isBenched ? "opacity-60" : ""} ${isDead || isBenched ? "cursor-default" : "cursor-pointer"}`}
      >
        {/* Portrait */}
        <div className="relative min-h-0 flex-1 overflow-hidden bg-zinc-900/60">
          {art ? (
            <Image
              src={art}
              alt={unit.name}
              fill
              sizes="220px"
              className={`object-cover object-top ${isDead ? "grayscale" : ""}`}
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center font-heading text-4xl text-white/80">
              {unit.name.charAt(0).toUpperCase()}
            </span>
          )}

          <div className="absolute left-1 top-1 flex flex-wrap gap-1">
            {isBenched ? (
              <Badge className="rounded-none bg-amber-300 px-1 py-0 font-body text-[9px] font-bold uppercase tracking-widest text-zinc-950">
                Sub
              </Badge>
            ) : null}
            {isMarked ? (
              <Badge
                variant="outline"
                className={`rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest backdrop-blur-sm ${isEnemy ? "border-amber-300 bg-amber-300/20 text-amber-100" : "border-emerald-300 bg-emerald-300/20 text-emerald-100"}`}
              >
                Target
              </Badge>
            ) : null}
            {queuedHits > 0 ? (
              <Badge
                variant="outline"
                className="rounded-none border-sky-300 bg-sky-500/25 px-1 py-0 font-body text-[9px] uppercase tracking-widest text-sky-100 backdrop-blur-sm"
              >
                {queuedHits}×
              </Badge>
            ) : null}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(unit);
            }}
            className="absolute right-1 top-1 cursor-pointer border border-zinc-500/80 bg-black/60 px-1 py-0.5 font-body text-[9px] uppercase tracking-widest text-zinc-200 backdrop-blur-sm transition-colors hover:border-zinc-300 hover:text-white"
          >
            Info
          </button>

          {isDead ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="border border-red-500/80 bg-red-950/70 px-2 py-0.5 font-heading text-sm tracking-[0.2em] text-red-300">
                DOWN
              </span>
            </div>
          ) : null}

          {fx.flash ? (
            <motion.div
              key={fx.flash.key}
              initial={{ opacity: fx.flash.strong ? 1 : 0.75 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.38, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(75% 75% at 50% 45%, ${FLASH_TINTS[fx.flash.color]}, transparent 78%)`,
              }}
            >
              <div
                className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rotate-[24deg] bg-white/80"
                style={{ display: fx.flash.strong ? undefined : "none" }}
              />
            </motion.div>
          ) : null}
        </div>

        {/* Status bar */}
        <div
          className={`shrink-0 space-y-1 border-t border-zinc-800 bg-black/75 px-1.5 py-1 ${isDead ? "opacity-60" : ""}`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="truncate font-heading text-xs tracking-[0.06em] text-zinc-100">
              {unit.name}
            </span>
            <EffectCounters unit={unit} />
          </div>

          <div>
            <div className="h-1.5 w-full overflow-hidden border border-zinc-700/80 bg-zinc-900">
              <div
                className={`h-full transition-[width] duration-300 ${isDead || hpPercent < 30 ? "bg-red-500" : "bg-emerald-500"}`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
            <div className="mt-0.5 flex items-center justify-between font-body text-[9px] uppercase tracking-[0.08em] text-zinc-400">
              <span>
                {displayHP}/{unit.hp}
              </span>
              <span className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-2.5 -skew-x-12 ${i < unit.ultGauge ? (unit.ultGauge >= 5 ? "bg-amber-300 shadow-[0_0_5px_rgba(252,211,77,0.8)]" : "bg-amber-500/80") : "bg-zinc-700"}`}
                  />
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Story mode swaps the result screen's actions for chapter-flow ones */
export interface StoryBattleHandlers {
  /** Victory → return to the story reader for the outro scenes */
  onContinue: () => void;
  /** Defeat → restart the same canon battle */
  onRetry: () => void;
  /** Defeat → abandon and go back to the chapter list */
  onQuit: () => void;
}

export default function BattleArena({
  story,
}: {
  story?: StoryBattleHandlers;
} = {}): React.JSX.Element {
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
  const arenaRef = React.useRef<HTMLDivElement | null>(null);
  const { view: seq, skip: skipPlayback } = useBattleSequencer(arenaRef);
  const isBattleOver = battlePhase === "victory" || battlePhase === "defeat";
  // Hold the result screen until the cinematic finishes (skip jumps ahead)
  const showBattleOver = isBattleOver && !seq.active;

  const tileFx = (instanceId: string): TileFx => ({
    hpOverride: seq.hpOverrides[instanceId],
    shaking: seq.shaking[instanceId],
    evading: seq.evading[instanceId],
    flash: seq.flashes[instanceId],
  });

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
  const [isLogOpen, setIsLogOpen] = React.useState(false);
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
  // Action lines are visualized by the sequencer + ticker; keep the toast
  // overlay for DoT ticks, passive procs and phase pulses only
  const overlayLog = React.useMemo(
    () => battleLog.filter((entry) => !entry.startsWith("[Action] ")),
    [battleLog],
  );
  const latestAction =
    actionLog.length > 0
      ? actionLog[actionLog.length - 1].replace(/^\[Action\]\s*/, "")
      : "No battle events yet.";

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
    // No z-index here: it would trap the fixed drawer/overlay children in a
    // stacking context below the sticky TopNav (z-50)
    <div ref={arenaRef} className="relative flex min-h-0 flex-1 flex-col">
      <BattleEffectsOverlay
        battleLog={overlayLog}
        battlePhase={battlePhase}
        units={[...playerTeam, ...enemyTeam].map((unit) => ({
          instanceId: unit.instanceId,
          name: unit.name,
        }))}
      />

      {/* Cinematic layer: lunge ghost, ult cut-in, damage floaters */}
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
        <AnimatePresence>
          {seq.ghost ? (
            <motion.div
              key={`ghost-${seq.ghost.key}`}
              initial={{
                x: seq.ghost.fromX - 28,
                y: seq.ghost.fromY - 28,
                opacity: 0.35,
                scale: 0.85,
              }}
              animate={{
                x: seq.ghost.toX - 28,
                y: seq.ghost.toY - 28,
                opacity: 1,
                scale: seq.ghost.isUlt ? 1.35 : 1.1,
              }}
              exit={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.26 / battleSpeed, ease: "easeIn" }}
              className="absolute left-0 top-0"
            >
              <div
                className={`h-14 w-14 overflow-hidden rounded-full border-2 ${seq.ghost.isUlt ? "border-amber-300 shadow-[0_0_24px_rgba(252,211,77,0.9)]" : "border-white/80 shadow-[0_0_14px_rgba(255,255,255,0.5)]"}`}
              >
                {getCharacterArt(seq.ghost.characterId) ? (
                  <Image
                    src={getCharacterArt(seq.ghost.characterId)!}
                    alt=""
                    width={56}
                    height={56}
                    className="h-full w-full object-cover object-top"
                  />
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {seq.cutIn ? (
            <motion.div
              key={`cutin-${seq.cutIn.key}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 / battleSpeed }}
              className="absolute inset-0 bg-black/65"
            >
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.3 / battleSpeed, ease: "easeOut" }}
                className="absolute inset-x-0 top-1/2 flex h-32 -translate-y-1/2 items-center gap-4 overflow-hidden border-y-2 border-amber-300 bg-linear-to-r from-amber-950/95 via-zinc-950/95 to-amber-950/95 px-6"
              >
                {getCharacterArt(seq.cutIn.characterId) ? (
                  <Image
                    src={getCharacterArt(seq.cutIn.characterId)!}
                    alt={seq.cutIn.name}
                    width={220}
                    height={220}
                    className="h-40 w-28 shrink-0 border-2 border-amber-300/70 object-cover object-top shadow-[0_0_30px_rgba(252,211,77,0.6)]"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="font-body text-xs uppercase tracking-[0.3em] text-amber-200/80">
                    {seq.cutIn.name} — Ultimate
                  </p>
                  <p className="truncate font-heading text-4xl tracking-[0.1em] text-amber-100 drop-shadow-[0_0_12px_rgba(252,211,77,0.8)]">
                    {seq.cutIn.skillName}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {seq.floaters.map((floater) => (
            <motion.div
              key={`floater-${floater.key}`}
              initial={{ opacity: 0, y: 6, scale: 0.85 }}
              animate={{ opacity: 1, y: -26, scale: 1 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.5 / battleSpeed, ease: "easeOut" }}
              className={`absolute -translate-x-1/2 border px-2 py-0.5 font-heading tracking-[0.06em] shadow-xl ${
                floater.kind === "crit"
                  ? "border-amber-300 bg-amber-950/85 text-2xl text-amber-200"
                  : floater.kind === "damage"
                    ? "border-red-300/70 bg-red-950/80 text-xl text-red-200"
                    : floater.kind === "counter"
                      ? "border-orange-300/70 bg-orange-950/80 text-lg text-orange-200"
                      : floater.kind === "heal"
                        ? "border-emerald-300/70 bg-emerald-950/80 text-xl text-emerald-200"
                        : floater.kind === "evade"
                          ? "border-sky-300/70 bg-sky-950/80 text-lg text-sky-200"
                          : "border-amber-300/70 bg-zinc-950/85 text-sm text-amber-100"
              }`}
              style={{ left: floater.x, top: floater.y }}
            >
              {floater.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {seq.active ? (
        <button
          type="button"
          onClick={skipPlayback}
          className="absolute bottom-10 right-3 z-30 cursor-pointer border border-zinc-500 bg-black/75 px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.16em] text-zinc-200 backdrop-blur-sm transition-colors hover:border-amber-300 hover:text-amber-200"
        >
          Skip ▸▸
        </button>
      ) : null}

      {/* Slim status strip */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-black/60 px-3 py-1.5 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 font-heading text-base tracking-[0.12em] text-zinc-100">
            TURN {currentTurn + 1}
          </span>
          <span className="truncate font-body text-xs uppercase tracking-[0.16em] text-amber-200">
            {phaseLabel}
          </span>
          <div className="hidden h-1.5 w-28 shrink-0 overflow-hidden border border-zinc-700 bg-zinc-900/70 sm:block">
            <motion.div
              className="h-full bg-linear-to-r from-amber-300 via-orange-400 to-yellow-300"
              initial={{ width: 0 }}
              animate={{ width: `${phaseProgress}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 font-body text-[11px] uppercase tracking-[0.12em]">
          <span className="hidden text-zinc-500 md:inline">
            Player {playerTurns} • Enemy {enemyTurns}
          </span>
          <button
            type="button"
            onClick={() => setBattleSpeed(battleSpeed === 1 ? 2 : 1)}
            className={`cursor-pointer border px-2 py-1 transition-colors ${battleSpeed === 2 ? "border-amber-300 bg-amber-300/10 text-amber-200" : "border-zinc-700 bg-zinc-900/60 text-zinc-300"}`}
          >
            {battleSpeed}× Speed
          </button>
          <button
            type="button"
            onClick={() => setIsLogOpen(true)}
            className="cursor-pointer border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
          >
            Log
          </button>
        </div>
      </header>

      {/* Battlefield: both teams always visible */}
      <section className="grid min-h-0 flex-1 grid-rows-2 gap-1.5 px-3 py-1.5">
        <div className="flex min-h-0 flex-col">
          <p className="mb-1 shrink-0 font-body text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Enemy{" "}
            <span className="text-zinc-600">
              — click to focus fire (optional; unmarked attacks pick randomly)
            </span>
          </p>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            {enemyTeam.map((unit) => (
              <TeamUnitTile
                key={unit.instanceId}
                unit={unit}
                isEnemy
                isMarked={selectedEnemyMarker === unit.instanceId}
                queuedHits={queuedHitCountByEnemy[unit.instanceId] || 0}
                fx={tileFx(unit.instanceId)}
                onMark={setEnemyMarker}
                onViewDetails={setDetailUnit}
              />
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <p className="mb-1 shrink-0 font-body text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Player{" "}
            <span className="text-zinc-600">
              — click to target ally buffs/heals
            </span>
          </p>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            {playerTeam.map((unit) => (
              <TeamUnitTile
                key={unit.instanceId}
                unit={unit}
                isEnemy={false}
                isMarked={selectedAllyMarker === unit.instanceId}
                queuedHits={queuedHitCountByEnemy[unit.instanceId] || 0}
                fx={tileFx(unit.instanceId)}
                onMark={setAllyMarker}
                onViewDetails={setDetailUnit}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Event ticker (click for full log) */}
      <div className="shrink-0 border-t border-zinc-800 bg-black/60 px-3 py-1 backdrop-blur-sm">
        {interactionNotice ? (
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-body text-xs uppercase tracking-[0.1em] text-red-200">
              {interactionNotice}
            </p>
            <button
              type="button"
              onClick={clearInteractionNotice}
              className="shrink-0 cursor-pointer border border-red-300/70 px-2 py-0.5 font-body text-[10px] uppercase tracking-widest text-red-100"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsLogOpen(true)}
            className="block w-full cursor-pointer truncate text-left font-body text-xs text-zinc-300 transition-colors hover:text-zinc-100"
          >
            <span className="mr-1.5 text-amber-300">►</span>
            {latestAction}
          </button>
        )}
      </div>

      {/* Full log drawer */}
      <AnimatePresence>
        {isLogOpen ? (
          <>
            <motion.div
              key="log-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setIsLogOpen(false)}
              className="fixed inset-0 z-40 bg-black/50"
            />
            <motion.aside
              key="log-drawer"
              initial={{ x: 360 }}
              animate={{ x: 0 }}
              exit={{ x: 360 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed right-0 top-0 z-50 flex h-dvh w-[340px] max-w-[90vw] flex-col border-l border-zinc-700 bg-zinc-950/95 backdrop-blur-md"
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
                <p className="font-heading text-lg tracking-[0.12em] text-zinc-100">
                  BATTLE LOG
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAllEvents((prev) => !prev)}
                    className={`cursor-pointer border px-2 py-0.5 font-body text-[10px] uppercase tracking-widest transition-colors ${showAllEvents ? "border-amber-300 bg-amber-300/10 text-amber-200" : "border-zinc-700 text-zinc-400"}`}
                  >
                    {showAllEvents ? "All events" : "Actions only"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLogOpen(false)}
                    className="cursor-pointer border border-zinc-700 px-2 py-0.5 font-body text-[10px] uppercase tracking-widest text-zinc-300 hover:border-zinc-500"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3 font-body text-sm text-zinc-200">
                {((showAllEvents ? battleLog : actionLog).length > 0
                  ? [...(showAllEvents ? battleLog : actionLog)]
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
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {showBattleOver ? (
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
              {story && battlePhase === "victory" ? (
                <Button
                  onClick={story.onContinue}
                  className="h-12 rounded-none border-2 border-amber-300 font-heading text-lg tracking-[0.14em]"
                >
                  CONTINUE STORY
                </Button>
              ) : null}
              {story && battlePhase === "defeat" ? (
                <>
                  <Button
                    onClick={story.onRetry}
                    className="h-12 rounded-none border-2 border-amber-300 font-heading text-lg tracking-[0.14em]"
                  >
                    RETRY BATTLE
                  </Button>
                  <Button
                    variant="outline"
                    onClick={story.onQuit}
                    className="h-12 rounded-none border-2 border-zinc-400 bg-transparent font-heading text-lg tracking-[0.14em] text-zinc-100"
                  >
                    BACK TO CHAPTERS
                  </Button>
                </>
              ) : null}
              {!story && lastBattleConfig ? (
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
              {!story ? (
                <>
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
                </>
              ) : null}
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
    </div>
  );
}

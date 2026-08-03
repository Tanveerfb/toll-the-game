"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnimatePresence, m } from "framer-motion";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { useBattleContext } from "@/hooks/BattleProvider";
import type { BattleCharacter } from "@/types/character";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getVfxShape, getVfxTint, vfxShapeStyle } from "@/lib/game/characterVfx";
import { FLASH_TINTS } from "@/lib/game/elementSwatch";
import BattleEffectsOverlay from "@/components/game/BattleEffectsOverlay";
import TeamUnitTile, {
  type TileFx,
} from "@/components/game/battle/TeamUnitTile";
import TeamDetailsList from "@/components/game/battle/TeamDetailsList";
import UnitDetailPanel from "@/components/game/battle/UnitDetailPanel";
import BattleLogDrawer from "@/components/game/battle/BattleLogDrawer";
import { formatBattleLogMarkdown } from "@/lib/game/battleLogMarkdown";
import { useBattleSequencer } from "@/hooks/useBattleSequencer";

/** Stable no-op so the memoized player tiles don't re-render every frame on a
 *  fresh inline closure. Player tiles never focus-fire. */
const noop = (): void => {};

/** Portrait-stack shortcut into one side's roster list. */
function RosterButton({
  team,
  label,
  className,
  onClick,
}: {
  team: BattleCharacter[];
  label: string;
  className: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View ${label.toLowerCase()} details`}
      className={`flex min-h-11 cursor-pointer items-center gap-1.5 border border-zinc-600 bg-black/75 px-2 py-1.5 backdrop-blur-sm transition-colors ${className}`}
    >
      <div className="flex -space-x-2">
        {team.slice(0, 3).map((unit) => {
          const art = getCharacterArt(unit.id);
          return (
            <span
              key={unit.instanceId}
              className="h-6 w-6 overflow-hidden rounded-full border border-zinc-500 bg-zinc-800"
            >
              {art ? (
                <Image
                  src={art}
                  alt=""
                  width={24}
                  height={24}
                  className={`h-full w-full object-cover object-top ${unit.currentHP <= 0 ? "grayscale" : ""}`}
                />
              ) : null}
            </span>
          );
        })}
      </div>
      <span className="font-body text-[10px] uppercase tracking-[0.14em] text-zinc-300">
        {label}
      </span>
    </button>
  );
}

function formatPhaseLabel(phase: string): string {
  return phase
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/** Swaps the result screen's default actions (Rematch/Change Teams/Main Menu)
 *  for a caller-driven flow — used by both story mode (chapter progression)
 *  and the world-boss route (reward grant + stamina re-spend on retry). */
export interface BattleEndHandlers {
  /** Victory → caller-defined continuation (next story beat / reward screen) */
  onContinue: () => void;
  /** Defeat → restart (story: same canon battle; world-boss: re-spend stamina) */
  onRetry: () => void;
  /** Defeat → abandon (story: back to chapter list; world-boss: back to select) */
  onQuit: () => void;
}

export default function BattleArena({
  story,
  worldBoss,
}: {
  story?: BattleEndHandlers;
  worldBoss?: BattleEndHandlers;
} = {}): React.JSX.Element {
  const battleEnd = story ?? worldBoss;
  // Individual selectors (not a whole-store destructure) so this component —
  // the main battle render tree — only re-renders for the specific fields it
  // reads, instead of on every store mutation anywhere (HP ticks, sequencer
  // flags, etc).
  const battlePhase = useGameStore((s) => s.battlePhase);
  const currentTurn = useGameStore((s) => s.currentTurn);
  const playerTurns = useGameStore((s) => s.playerTurns);
  const enemyTurns = useGameStore((s) => s.enemyTurns);
  const playerTeam = useGameStore((s) => s.playerTeam);
  const enemyTeam = useGameStore((s) => s.enemyTeam);
  const selectedEnemyMarker = useGameStore((s) => s.selectedEnemyMarker);
  const battleLog = useGameStore((s) => s.battleLog);
  const battleEvents = useGameStore((s) => s.battleEvents);
  const interactionNotice = useGameStore((s) => s.interactionNotice);
  const phaseBreak = useGameStore((s) => s.phaseBreak);
  const clearPhaseBreak = useGameStore((s) => s.clearPhaseBreak);
  const battleSpeed = useGameStore((s) => s.battleSpeed);
  const setBattleSpeed = useGameStore((s) => s.setBattleSpeed);
  const setEnemyMarker = useGameStore((s) => s.setEnemyMarker);
  const clearInteractionNotice = useGameStore((s) => s.clearInteractionNotice);
  const actionQueue = useGameStore((s) => s.actionQueue);
  const deck = useGameStore((s) => s.deck);
  const enemyDeck = useGameStore((s) => s.enemyDeck);
  const pendingAllyCardId = useGameStore((s) => s.pendingAllyCardId);
  const confirmAllyTarget = useGameStore((s) => s.confirmAllyTarget);
  const cancelAllyTarget = useGameStore((s) => s.cancelAllyTarget);
  const resetBattle = useGameStore((s) => s.resetBattle);
  const setBattlePhase = useGameStore((s) => s.setBattlePhase);
  const bigHitFocus = useGameStore((s) => s.bigHitFocus);

  // Exit Battle (player-initiated forfeit) — ends the fight as a loss. Ordinary
  // reloads resume the battle (persistence); this is the deliberate way out.
  const confirmExitBattle = (): void => {
    setIsExitConfirmOpen(false);
    setBattlePhase("defeat");
  };

  const pendingAllyCard = pendingAllyCardId
    ? deck.find((c) => c.id === pendingAllyCardId)
    : undefined;

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

  // Auto-dismiss the phase-break flourish after it plays
  React.useEffect(() => {
    if (!phaseBreak) return;
    const t = window.setTimeout(
      () => clearPhaseBreak(),
      1800 / battleSpeed,
    );
    return () => window.clearTimeout(t);
  }, [phaseBreak, clearPhaseBreak, battleSpeed]);

  const phaseLabel = formatPhaseLabel(battlePhase);
  // Store the id and resolve the LIVE unit each render: the panel now leads
  // with HP and the effects list, so a captured snapshot would freeze while
  // the battle moved underneath it.
  const [detailUnitId, setDetailUnitId] = React.useState<string | null>(null);
  const detailUnit = detailUnitId
    ? ([...playerTeam, ...enemyTeam].find(
        (u) => u.instanceId === detailUnitId,
      ) ?? null)
    : null;
  // Which side's roster list is open. Enemies previously had no route into
  // the detail panel at all, even though the panel always handled them.
  const [rosterSide, setRosterSide] = React.useState<"player" | "enemy" | null>(
    null,
  );
  // Tap-to-inspect, identical on both rows — including the status-chip strip,
  // which used to open a second overlay answering the same
  // question the detail panel answers. The detail panel now leads with the
  // effects list, so there is one destination instead of two.
  const openDetail = React.useCallback(
    (unit: BattleCharacter) => setDetailUnitId(unit.instanceId),
    [setDetailUnitId],
  );
  const [isLogOpen, setIsLogOpen] = React.useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = React.useState(false);

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
    const now = new Date();
    const stamp = now.toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const content = formatBattleLogMarkdown({
      result: battlePhase,
      turn: currentTurn,
      playerTurns,
      enemyTurns,
      playerTeam,
      enemyTeam,
      events: battleEvents,
      rawLog: battleLog,
      timestamp: now.toString(),
    });
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

  // Reveal-tier screen shake (R3/ultimate): whole-arena shake, distinct from
  // the per-tile shake already applied on the hit target. Reuses the same
  // CSS classes/keyframes (and their prefers-reduced-motion opt-out).
  const screenShakeClass =
    seq.screenShake === "heavy" ? "battle-shake-strong" : "";

  return (
    // No z-index here: it would trap the fixed drawer/overlay children in a
    // stacking context below the sticky TopNav (z-50)
    <div
      ref={arenaRef}
      className={`relative flex min-h-0 flex-1 flex-col ${screenShakeClass}`}
    >
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
        {/* Ultimate cutscene dim — surrounding UI recedes while the reveal
            plays (spec §2); restored automatically once the beat ends. */}
        <AnimatePresence>
          {seq.dim ? (
            <m.div
              key="reveal-dim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 / battleSpeed }}
              className="absolute inset-0 bg-black/70"
            />
          ) : null}
        </AnimatePresence>

        {/* Stage-wide flash — R2 brightness pulse, R3 brief flash, ultimate
            full white flash. Tinted by the source's element color except
            the ultimate's full-white punch. */}
        <AnimatePresence>
          {seq.screenFlash ? (
            <m.div
              key={`screen-flash-${seq.screenFlash.key}`}
              initial={{
                opacity:
                  seq.screenFlash.kind === "white"
                    ? 0.9
                    : seq.screenFlash.kind === "brief"
                      ? 0.55
                      : 0.18,
              }}
              animate={{ opacity: 0 }}
              transition={{
                duration:
                  (seq.screenFlash.kind === "white" ? 0.5 : 0.32) / battleSpeed,
                ease: "easeOut",
              }}
              className="absolute inset-0"
              style={{
                background:
                  seq.screenFlash.kind === "white"
                    ? "#ffffff"
                    : FLASH_TINTS[seq.screenFlash.color],
              }}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {seq.ghost ? (
            <m.div
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
            </m.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {seq.cutIn ? (
            <m.div
              key={`cutin-${seq.cutIn.key}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 / battleSpeed }}
              className="absolute inset-0 bg-black/65"
            >
              {/* White flash punch on entry */}
              <m.div
                initial={{ opacity: 0.85 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.45 / battleSpeed, ease: "easeOut" }}
                className="absolute inset-0 bg-white"
              />
              <m.div
                initial={{ x: "-100%", scale: 1.12 }}
                animate={{ x: 0, scale: 1 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.3 / battleSpeed, ease: "easeOut" }}
                className="absolute inset-x-0 top-1/2 flex h-32 -translate-y-1/2 items-center gap-4 overflow-hidden border-y-2 border-amber-300 bg-linear-to-r from-amber-950/95 via-zinc-950/95 to-amber-950/95 px-6 shadow-[0_0_60px_rgba(252,211,77,0.5)]"
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
              </m.div>
            </m.div>
          ) : null}
        </AnimatePresence>

        {/* Phase-break flourish — a boss shattering into its next phase */}
        <AnimatePresence>
          {phaseBreak ? (
            <m.div
              key={`phasebreak-${phaseBreak.key}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 / battleSpeed }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <m.div
                initial={{ opacity: 0.9 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.6 / battleSpeed, ease: "easeOut" }}
                className="absolute inset-0 bg-rose-600/40"
              />
              <m.div
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.38 / battleSpeed, ease: "easeOut" }}
                className="relative flex flex-col items-center gap-1 border-y-2 border-rose-400 bg-black/70 px-12 py-5 backdrop-blur-sm"
              >
                <span className="font-body text-xs uppercase tracking-[0.4em] text-rose-200/80">
                  {phaseBreak.name}
                </span>
                <span className="font-heading text-5xl tracking-[0.16em] text-rose-100 drop-shadow-[0_0_16px_rgba(244,63,94,0.85)] md:text-6xl">
                  PHASE {phaseBreak.phase}
                </span>
              </m.div>
            </m.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {seq.floaters.map((floater) => (
            <m.div
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
            </m.div>
          ))}
        </AnimatePresence>

        {/* Impact burst rings — expand and fade at each hit point. A named
            character's VFX flavor (water/ink/flame/Red Ice, …) overrides the
            plain team-color ring with its own tint + shape. */}
        <AnimatePresence>
          {seq.bursts.map((burst) => {
            const tint = getVfxTint(burst.characterId, FLASH_TINTS[burst.color]);
            const shape = getVfxShape(burst.characterId);
            const size = burst.strong ? 84 : 58;
            return (
              <React.Fragment key={`burst-${burst.key}`}>
                <m.div
                  initial={{ opacity: 0.85, scale: 0.35 }}
                  animate={{ opacity: 0, scale: burst.strong ? 2.9 : 2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.48 / battleSpeed, ease: "easeOut" }}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: burst.x,
                    top: burst.y,
                    width: size,
                    height: size,
                    border: `${burst.strong ? 3 : 2}px solid ${tint}`,
                    boxShadow: `0 0 18px ${tint}`,
                    ...vfxShapeStyle(shape),
                  }}
                />
                {/* Water's second, slightly-delayed ring — a ripple */}
                {shape === "ripple" ? (
                  <m.div
                    initial={{ opacity: 0.6, scale: 0.2 }}
                    animate={{ opacity: 0, scale: burst.strong ? 2.2 : 1.5 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.48 / battleSpeed,
                      delay: 0.1 / battleSpeed,
                      ease: "easeOut",
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: burst.x,
                      top: burst.y,
                      width: size,
                      height: size,
                      border: `2px solid ${tint}`,
                    }}
                  />
                ) : null}
                {/* Flame's flicker — a smaller inner pulse that pops and
                    dies faster than the main ring, like a lick of fire. */}
                {shape === "flicker" ? (
                  <m.div
                    initial={{ opacity: 0.9, scale: 0.15 }}
                    animate={{ opacity: [0.9, 0.4, 0], scale: 1.1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 / battleSpeed, ease: "easeOut" }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: burst.x,
                      top: burst.y,
                      width: size * 0.55,
                      height: size * 0.55,
                      background: tint,
                      filter: "blur(2px)",
                    }}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </AnimatePresence>

        {/* Sweep — an element-colored streak across AoE targets, or (when
            `strong`) the R3/ultimate caster -> target beam: thicker, brighter,
            longer-held ("beam sweep"/"mega beam" from spec §2). */}
        <AnimatePresence>
          {seq.sweep ? (
            <m.div
              key={`sweep-${seq.sweep.key}`}
              initial={{ opacity: 0, scaleX: 0.15 }}
              animate={{ opacity: [0, 0.9, 0], scaleX: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: (seq.sweep.strong ? 0.55 : 0.4) / battleSpeed,
                ease: "easeOut",
              }}
              className={`absolute origin-left -translate-y-1/2 ${seq.sweep.strong ? "h-20" : "h-12"}`}
              style={{
                left: seq.sweep.x,
                top: seq.sweep.y,
                width: seq.sweep.width,
                background: `linear-gradient(90deg, transparent, ${getVfxTint(seq.sweep.characterId, FLASH_TINTS[seq.sweep.color])} 45%, #ffffffcc 50%, ${getVfxTint(seq.sweep.characterId, FLASH_TINTS[seq.sweep.color])} 55%, transparent)`,
                filter: seq.sweep.strong ? "blur(2px)" : "blur(1px)",
                boxShadow: seq.sweep.strong
                  ? `0 0 26px ${getVfxTint(seq.sweep.characterId, FLASH_TINTS[seq.sweep.color])}`
                  : undefined,
              }}
            />
          ) : null}
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

      {/* Roster shortcuts (Dokkan's "Next Up" stack, spec §5) — one per side.
          The enemy button is new: enemies previously had no route into the
          detail panel from anywhere on this screen. */}
      <RosterButton
        team={enemyTeam}
        label="Enemy"
        // top-14, not top-3: the status strip's Speed/Log/Exit cluster lives
        // in the top-right corner and this would sit on top of it.
        className="absolute right-3 top-14 z-30 hover:border-red-400"
        onClick={() => setRosterSide("enemy")}
      />
      <RosterButton
        team={playerTeam}
        label="Team"
        className="absolute bottom-3 right-3 z-30 hover:border-amber-300"
        onClick={() => setRosterSide("player")}
      />

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
            <m.div
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
          {!isBattleOver ? (
            <button
              type="button"
              onClick={() => setIsExitConfirmOpen(true)}
              className="cursor-pointer border border-red-500/60 bg-red-950/40 px-2 py-1 text-red-300 transition-colors hover:border-red-400 hover:text-red-200"
            >
              Exit Battle
            </button>
          ) : null}
        </div>
      </header>

      {/* Battlefield — "Balanced Stack" (spec §1): enemy row / center battle
          stage / ally row. Big-hit focus (R3/ultimate) recedes both team
          rows and lets the stage take momentary visual focus, then restores. */}
      <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-1 px-3 py-1.5">
        <div
          className={`bighit-recede flex min-h-0 flex-col transition-[opacity,transform] duration-300 ${bigHitFocus ? "scale-[0.97] opacity-50" : "scale-100 opacity-100"}`}
        >
          <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
            <p className="min-w-0 truncate font-body text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              Enemy{" "}
              <span className="text-zinc-600">
                — tap to inspect · ◎ to focus fire (optional; unmarked attacks
                pick randomly)
              </span>
            </p>
            {/* Enemy hidden deck (headless 7DS GC model): face-down cards = the
                enemy's current hand size. */}
            {enemyDeck.length > 0 ? (
              <div
                className="flex shrink-0 items-center gap-1"
                title={`Enemy hand: ${enemyDeck.length} card${enemyDeck.length > 1 ? "s" : ""}`}
              >
                <span className="font-body text-[9px] uppercase tracking-[0.16em] text-zinc-600">
                  Deck
                </span>
                {enemyDeck.slice(0, 7).map((card, i) => (
                  <span
                    key={card.id ?? i}
                    className="flex h-5 w-3.5 items-start justify-center border border-zinc-600/80 bg-linear-to-b from-zinc-800 to-zinc-950"
                  >
                    <span className="mt-1 block h-1.5 w-1.5 rotate-45 bg-amber-400/40" />
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {/* Cards are 9:16 portrait, height-capped to the row and centered;
              a lone boss just sits alone in the middle. */}
          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 overflow-hidden">
            {enemyTeam.map((unit) => (
              <div
                key={unit.instanceId}
                className="aspect-[9/16] max-h-full min-w-0 flex-1 max-w-[88px]"
              >
                <TeamUnitTile
                  unit={unit}
                  isEnemy
                  isMarked={selectedEnemyMarker === unit.instanceId}
                  queuedHits={queuedHitCountByEnemy[unit.instanceId] || 0}
                  fx={tileFx(unit.instanceId)}
                  onInspect={openDetail}
                  onMark={setEnemyMarker}
                  onOpenEffects={openDetail}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Battle stage — the focal strip where attack VFX/reveal animations
            play (ghost lunge, beams, cut-ins are already absolute-positioned
            over the whole arena; this band just gives that action a visual
            "stage" between the two team rows instead of them sitting flush). */}
        <div
          className={`bighit-recede relative flex h-6 shrink-0 items-center justify-center transition-[transform,filter] duration-300 sm:h-8 ${bigHitFocus ? "scale-x-105" : ""}`}
        >
          <div
            className={`h-px w-full bg-linear-to-r from-transparent via-amber-300/40 to-transparent transition-opacity duration-300 ${bigHitFocus ? "opacity-100" : "opacity-60"}`}
          />
          <span
            className={`absolute font-heading text-[10px] tracking-[0.4em] text-amber-200/70 transition-opacity duration-300 sm:text-xs ${bigHitFocus ? "opacity-100" : "opacity-50"}`}
          >
            VS
          </span>
        </div>

        <div
          className={`bighit-recede flex min-h-0 flex-col transition-[opacity,transform] duration-300 ${bigHitFocus ? "scale-[0.97] opacity-50" : "scale-100 opacity-100"}`}
        >
          <p className="mb-1 shrink-0 font-body text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Player <span className="text-zinc-600">— tap to inspect</span>
          </p>
          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 overflow-hidden">
            {playerTeam.map((unit) => (
              <div
                key={unit.instanceId}
                className="aspect-[9/16] max-h-full min-w-0 flex-1 max-w-[88px]"
              >
                <TeamUnitTile
                  unit={unit}
                  isEnemy={false}
                  isMarked={false}
                  queuedHits={queuedHitCountByEnemy[unit.instanceId] || 0}
                  fx={tileFx(unit.instanceId)}
                  onInspect={openDetail}
                  onMark={noop}
                  onOpenEffects={openDetail}
                />
              </div>
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

      <BattleLogDrawer
        open={isLogOpen}
        events={battleEvents}
        rawLog={battleLog}
        onClose={() => setIsLogOpen(false)}
      />

      {isExitConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm rounded-none border-2 border-red-500 bg-zinc-950/95 ring-0">
            <CardHeader className="border-b border-zinc-800 px-6 py-5 text-center">
              <CardTitle className="font-heading text-3xl tracking-[0.12em] text-red-400">
                EXIT BATTLE?
              </CardTitle>
              <CardDescription className="mt-2 font-body text-xs uppercase tracking-[0.12em] text-zinc-400">
                This counts as a loss — your progress in this fight is forfeited.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-6 py-5">
              <Button
                onClick={confirmExitBattle}
                className="h-11 rounded-none border-2 border-red-500 bg-transparent font-heading text-base tracking-[0.12em] text-red-300 hover:bg-red-500/10"
              >
                EXIT — TAKE THE LOSS
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsExitConfirmOpen(false)}
                className="h-11 rounded-none border-2 border-zinc-500 bg-transparent font-heading text-base tracking-[0.12em] text-zinc-100"
              >
                CANCEL
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

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
              {battleEnd && battlePhase === "victory" ? (
                <Button
                  onClick={battleEnd.onContinue}
                  className="h-12 rounded-none border-2 border-amber-300 font-heading text-lg tracking-[0.14em]"
                >
                  {story ? "CONTINUE STORY" : "CLAIM REWARDS"}
                </Button>
              ) : null}
              {battleEnd && battlePhase === "defeat" ? (
                <>
                  <Button
                    onClick={battleEnd.onRetry}
                    className="h-12 rounded-none border-2 border-amber-300 font-heading text-lg tracking-[0.14em]"
                  >
                    RETRY BATTLE
                  </Button>
                  <Button
                    variant="outline"
                    onClick={battleEnd.onQuit}
                    className="h-12 rounded-none border-2 border-zinc-400 bg-transparent font-heading text-lg tracking-[0.14em] text-zinc-100"
                  >
                    {story ? "BACK TO CHAPTERS" : "BACK TO WORLD BOSS"}
                  </Button>
                </>
              ) : null}
              {!battleEnd && lastBattleConfig ? (
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
              {process.env.NODE_ENV !== "production" ? (
                <>
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
                </>
              ) : null}
              {!battleEnd ? (
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
        <UnitDetailPanel
          unit={detailUnit}
          playerTeam={playerTeam}
          enemyTeam={enemyTeam}
          currentTurn={currentTurn}
          onClose={() => setDetailUnitId(null)}
        />
      ) : null}

      {rosterSide ? (
        <TeamDetailsList
          team={rosterSide === "player" ? playerTeam : enemyTeam}
          title={rosterSide === "player" ? "Team Details" : "Enemy Details"}
          onSelectUnit={(unit) => {
            setRosterSide(null);
            setDetailUnitId(unit.instanceId);
          }}
          onClose={() => setRosterSide(null)}
        />
      ) : null}

      {pendingAllyCard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
          <Card className="w-full max-w-md rounded-none border border-emerald-500/60 bg-zinc-950/95 ring-0">
            <CardHeader className="border-b border-zinc-800 px-5 py-4">
              <CardTitle className="font-heading text-xl tracking-[0.08em] text-zinc-100">
                Choose an ally
              </CardTitle>
              <CardDescription className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                {pendingAllyCard.skill.skillName} — pick who it targets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 px-5 py-4">
              <div className="grid grid-cols-2 gap-2">
                {playerTeam
                  .filter((p) => p.currentHP > 0 && !p.isSub)
                  .map((ally) => (
                    <button
                      key={ally.instanceId}
                      type="button"
                      onClick={() => confirmAllyTarget(ally.instanceId)}
                      className="flex items-center justify-between gap-2 border-2 border-zinc-700 bg-zinc-900/60 px-3 py-2 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-400/5"
                    >
                      <span className="min-w-0 truncate font-heading text-sm tracking-[0.06em] text-zinc-100">
                        {ally.name}
                      </span>
                      <span className="shrink-0 font-body text-[10px] uppercase tracking-widest text-zinc-500">
                        {ally.currentHP}/{ally.hp}
                      </span>
                    </button>
                  ))}
              </div>
              <Button
                variant="ghost"
                onClick={cancelAllyTarget}
                className="w-full rounded-none border border-zinc-700 text-xs uppercase tracking-widest text-zinc-300"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

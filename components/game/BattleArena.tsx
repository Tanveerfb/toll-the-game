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
import { FastForward, Gauge, LogOut, ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { useBattleContext } from "@/hooks/BattleProvider";
import type { BattleCharacter } from "@/types/character";
import { getCharacterArt, getSkillArt } from "@/lib/game/characterArt";
import {
  getVfxAccent,
  getVfxShape,
  getVfxTint,
  vfxShapeStyle,
} from "@/lib/game/characterVfx";
import { FLASH_TINTS } from "@/lib/game/elementSwatch";
import BattleEffectsOverlay from "@/components/game/BattleEffectsOverlay";
import TeamUnitTile, {
  type TileFx,
} from "@/components/game/battle/TeamUnitTile";
import TeamDetailsList from "@/components/game/battle/TeamDetailsList";
import BattleCoach from "@/components/game/battle/BattleCoach";
import UnitDetailPanel from "@/components/game/battle/UnitDetailPanel";
import BattleLogDrawer from "@/components/game/battle/BattleLogDrawer";
import { buildBattleReport } from "@/lib/game/battleReport";
import { useBattleSequencer } from "@/hooks/useBattleSequencer";
import DuelWaitingOverlay from "@/components/game/battle/DuelWaitingOverlay";
import { publishDuelResult } from "@/lib/duel/client";
import { useSettingsStore } from "@/store/settingsStore";

/** Stable no-op so the memoized player tiles don't re-render every frame on a
 *  fresh inline closure. Player tiles never focus-fire. */
const noop = (): void => {};

/** One control on the side rail — icon or portrait stack, plus a micro-label. */
function RailButton({
  label,
  title,
  tone = "default",
  active,
  onClick,
  tutorialAnchor,
  children,
}: {
  label: string;
  title?: string;
  tone?: "default" | "danger";
  active?: boolean;
  onClick: () => void;
  /** Marks this control as something a coach mark can point at
   *  (lib/tutorial/steps.ts). */
  tutorialAnchor?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const toneCls =
    tone === "danger"
      ? "hover:border-el-red hover:text-el-red"
      : "hover:border-signal hover:text-signal";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-label={title ?? label}
      data-tutorial={tutorialAnchor}
      className={`flex w-full cursor-pointer flex-col items-center gap-1 border px-1 py-1.5 transition-colors ${
        active
          ? "border-signal bg-signal/10 text-signal"
          : `border-edge text-readout-dim ${toneCls}`
      }`}
    >
      {children}
      <span className="font-body text-[8px] font-bold uppercase leading-none tracking-[0.1em]">
        {label}
      </span>
    </button>
  );
}

/** Portrait stack for one side's rail entry. */
function RailStack({
  team,
  presentedHp,
}: {
  team: BattleCharacter[];
  /** HP as currently shown by the sequencer — without this the stack greys a
   *  portrait out the instant the engine commits, ahead of the death
   *  animation the tiles are still playing. */
  presentedHp: Record<string, number>;
}): React.JSX.Element {
  return (
    <span className="flex flex-wrap justify-center gap-px">
      {team.map((unit) => {
        const art = getCharacterArt(unit.id);
        const shownHp = presentedHp[unit.instanceId] ?? unit.currentHP;
        return (
          <span
            key={unit.instanceId}
            className="h-4 w-4 overflow-hidden border border-edge bg-inset"
          >
            {art ? (
              <Image
                src={art}
                alt=""
                width={16}
                height={16}
                className={`h-full w-full object-cover object-top ${shownHp <= 0 ? "grayscale opacity-40" : ""}`}
              />
            ) : null}
          </span>
        );
      })}
    </span>
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
  contextLabel,
}: {
  story?: BattleEndHandlers;
  worldBoss?: BattleEndHandlers;
  /** What this fight belongs to (a story chapter's title, say). Rendered in
   *  the status strip so a canon battle doesn't look byte-identical to a
   *  practice sandbox one. */
  contextLabel?: string;
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
  // What the sequencer is currently showing, ahead of store truth for the
  // action being animated. Every HP readout on this screen reads it.
  const presentedHp = useGameStore((s) => s.presentedHp);

  // The battlefield shows only units that have entered the field. A sub is
  // untargetable, can't act and has no cards — a tile for it was a unit you
  // could neither use nor hit. The bench still shows in the Team list, where
  // it's badged as a sub (Tanveer, 2026-08-11). Subs promote at turn start
  // (lib/game/sub.ts), at which point they appear here on their own.
  const playerOnField = playerTeam.filter((u) => !u.isSub);
  const enemyOnField = enemyTeam.filter((u) => !u.isSub);
  // Dev-only duel mode: shows who is actually piloting the enemy side.
  const duelMode = useSettingsStore((s) => s.duelMode);

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

  const cutInArt = seq.cutIn
    ? (getSkillArt(seq.cutIn.characterId, seq.cutIn.skillName) ??
      getCharacterArt(seq.cutIn.characterId))
    : null;

  const tileFx = (instanceId: string): TileFx => ({
    hpOverride: presentedHp[instanceId],
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

  // A finished duel writes no further state, so without this the watcher on
  // the other side waits forever and never learns the result (hit in the first
  // duel, 2026-08-09). Fires once per battle.
  const duelResultSentRef = React.useRef(false);
  React.useEffect(() => {
    if (!duelMode) return;
    if (battlePhase !== "victory" && battlePhase !== "defeat") {
      duelResultSentRef.current = false;
      return;
    }
    if (duelResultSentRef.current) return;
    duelResultSentRef.current = true;
    void publishDuelResult({
      outcome: battlePhase,
      enemyTeam,
      playerTeam,
      turn: currentTurn,
      recentEvents: battleLog.slice(-15),
    });
  }, [duelMode, battlePhase, enemyTeam, playerTeam, currentTurn, battleLog]);

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
    // JSON, not prose: these are saved to be analysed rather than read
    // (Tanveer, 2026-08-13). `buildBattleReport` precomputes the aggregates
    // and flags the anomalies so a reading doesn't start with arithmetic.
    const opening = useGameStore.getState().openingTeams;
    const report = buildBattleReport({
      result: battlePhase,
      turn: currentTurn,
      playerTurns,
      enemyTurns,
      playerTeam,
      enemyTeam,
      openingPlayerTeam: opening?.playerTeam,
      openingEnemyTeam: opening?.enemyTeam,
      events: battleEvents,
      rawLog: battleLog,
      timestamp: now.toISOString(),
      context: contextLabel,
      fieldCap: playerTeam.filter((u) => !u.isSub).length,
    });
    try {
      const res = await fetch("/api/battle-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: `battle_${stamp}.json`,
          content: JSON.stringify(report, null, 2),
        }),
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
      <DuelWaitingOverlay />
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
              className="absolute inset-0 bg-void/80"
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
                className={`h-14 w-14 overflow-hidden rounded-full border-2 ${seq.ghost.isUlt ? "border-el-light shadow-[0_0_24px_rgba(232,209,116,0.9)]" : "border-readout-strong/80 shadow-[0_0_14px_rgba(234,242,248,0.5)]"}`}
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
              className="absolute inset-0 bg-void/75"
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
                className="absolute inset-x-0 top-1/2 flex h-32 -translate-y-1/2 items-center gap-4 overflow-hidden border-y-2 border-el-light bg-linear-to-r from-el-light/12 via-void/95 to-el-light/12 px-6 shadow-[0_0_60px_rgba(232,209,116,0.4)]"
              >
                {/* Skill art first, portrait as fallback. All 48 playable +
                    boss ultimates have their own art already, so every
                    ultimate's cut-in reads distinctly at zero asset cost —
                    the cut-in used to show the same portrait for all of them. */}
                {cutInArt ? (
                  <Image
                    src={cutInArt}
                    alt={seq.cutIn.name}
                    width={220}
                    height={220}
                    className="h-40 w-28 shrink-0 border-2 border-el-light/70 object-cover object-top shadow-[0_0_30px_rgba(232,209,116,0.6)]"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="font-body text-xs uppercase tracking-[0.3em] text-el-light/80">
                    {seq.cutIn.name} — Ultimate
                  </p>
                  <p className="truncate font-heading text-4xl tracking-[0.1em] text-el-light drop-shadow-[0_0_12px_rgba(232,209,116,0.8)]">
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
                className="absolute inset-0 bg-el-red/40"
              />
              <m.div
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.38 / battleSpeed, ease: "easeOut" }}
                className="relative flex flex-col items-center gap-1 border-y-2 border-el-red bg-void/80 px-12 py-5 backdrop-blur-sm"
              >
                <span className="font-body text-xs uppercase tracking-[0.4em] text-el-red/80">
                  {phaseBreak.name}
                </span>
                <span className="font-heading text-5xl tracking-[0.16em] text-el-red drop-shadow-[0_0_16px_rgba(255,90,78,0.85)] md:text-6xl">
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
                  ? "border-el-light bg-void/90 text-2xl text-el-light"
                  : floater.kind === "damage"
                    ? "border-el-red/70 bg-void/85 text-xl text-el-red"
                    : floater.kind === "counter"
                      ? "border-edge-strong bg-void/85 text-lg text-readout"
                      : floater.kind === "heal"
                        ? "border-el-green/70 bg-void/85 text-xl text-el-green"
                        : floater.kind === "evade"
                          ? "border-signal/70 bg-void/85 text-lg text-signal"
                          : "border-edge-strong bg-void/85 text-sm text-readout-strong"
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
            const accent = getVfxAccent(shape);
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
                {/* Shape-specific accent, resolved from the registry so a
                    new flavor is a data edit rather than another branch here. */}
                {accent === "second-ring" ? (
                  <m.div
                    initial={{ opacity: 0.6, scale: 0.2 }}
                    animate={{ opacity: 0, scale: burst.strong ? 2.2 : 1.5 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.48 / battleSpeed,
                      delay: 0.1 / battleSpeed,
                      ease: "easeOut",
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: burst.x,
                      top: burst.y,
                      width: size,
                      height: size,
                      border: `2px solid ${tint}`,
                      ...vfxShapeStyle(shape),
                    }}
                  />
                ) : null}
                {accent === "inner-pop" ? (
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
                {accent === "core" ? (
                  <m.div
                    initial={{ opacity: 1, scale: 0.1 }}
                    animate={{ opacity: 0, scale: 0.9 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22 / battleSpeed, ease: "easeOut" }}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: burst.x,
                      top: burst.y,
                      width: size * 0.7,
                      height: size * 0.7,
                      background: "#ffffff",
                      filter: "blur(1px)",
                      ...vfxShapeStyle(shape),
                    }}
                  />
                ) : null}
                {accent === "wave" ? (
                  <m.div
                    initial={{ opacity: 0.7, scaleX: 0.2, scaleY: 0.1 }}
                    animate={{ opacity: 0, scaleX: burst.strong ? 3.2 : 2.2, scaleY: 0.28 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.42 / battleSpeed, ease: "easeOut" }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: burst.x,
                      top: burst.y,
                      width: size,
                      height: size,
                      border: `3px solid ${tint}`,
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

      {/* Status strip — readout only. Every control moved to the rail; this
          row used to carry the Speed/Log/Exit cluster, which is what forced
          the enemy roster button down to top-14 to avoid it. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-hairline bg-inset px-3 py-1.5">
        <span className="shrink-0 font-heading text-base tracking-[0.12em] text-readout-strong">
          TURN {currentTurn + 1}
        </span>
        <span className="truncate font-body text-xs uppercase tracking-[0.16em] text-signal">
          {phaseLabel}
        </span>
        {duelMode ? (
          <span className="hidden shrink-0 border border-violet-400/70 px-1.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-violet-200 sm:inline">
            Duel
          </span>
        ) : null}
        {contextLabel ? (
          <span className="hidden min-w-0 shrink items-center gap-2 lg:flex">
            <span className="h-3 w-px shrink-0 bg-edge" />
            <span className="truncate font-body text-[11px] uppercase tracking-[0.16em] text-readout-muted">
              {contextLabel}
            </span>
          </span>
        ) : null}
        <span className="flex-1" />
        <span className="hidden shrink-0 font-body text-[10px] uppercase tracking-[0.12em] text-readout-muted md:inline">
          Player {playerTurns} • Enemy {enemyTurns}
        </span>
        <div className="hidden h-1.5 w-24 shrink-0 overflow-hidden border border-edge bg-void sm:block">
          <m.div
            className="h-full bg-signal"
            initial={{ width: 0 }}
            animate={{ width: `${phaseProgress}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
      </header>

      {/* Stage + rail. The rail sits BESIDE the play area rather than floating
          on top of it — the three controls it replaces (both roster stacks and
          Skip) all lived over the tiles they described, and the code carried
          comments about them colliding with each other. */}
      <div className="flex min-h-0 flex-1">
        {/* Battlefield — "Balanced Stack" (spec §1): enemy row / center battle
            stage / ally row. Big-hit focus (R3/ultimate) recedes both team
            rows and lets the stage take momentary visual focus, then restores. */}
        <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-1 py-1.5 pl-3 pr-2">
          <div
            className={`bighit-recede flex min-h-0 flex-col transition-[opacity,transform] duration-300 ${bigHitFocus ? "scale-[0.97] opacity-50" : "scale-100 opacity-100"}`}
          >
            <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
              {/* The instruction text that used to live here ("tap to inspect ·
                  ◎ to focus fire (optional; unmarked attacks pick randomly)")
                  is gone — a permanent tutorial line on a height-starved
                  screen. The reticle carries its own tooltip. */}
              <p className="min-w-0 truncate font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
                Enemy
              </p>
              {/* Enemy hidden deck (headless 7DS GC model): face-down cards =
                  the enemy's current hand size. */}
              {enemyDeck.length > 0 ? (
                <div
                  className="flex shrink-0 items-center gap-1"
                  title={`Enemy hand: ${enemyDeck.length} card${enemyDeck.length > 1 ? "s" : ""}`}
                >
                  <span className="font-body text-[9px] font-bold uppercase tracking-[0.16em] text-readout-muted">
                    Hand {enemyDeck.length}
                  </span>
                  {enemyDeck.slice(0, 7).map((card, i) => (
                    <span
                      key={card.id ?? i}
                      className="flex h-4 w-3 items-start justify-center border border-edge bg-panel-raised"
                    >
                      <span className="mt-1 block h-1 w-1 rotate-45 bg-readout-muted" />
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {/* Cards are 9:16 portrait, height-capped to the row and centered;
                a lone boss just sits alone in the middle. */}
            <div className="flex min-h-0 flex-1 items-center justify-center gap-2 overflow-hidden">
              {enemyOnField.map((unit) => (
                <div
                  key={unit.instanceId}
                  className="aspect-[9/16] max-h-full min-w-0 max-w-[112px] flex-1"
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
              className={`h-px w-full bg-linear-to-r from-transparent via-edge-strong to-transparent transition-opacity duration-300 ${bigHitFocus ? "opacity-100" : "opacity-60"}`}
            />
            <span
              className={`absolute bg-void px-2 font-heading text-[10px] tracking-[0.4em] text-readout-muted transition-opacity duration-300 sm:text-xs ${bigHitFocus ? "opacity-100" : "opacity-60"}`}
            >
              VS
            </span>
          </div>

          <div
            className={`bighit-recede flex min-h-0 flex-col transition-[opacity,transform] duration-300 ${bigHitFocus ? "scale-[0.97] opacity-50" : "scale-100 opacity-100"}`}
          >
            <p className="mb-1 shrink-0 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
              Your team
            </p>
            <div className="flex min-h-0 flex-1 items-center justify-center gap-2 overflow-hidden">
              {playerOnField.map((unit) => (
                <div
                  key={unit.instanceId}
                  className="aspect-[9/16] max-h-full min-w-0 max-w-[112px] flex-1"
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

        <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-l border-hairline bg-inset px-1.5 py-1.5">
          {/* Skip takes the top slot only while something is playing — it's the
              most urgent control on the screen for those few seconds. */}
          {seq.active ? (
            <RailButton label="Skip" title="Skip playback" active onClick={skipPlayback}>
              <FastForward className="h-4 w-4" strokeWidth={2.2} />
            </RailButton>
          ) : null}
          <RailButton
            label={`${battleSpeed}×`}
            title="Battle speed"
            active={battleSpeed === 2}
            onClick={() => setBattleSpeed(battleSpeed === 1 ? 2 : 1)}
          >
            <Gauge className="h-4 w-4" strokeWidth={2.2} />
          </RailButton>
          <RailButton label="Log" title="Battle log" onClick={() => setIsLogOpen(true)}>
            <ScrollText className="h-4 w-4" strokeWidth={2.2} />
          </RailButton>

          <span className="my-0.5 h-px w-6 bg-edge" />

          {/* Enemies had no route into the detail panel from anywhere on this
              screen before their stack was added. */}
          <RailButton
            label="Foe"
            title="Enemy details"
            onClick={() => setRosterSide("enemy")}
          >
            <RailStack team={enemyOnField} presentedHp={presentedHp} />
          </RailButton>
          {/* Full team, not just the field — the bench is only reachable here. */}
          <RailButton
            label="Team"
            title="Team details"
            tutorialAnchor="team"
            onClick={() => setRosterSide("player")}
          >
            <RailStack team={playerTeam} presentedHp={presentedHp} />
          </RailButton>

          {!isBattleOver ? (
            <>
              <span className="my-0.5 h-px w-6 bg-edge" />
              <RailButton
                label="Exit"
                title="Exit battle"
                tone="danger"
                onClick={() => setIsExitConfirmOpen(true)}
              >
                <LogOut className="h-4 w-4" strokeWidth={2.2} />
              </RailButton>
            </>
          ) : null}
        </aside>
      </div>

      {/* Event ticker (click for full log) */}
      <div className="shrink-0 border-t border-hairline bg-void/70 px-3 py-1 backdrop-blur-sm">
        {interactionNotice ? (
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-body text-xs uppercase tracking-[0.1em] text-el-red">
              {interactionNotice}
            </p>
            <button
              type="button"
              onClick={clearInteractionNotice}
              className="shrink-0 cursor-pointer border border-el-red/70 px-2 py-0.5 font-body text-[10px] uppercase tracking-widest text-el-red"
            >
              Dismiss
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsLogOpen(true)}
            className="block w-full cursor-pointer truncate text-left font-body text-xs text-readout transition-colors hover:text-readout-strong"
          >
            <span className="mr-1.5 text-signal">►</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 px-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm border-2 border-el-red">
            <CardHeader className="px-6 py-5 text-center">
              <CardTitle className="font-heading text-3xl tracking-[0.12em] text-el-red">
                EXIT BATTLE?
              </CardTitle>
              <CardDescription className="mt-2 tracking-[0.12em]">
                This counts as a loss — your progress in this fight is forfeited.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-6 py-5">
              <Button
                variant="destructive"
                size="lg"
                onClick={confirmExitBattle}
              >
                EXIT — TAKE THE LOSS
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setIsExitConfirmOpen(false)}
              >
                CANCEL
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {showBattleOver ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 px-4 backdrop-blur-sm">
          <Card
            className={`w-full max-w-md border-2 ${battlePhase === "victory" ? "border-el-light" : "border-el-red"}`}
          >
            <CardHeader className="px-6 py-6 text-center">
              <CardTitle
                className={`font-heading text-6xl tracking-[0.16em] ${battlePhase === "victory" ? "text-el-light" : "text-el-red"}`}
              >
                {battlePhase === "victory" ? "VICTORY" : "DEFEAT"}
              </CardTitle>
              <CardDescription className="mt-2">
                Turn {currentTurn + 1} • {playerTurns} player /{" "}
                {enemyTurns} enemy actions resolved
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-6 py-6">
              {battleEnd && battlePhase === "victory" ? (
                <Button
                  variant="secondary"
                  size="xl"
                  onClick={battleEnd.onContinue}
                >
                  {story ? "CONTINUE STORY" : "CLAIM REWARDS"}
                </Button>
              ) : null}
              {battleEnd && battlePhase === "defeat" ? (
                <>
                  <Button
                    variant="secondary"
                    size="xl"
                    onClick={battleEnd.onRetry}
                  >
                    RETRY BATTLE
                  </Button>
                  <Button variant="outline" size="xl" onClick={battleEnd.onQuit}>
                    {story ? "BACK TO CHAPTERS" : "BACK TO WORLD BOSS"}
                  </Button>
                </>
              ) : null}
              {!battleEnd && lastBattleConfig ? (
                <Button
                  variant="secondary"
                  size="xl"
                  onClick={() =>
                    startCustomBattle(
                      lastBattleConfig.playerPicks,
                      lastBattleConfig.enemyPicks,
                    )
                  }
                >
                  REMATCH
                </Button>
              ) : null}
              {process.env.NODE_ENV !== "production" ? (
                <>
                  <Button variant="outline" size="xl" onClick={saveBattleLog}>
                    SAVE BATTLE LOG
                  </Button>
                  {logSaveResult ? (
                    <p className="text-center font-body text-xs uppercase tracking-[0.14em] text-readout-dim">
                      {logSaveResult}
                    </p>
                  ) : null}
                </>
              ) : null}
              {!battleEnd ? (
                <>
                  <Button variant="outline" size="xl" onClick={resetBattle}>
                    CHANGE TEAMS
                  </Button>
                  <Button
                    variant="ghost"
                    size="xl"
                    onClick={() => {
                      resetBattle();
                      router.push("/");
                    }}
                  >
                    MAIN MENU
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* First-battle coach marks. Portals to the body and dims without
          disabling — see components/game/battle/BattleCoach.tsx. Rendered last
          so nothing in the arena can paint over it. */}
      <BattleCoach />

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/75 px-4">
          <Card className="w-full max-w-md border-role-heal/60">
            <CardHeader className="px-5 py-4">
              <CardTitle>
                Choose an ally
              </CardTitle>
              <CardDescription>
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
                      className="flex items-center justify-between gap-2 border-2 border-edge bg-inset px-3 py-2 text-left transition-colors hover:border-signal hover:bg-signal/5"
                    >
                      <span className="min-w-0 truncate font-heading text-sm tracking-[0.06em] text-readout-strong">
                        {ally.name}
                      </span>
                      <span className="shrink-0 font-body text-[10px] uppercase tracking-widest text-readout-muted">
                        {ally.currentHP}/{ally.hp}
                      </span>
                    </button>
                  ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelAllyTarget}
                className="w-full"
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

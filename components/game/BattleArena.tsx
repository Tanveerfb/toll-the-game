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
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { useBattleContext } from "@/hooks/BattleProvider";
import type { BattleCharacter } from "@/types/character";
import type { Color } from "@/types/color";
import { getEffectiveAttack, getEffectiveDefense } from "@/lib/game/stats";
import { getCritChance } from "@/lib/game/combat";
import { getEvadeChance } from "@/lib/game/evade";
import { ultGaugeMax } from "@/lib/game/ultGauge";
import { getPassiveReadout } from "@/lib/game/passiveStacks";
import { getCharacterById, getCharacterKit } from "@/lib/game/characterCatalog";
import { getVfxShape, getVfxTint, vfxShapeStyle } from "@/lib/game/characterVfx";
import KitDetails, { type KitPassiveView } from "@/components/game/KitDetails";
import BattleEffectsOverlay from "@/components/game/BattleEffectsOverlay";
import EffectsQuickPanel, {
  categorizeEffects,
} from "@/components/game/EffectsQuickPanel";
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

// A big stat callout for the info panel (7DSGC style): label, value, and an
// optional delta-since-battle-start subline.
function StatCallout({
  label,
  value,
  sub,
  subTone,
  align,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: string;
  align: "left" | "right";
}): React.JSX.Element {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="font-body text-[10px] uppercase tracking-[0.18em] text-zinc-400">
        {label}
      </p>
      <p className="font-heading text-2xl leading-tight tracking-[0.04em] text-emerald-300 md:text-3xl">
        {value}
      </p>
      {sub ? (
        <p className={`font-body text-xs ${subTone ?? "text-zinc-500"}`}>{sub}</p>
      ) : null}
    </div>
  );
}

// A row in the ?-toggled Detailed Info list.
function DetailStatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 py-1.5 last:border-b-0">
      <span className="font-body text-xs uppercase tracking-[0.12em] text-zinc-400">
        {label}
      </span>
      <span className={`font-heading text-sm ${tone ?? "text-zinc-100"}`}>
        {value}
      </span>
    </div>
  );
}

// Full-screen character info panel (7DSGC-style, Images 2/3): big ATK/DEF/HP
// callouts flanking the art, teammate nav, a ?-toggle for derived detailed
// stats, and the full kit below. Buffs/debuffs live in the EffectsQuickPanel.
function UnitDetailPanel({
  unit,
  playerTeam,
  enemyTeam,
  onClose,
}: {
  unit: BattleCharacter;
  playerTeam: BattleCharacter[];
  enemyTeam: BattleCharacter[];
  onClose: () => void;
}): React.JSX.Element {
  const ownTeam = unit.team === "player" ? playerTeam : enemyTeam;
  const teamOnField = ownTeam.filter((u) => !u.isSub);
  const [selectedId, setSelectedId] = React.useState(unit.instanceId);
  const [showDetailed, setShowDetailed] = React.useState(false);
  const idx = Math.max(
    0,
    teamOnField.findIndex((u) => u.instanceId === selectedId),
  );
  const selected = teamOnField[idx] ?? unit;

  const step = (dir: number) => {
    if (teamOnField.length < 2) return;
    const next = (idx + dir + teamOnField.length) % teamOnField.length;
    setSelectedId(teamOnField[next].instanceId);
    setShowDetailed(false);
  };

  // Phase-aware kit: a multi-phase boss in a later phase shows THAT phase's
  // skills/ultimate/passives, not the phase-1 catalog entry (Tanveer 2026-07-20).
  const catalog = getCharacterById(selected.id);
  const kit = catalog ? getCharacterKit(catalog, selected.phaseIndex ?? 0) : null;
  const passive = getPassiveReadout(selected);
  const effAtk = getEffectiveAttack(selected);
  const effDef = getEffectiveDefense(selected);
  const atkDelta = effAtk - selected.atk;
  const defDelta = effDef - selected.def;
  const crit = Math.round(getCritChance(selected));
  const evade = Math.round(getEvadeChance(selected));
  const art = getCharacterArt(selected.id);

  const deltaText = (d: number) =>
    d === 0 ? undefined : `(${d > 0 ? "+" : ""}${d})`;
  const deltaTone = (d: number) =>
    d > 0 ? "text-emerald-400" : d < 0 ? "text-rose-400" : "text-zinc-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
      <Card className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-none border-2 border-zinc-600 bg-zinc-950/95 ring-0">
        {/* Header: close · name/element/tags · teammate nav */}
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="shrink-0 rounded-none border border-zinc-600 px-2 font-body text-xs uppercase tracking-widest"
          >
            <ChevronLeft className="h-4 w-4" /> Close
          </Button>
          <div className="min-w-0 text-center">
            <div className="flex items-center justify-center gap-2">
              <span
                className={`h-2.5 w-2.5 rotate-45 border border-black/40 ${ELEMENT_SWATCH[selected.color]}`}
              />
              <CardTitle className="truncate font-heading text-2xl tracking-[0.08em] text-zinc-100">
                {selected.name}
              </CardTitle>
            </div>
            <CardDescription className="font-body text-[10px] uppercase tracking-[0.16em] text-zinc-400">
              {selected.color}
              {selected.tags?.length ? ` · ${selected.tags.join(" ")}` : ""}
              {selected.tier === "elite" ? " · Elite" : ""}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={teamOnField.length < 2}
              className="border border-zinc-600 p-1 text-zinc-300 transition-colors hover:border-zinc-400 disabled:opacity-30"
              aria-label="Previous teammate"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={teamOnField.length < 2}
              className="border border-zinc-600 p-1 text-zinc-300 transition-colors hover:border-zinc-400 disabled:opacity-30"
              aria-label="Next teammate"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {/* Callouts flanking the art; ? reveals the derived detailed stats */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="space-y-4">
              <StatCallout
                label="Attack"
                value={String(effAtk)}
                sub={deltaText(atkDelta)}
                subTone={deltaTone(atkDelta)}
                align="left"
              />
              <StatCallout
                label="Defense"
                value={String(effDef)}
                sub={deltaText(defDelta)}
                subTone={deltaTone(defDelta)}
                align="left"
              />
            </div>

            <div className="relative mx-auto h-56 w-40 overflow-hidden border border-zinc-700 bg-zinc-900/60">
              {art ? (
                <Image
                  src={art}
                  alt={selected.name}
                  fill
                  sizes="200px"
                  className="object-cover object-top"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-heading text-5xl text-white/70">
                  {selected.name.charAt(0)}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowDetailed((v) => !v)}
                title="Detailed info"
                className={`absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border font-heading text-sm ${showDetailed ? "border-amber-300 bg-amber-300/25 text-amber-100" : "border-zinc-400 bg-black/60 text-zinc-100"}`}
              >
                ?
              </button>
              {showDetailed ? (
                <div className="absolute inset-0 overflow-y-auto bg-black/85 px-3 py-2">
                  <p className="mb-1 text-center font-heading text-xs uppercase tracking-[0.16em] text-amber-200">
                    Detailed Info
                  </p>
                  <DetailStatRow
                    label="Eff. ATK"
                    value={`${effAtk}${deltaText(atkDelta) ? ` ${deltaText(atkDelta)}` : ""}`}
                    tone={deltaTone(atkDelta)}
                  />
                  <DetailStatRow
                    label="Eff. DEF"
                    value={`${effDef}${deltaText(defDelta) ? ` ${deltaText(defDelta)}` : ""}`}
                    tone={deltaTone(defDelta)}
                  />
                  <DetailStatRow label="Crit Chance" value={`${crit}%`} />
                  <DetailStatRow label="Evade" value={`${evade}%`} />
                  <DetailStatRow
                    label="Ult Gauge"
                    value={`${selected.ultGauge}/${ultGaugeMax(selected)}`}
                    tone="text-amber-300"
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <StatCallout
                label="Remaining HP"
                value={String(Math.max(0, selected.currentHP))}
                align="right"
              />
              <StatCallout
                label="Max HP"
                value={String(selected.hp)}
                align="right"
              />
            </div>
          </div>

          {/* Ult gauge pips */}
          <div className="flex items-center justify-center gap-1">
            {Array.from({ length: ultGaugeMax(selected) }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-4 -skew-x-12 ${i < selected.ultGauge ? "bg-amber-400" : "bg-zinc-700"}`}
              />
            ))}
          </div>

          {/* Passive readout — stacks and/or live derived values */}
          {passive ? (
            <div
              className={`border px-3 py-2 ${passive.ready ? "border-amber-400/70 bg-amber-400/10" : "border-zinc-800 bg-zinc-900/40"}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-heading text-sm tracking-[0.06em] text-zinc-100">
                  {passive.label}
                  {passive.stacks ? (
                    <span
                      className={
                        passive.ready ? " text-amber-200" : " text-zinc-400"
                      }
                    >
                      {" "}
                      [{passive.stacks.current}/{passive.stacks.max}]
                    </span>
                  ) : null}
                </p>
                {passive.note ? (
                  <span className="font-body text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                    {passive.note}
                  </span>
                ) : null}
              </div>
              {passive.lines && passive.lines.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-body text-xs text-emerald-300">
                  {passive.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              ) : null}
              {passive.readyMessage ? (
                <p className="mt-1 font-body text-xs font-semibold uppercase tracking-[0.1em] text-amber-200">
                  {passive.readyMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Full kit */}
          {kit ? (
            <KitDetails
              skills={kit.skills}
              ultimate={kit.ultimate}
              passives={kit.passives as KitPassiveView[]}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
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

// Element crest fill for the card header (matches the border color family).
const ELEMENT_SWATCH: Record<Color, string> = {
  red: "bg-rose-500",
  blue: "bg-sky-500",
  green: "bg-emerald-500",
  dark: "bg-violet-500",
  light: "bg-amber-300",
};

const CHIP_STYLE = {
  buff: { cls: "border-sky-500/60 bg-sky-500/15 text-sky-200", icon: ArrowUp },
  debuff: {
    cls: "border-rose-500/60 bg-rose-500/15 text-rose-200",
    icon: ArrowDown,
  },
  effect: {
    cls: "border-zinc-500/60 bg-zinc-500/15 text-zinc-300",
    icon: Sparkles,
  },
} as const;

// Small colored status squares above the HP bar (blue buff / red debuff / grey
// effect). The whole cluster is a button that opens the effects quick-panel.
function StatusChips({
  unit,
  onOpen,
}: {
  unit: BattleCharacter;
  onOpen: (unit: BattleCharacter) => void;
}): React.JSX.Element {
  const rows = categorizeEffects(unit);
  if (rows.length === 0) return <span />;
  const shown = rows.slice(0, 5);
  const overflow = rows.length - shown.length;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(unit);
      }}
      title="View effects"
      className="flex cursor-pointer items-center gap-0.5"
    >
      {shown.map(({ effect, category }, idx) => {
        const style = CHIP_STYLE[category];
        const Icon = style.icon;
        const stacks = effect.stacks ?? 1;
        return (
          <span
            key={`${effect.type}-${idx}`}
            className={`relative flex h-4 w-4 items-center justify-center border ${style.cls}`}
          >
            <Icon className="h-2.5 w-2.5" strokeWidth={2.6} />
            {stacks > 1 ? (
              <span className="absolute -bottom-1 -right-1 bg-black px-0.5 font-body text-[7px] font-bold leading-none text-zinc-100">
                {stacks}
              </span>
            ) : null}
          </span>
        );
      })}
      {overflow > 0 ? (
        <span className="font-body text-[9px] font-bold text-zinc-400">
          +{overflow}
        </span>
      ) : null}
    </button>
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
  onOpenEffects,
}: {
  unit: BattleCharacter;
  isEnemy: boolean;
  isMarked: boolean;
  queuedHits: number;
  fx: TileFx;
  onMark: (instanceId: string) => void;
  onViewDetails: (unit: BattleCharacter) => void;
  onOpenEffects: (unit: BattleCharacter) => void;
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

  const ultFull = unit.ultGauge >= ultGaugeMax(unit);

  return (
    <div
      data-battle-instance={unit.instanceId}
      className={`relative min-h-0 h-full ${fx.shaking ? (fx.flash?.strong ? "battle-shake-strong" : "battle-shake") : ""} ${fx.evading ? "battle-evade" : ""}`}
    >
      <div
        onClick={() => {
          if (!isDead && !isBenched) {
            onMark(unit.instanceId);
          }
        }}
        className={`flex h-full min-h-0 flex-col overflow-hidden border-2 bg-black/55 transition-colors ${isMarked ? markColorClass : getUnitBorderClass(unit.color)} ${isBenched ? "opacity-60" : ""} ${isDead || isBenched ? "cursor-default" : "cursor-pointer"}`}
      >
        {/* HEADER (top): element crest · name · status chips, then HP + ult */}
        <div
          className={`shrink-0 space-y-1 border-b border-zinc-800 bg-black/80 px-1.5 py-1 ${isDead ? "opacity-60" : ""}`}
        >
          <div className="flex items-center gap-1">
            <span
              title={unit.color}
              className={`h-2.5 w-2.5 shrink-0 rotate-45 border border-black/40 ${ELEMENT_SWATCH[unit.color]}`}
            />
            <span className="min-w-0 flex-1 truncate font-heading text-xs tracking-[0.06em] text-zinc-100">
              {unit.name}
            </span>
            <StatusChips unit={unit} onOpen={onOpenEffects} />
          </div>

          <div>
            {/* HP bar only — exact numbers live in the Info panel */}
            <div className="h-2 w-full overflow-hidden rounded-full border border-zinc-700/80 bg-zinc-900">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${isDead || hpPercent < 30 ? "bg-red-500" : "bg-emerald-500"}`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
            <span className="mt-0.5 flex items-center gap-0.5">
              {Array.from({ length: ultGaugeMax(unit) }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 -skew-x-12 ${i < unit.ultGauge ? (ultFull ? "bg-amber-300 shadow-[0_0_5px_rgba(252,211,77,0.8)]" : "bg-amber-500/80") : "bg-zinc-700"}`}
                />
              ))}
            </span>
          </div>
        </div>

        {/* BODY: character artwork */}
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
    battleLog,
    interactionNotice,
    phaseBreak,
    clearPhaseBreak,
    battleSpeed,
    setBattleSpeed,
    setEnemyMarker,
    clearInteractionNotice,
    actionQueue,
    deck,
    enemyDeck,
    pendingAllyCardId,
    confirmAllyTarget,
    cancelAllyTarget,
    resetBattle,
  } = useGameStore();

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
  const [detailUnit, setDetailUnit] = React.useState<BattleCharacter | null>(
    null,
  );
  // Effects quick-panel: store the id and resolve the LIVE unit so the panel
  // reflects effect changes if the battle advances while it's open.
  const [effectsUnitId, setEffectsUnitId] = React.useState<string | null>(null);
  const effectsUnit = effectsUnitId
    ? [...playerTeam, ...enemyTeam].find(
        (u) => u.instanceId === effectsUnitId,
      ) ?? null
    : null;
  const openEffects = React.useCallback(
    (unit: BattleCharacter) => setEffectsUnitId(unit.instanceId),
    [],
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
      `  ${u.name} (${u.id})${u.isSub ? " [sub]" : ""} — HP ${u.currentHP}/${u.hp}, ATK ${u.currentAttack}, DEF ${u.currentDefense}, ULT ${u.ultGauge}/${ultGaugeMax(u)}`;
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
              {/* White flash punch on entry */}
              <motion.div
                initial={{ opacity: 0.85 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.45 / battleSpeed, ease: "easeOut" }}
                className="absolute inset-0 bg-white"
              />
              <motion.div
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
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Phase-break flourish — a boss shattering into its next phase */}
        <AnimatePresence>
          {phaseBreak ? (
            <motion.div
              key={`phasebreak-${phaseBreak.key}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 / battleSpeed }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                initial={{ opacity: 0.9 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.6 / battleSpeed, ease: "easeOut" }}
                className="absolute inset-0 bg-rose-600/40"
              />
              <motion.div
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
                <motion.div
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
                  <motion.div
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
                  <motion.div
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

        {/* AoE sweep — an element-colored streak across every target */}
        <AnimatePresence>
          {seq.sweep ? (
            <motion.div
              key={`sweep-${seq.sweep.key}`}
              initial={{ opacity: 0, scaleX: 0.15 }}
              animate={{ opacity: [0, 0.9, 0], scaleX: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 / battleSpeed, ease: "easeOut" }}
              className="absolute h-12 origin-left -translate-y-1/2"
              style={{
                left: seq.sweep.x,
                top: seq.sweep.y,
                width: seq.sweep.width,
                background: `linear-gradient(90deg, transparent, ${getVfxTint(seq.sweep.characterId, FLASH_TINTS[seq.sweep.color])} 45%, #ffffffcc 50%, ${getVfxTint(seq.sweep.characterId, FLASH_TINTS[seq.sweep.color])} 55%, transparent)`,
                filter: "blur(1px)",
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
          <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
            <p className="min-w-0 truncate font-body text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              Enemy{" "}
              <span className="text-zinc-600">
                — click to focus fire (optional; unmarked attacks pick randomly)
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
          <div className="flex min-h-0 flex-1 items-stretch justify-center gap-3 overflow-hidden">
            {enemyTeam.map((unit) => (
              <div key={unit.instanceId} className="h-full aspect-[9/16]">
                <TeamUnitTile
                  unit={unit}
                  isEnemy
                  isMarked={selectedEnemyMarker === unit.instanceId}
                  queuedHits={queuedHitCountByEnemy[unit.instanceId] || 0}
                  fx={tileFx(unit.instanceId)}
                  onMark={setEnemyMarker}
                  onViewDetails={setDetailUnit}
                  onOpenEffects={openEffects}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <p className="mb-1 shrink-0 font-body text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            Player <span className="text-zinc-600">— tap Info for details</span>
          </p>
          <div className="flex min-h-0 flex-1 items-stretch justify-center gap-3 overflow-hidden">
            {playerTeam.map((unit) => (
              <div key={unit.instanceId} className="h-full aspect-[9/16]">
                <TeamUnitTile
                  unit={unit}
                  isEnemy={false}
                  isMarked={false}
                  queuedHits={queuedHitCountByEnemy[unit.instanceId] || 0}
                  fx={tileFx(unit.instanceId)}
                  onMark={() => {}}
                  onViewDetails={setDetailUnit}
                  onOpenEffects={openEffects}
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
        <UnitDetailPanel
          unit={detailUnit}
          playerTeam={playerTeam}
          enemyTeam={enemyTeam}
          onClose={() => setDetailUnit(null)}
        />
      ) : null}

      {effectsUnit ? (
        <EffectsQuickPanel
          unit={effectsUnit}
          playerTeam={playerTeam}
          enemyTeam={enemyTeam}
          onClose={() => setEffectsUnitId(null)}
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

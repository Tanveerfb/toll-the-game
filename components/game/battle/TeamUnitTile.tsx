"use client";

import React from "react";
import Image from "next/image";
import { Crosshair } from "lucide-react";
import { m } from "framer-motion";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  ELEMENT_SWATCH,
  FLASH_TINTS,
  getUnitBorderClass,
} from "@/lib/game/elementSwatch";
import { ultGaugeMax } from "@/lib/game/ultGauge";
import {
  EffectCountStrip,
  effectCounts,
} from "@/components/game/battle/EffectsList";
import type { BattleCharacter } from "@/types/character";
import type { SequencerFlash } from "@/hooks/useBattleSequencer";

/** HP at or below this reads as danger. Above it the bar stays achromatic —
 *  a bar that's green all fight tells you nothing; one that turns red tells
 *  you where to heal. */
const DANGER_PERCENT = 30;

/**
 * Status counts above the HP block, `↑4 ↓3`. Only buffs/debuffs surface here —
 * grey uncancellable entries live in the detail modal behind their own toggle
 * (`settingsStore.showUncancellableEffects`), since nothing about them is
 * actionable mid-fight.
 *
 * The strip is fixed-height on purpose: chips used to wrap to a second row and
 * shove the portrait down, so a unit's tile changed shape when it got buffed.
 */
function StatusChips({
  unit,
  onOpen,
}: {
  unit: BattleCharacter;
  onOpen: (unit: BattleCharacter) => void;
}): React.JSX.Element {
  const { buffs, debuffs } = effectCounts(unit);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(unit);
      }}
      title={buffs + debuffs > 0 ? "View effects" : undefined}
      aria-label="View status effects"
      className="flex h-4 w-full cursor-pointer items-center gap-0.5 overflow-hidden"
    >
      {/* Counts, not a chip per effect, and the same encoding the info panel
          uses — the strip used to truncate at CHIP_LIMIT and add "+3", which
          told you less than a number would have (Tanveer, 2026-08-13). */}
      <EffectCountStrip unit={unit} className="text-[10px]" />
    </button>
  );
}

export interface TileFx {
  hpOverride?: number;
  shaking?: boolean;
  evading?: boolean;
  flash?: SequencerFlash;
}

/**
 * One unit on the battlefield: portrait on top, readout underneath.
 *
 * The readout block is a FIXED height. Before, the chip strip sat above the
 * portrait and could wrap, so a tile's art shrank as its unit picked up
 * buffs — the layout moved for the exact reason you were looking at it.
 */
const TeamUnitTile = React.memo(function TeamUnitTile({
  unit,
  isEnemy,
  isMarked,
  queuedHits,
  fx,
  onInspect,
  onMark,
  onOpenEffects,
}: {
  unit: BattleCharacter;
  isEnemy: boolean;
  isMarked: boolean;
  queuedHits: number;
  fx: TileFx;
  /** Tapping the tile body inspects the unit — same gesture on both rows. */
  onInspect: (unit: BattleCharacter) => void;
  /** Enemy-only: focus-fire marking, via its own reticle button. */
  onMark: (instanceId: string) => void;
  onOpenEffects: (unit: BattleCharacter) => void;
}): React.JSX.Element {
  // During playback the sequencer feeds exact per-event HP snapshots so the
  // bar (and the DOWN stamp) land at the impact moment, not at resolve time
  const displayHP = fx.hpOverride ?? unit.currentHP;
  const hpPercent = unit.hp > 0 ? Math.max(0, (displayHP / unit.hp) * 100) : 0;
  const isDead = displayHP <= 0;
  const isHurt = hpPercent <= DANGER_PERCENT;
  const art = getCharacterArt(unit.id);
  const gaugeMax = ultGaugeMax(unit);
  const ultFull = unit.ultGauge >= gaugeMax;
  const canTarget = isEnemy && !isDead;

  return (
    <div
      data-battle-instance={unit.instanceId}
      className={`relative h-full min-h-0 ${fx.shaking ? (fx.flash?.strong ? "battle-shake-strong" : "battle-shake") : ""} ${fx.evading ? "battle-evade" : ""}`}
    >
      <div
        onClick={() => onInspect(unit)}
        className={`flex h-full min-h-0 cursor-pointer flex-col overflow-hidden border bg-panel transition-colors ${getUnitBorderClass(unit.color)} ${isMarked ? "shadow-[0_0_0_1px_var(--color-el-red)]" : ""}`}
      >
        {/* PORTRAIT */}
        <div className="relative min-h-0 flex-1 overflow-hidden bg-inset">
          {art ? (
            <Image
              src={art}
              alt={unit.name}
              fill
              sizes="220px"
              className={`object-cover object-top ${isDead ? "grayscale brightness-50" : ""}`}
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center font-heading text-4xl text-readout-strong">
              {unit.name.charAt(0).toUpperCase()}
            </span>
          )}

          {/* Focus-fire brackets — a camera reticle rather than a glowing
              border, so "marked" never reads as an element colour. */}
          {isMarked && isEnemy ? (
            <div className="pointer-events-none absolute inset-0.5">
              <span className="absolute left-0 top-0 h-3.5 w-3.5 border-l-2 border-t-2 border-el-red" />
              <span className="absolute right-0 top-0 h-3.5 w-3.5 border-r-2 border-t-2 border-el-red" />
              <span className="absolute bottom-0 left-0 h-3.5 w-3.5 border-b-2 border-l-2 border-el-red" />
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 border-b-2 border-r-2 border-el-red" />
            </div>
          ) : null}

          {/* A full gauge used to be a glow on five 1px slivers. It's the
              single most decision-changing fact on the tile. */}
          {ultFull && !isDead ? (
            <span className="absolute inset-x-0 top-0 bg-el-light px-1 py-px text-center font-body text-[8px] font-bold uppercase leading-none tracking-[0.16em] text-void">
              Ult Ready
            </span>
          ) : null}

          {/* Incoming hits sit WITH the brackets, not in the opposite corner:
              "marked" and "already taking two hits" are one fact. */}
          {queuedHits > 0 && isEnemy && !isDead ? (
            <span className="absolute inset-x-0 bottom-0 bg-el-red/90 px-1 py-px text-center font-body text-[8px] font-bold uppercase leading-none tracking-[0.12em] text-void">
              {queuedHits} incoming
            </span>
          ) : null}

          {isDead ? (
            <div className="absolute inset-0 flex items-center justify-center bg-void/55">
              <span className="font-heading text-sm tracking-[0.2em] text-el-red">
                DOWN
              </span>
            </div>
          ) : null}

          {fx.flash ? (
            <m.div
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
                className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rotate-[24deg] bg-readout-strong/80"
                style={{ display: fx.flash.strong ? undefined : "none" }}
              />
            </m.div>
          ) : null}
        </div>

        {/* READOUT — fixed height, so nothing here can resize the portrait. */}
        <div className="shrink-0 space-y-1 border-t border-hairline bg-inset px-1.5 py-1">
          <div className="flex items-center gap-1">
            <span
              title={unit.color}
              className={`h-2 w-2 shrink-0 rotate-45 ${ELEMENT_SWATCH[unit.color]}`}
            />
            <span className="min-w-0 flex-1 truncate font-heading text-xs tracking-[0.04em] text-readout-strong">
              {unit.name}
            </span>
            {canTarget ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMark(unit.instanceId);
                }}
                aria-label={
                  isMarked ? "Clear focus fire" : "Focus fire on this enemy"
                }
                aria-pressed={isMarked}
                title={isMarked ? "Focus-firing this enemy" : "Focus fire"}
                className={`flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${
                  isMarked
                    ? "border-el-red bg-el-red/20 text-el-red"
                    : "border-edge text-readout-muted hover:border-el-red hover:text-el-red"
                }`}
              >
                <Crosshair className="h-3 w-3" strokeWidth={2.2} />
              </button>
            ) : null}
          </div>

          {/* Current HP leads; max is a quiet divisor. It used to be the
              other way round at 9px against an 8px maximum. */}
          <div className="flex items-baseline gap-1">
            <span
              className={`font-body text-base font-bold leading-none tabular-nums ${isHurt ? "text-el-red" : "text-readout-strong"}`}
            >
              {Math.max(0, displayHP)}
            </span>
            <span className="font-body text-[9px] font-semibold leading-none tabular-nums text-readout-muted">
              /{unit.hp}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden border border-hairline bg-void">
            <div
              className={`h-full transition-[width] duration-300 ${isHurt ? "bg-el-red" : "bg-readout"}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>

          {/* One bar with a count, not five slivers. */}
          <div className="relative h-2.5 w-full overflow-hidden border border-hairline bg-void">
            <div
              className={`h-full transition-[width] duration-300 ${ultFull ? "bg-el-light" : "bg-el-light/30"}`}
              style={{ width: `${(Math.min(unit.ultGauge, gaugeMax) / gaugeMax) * 100}%` }}
            />
            <span
              className={`absolute inset-0 flex items-center justify-center font-body text-[8px] font-bold leading-none tabular-nums ${ultFull ? "text-void" : "text-readout-dim"}`}
            >
              {Math.min(unit.ultGauge, gaugeMax)}/{gaugeMax}
            </span>
          </div>

          <StatusChips unit={unit} onOpen={onOpenEffects} />
        </div>
      </div>
    </div>
  );
});

export default TeamUnitTile;

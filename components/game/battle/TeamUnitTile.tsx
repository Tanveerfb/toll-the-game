"use client";

import React from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import { m } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  ELEMENT_SWATCH,
  FLASH_TINTS,
  getUnitBorderClass,
} from "@/lib/game/elementSwatch";
import { ultGaugeMax } from "@/lib/game/ultGauge";
import { categorizeEffects } from "@/components/game/battle/EffectsList";
import type { BattleCharacter } from "@/types/character";
import type { SequencerFlash } from "@/hooks/useBattleSequencer";

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
// effect). The whole cluster is a button that opens the unit detail panel.
function StatusChips({
  unit,
  onOpen,
}: {
  unit: BattleCharacter;
  onOpen: (unit: BattleCharacter) => void;
}): React.JSX.Element {
  // Only buffs/debuffs surface on the battlefield tile; grey "effect"-category
  // statuses (and the full itemized list) live in the character info panel.
  // Bar wraps to at most 2 lines.
  const rows = categorizeEffects(unit).filter((r) => r.category !== "effect");
  if (rows.length === 0) return <></>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(unit);
      }}
      title="View effects"
      aria-label="View status effects"
      className="flex min-h-11 max-h-[2.15rem] w-full cursor-pointer flex-wrap content-start items-center gap-0.5 overflow-hidden"
    >
      {rows.map(({ effect, category }, idx) => {
        const style = CHIP_STYLE[category];
        const Icon = style.icon;
        const stacks = effect.stacks ?? 1;
        return (
          <span
            key={`${effect.type}-${idx}`}
            className={`relative flex h-4 w-4 shrink-0 items-center justify-center border ${style.cls}`}
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
    </button>
  );
}

export interface TileFx {
  hpOverride?: number;
  shaking?: boolean;
  evading?: boolean;
  flash?: SequencerFlash;
}

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
  const isBenched = unit.isSub === true;
  const art = getCharacterArt(unit.id);
  const ultFull = unit.ultGauge >= ultGaugeMax(unit);
  // Enemies get a camera-reticle corner-bracket overlay (spec §3,
  // 7dsgc-enemy-target-marker.jpg) rather than a glowing border.
  const showTargetReticle = isMarked && isEnemy;
  const canTarget = isEnemy && !isDead && !isBenched;

  return (
    <div
      data-battle-instance={unit.instanceId}
      className={`relative min-h-0 h-full ${fx.shaking ? (fx.flash?.strong ? "battle-shake-strong" : "battle-shake") : ""} ${fx.evading ? "battle-evade" : ""}`}
    >
      {showTargetReticle ? (
        <div className="pointer-events-none absolute inset-0.5 z-20">
          <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-red-500" />
          <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-red-500" />
          <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-red-500" />
          <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-red-500" />
        </div>
      ) : null}

      <div
        onClick={() => onInspect(unit)}
        className={`flex h-full min-h-0 cursor-pointer flex-col overflow-hidden border-2 bg-black/55 transition-colors ${getUnitBorderClass(unit.color)} ${isBenched ? "opacity-60" : ""}`}
      >
        {/* HEADER (top): effects · element crest + name · HP + ult */}
        <div
          className={`shrink-0 space-y-1 border-b border-zinc-800 bg-black/80 px-1.5 py-1 ${isDead ? "opacity-60" : ""}`}
        >
          <StatusChips unit={unit} onOpen={onOpenEffects} />

          <div className="flex items-center gap-1">
            <span
              title={unit.color}
              className={`h-2.5 w-2.5 shrink-0 rotate-45 border border-black/40 ${ELEMENT_SWATCH[unit.color]}`}
            />
            <span className="min-w-0 flex-1 truncate font-heading text-xs tracking-[0.06em] text-zinc-100">
              {unit.name.split(" ")[0]}
            </span>
          </div>

          <div>
            {/* HP numerals sit ON the tile: "how close to dead is it" is the
                most-asked question mid-fight and a bare bar can't answer it. */}
            <div className="flex items-baseline justify-between gap-1">
              <span className="font-body text-[9px] font-semibold leading-none text-zinc-300 tabular-nums">
                {Math.max(0, displayHP)}
              </span>
              <span className="font-body text-[8px] leading-none text-zinc-500 tabular-nums">
                /{unit.hp}
              </span>
            </div>
            <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full border border-zinc-700/80 bg-zinc-900">
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
            {queuedHits > 0 ? (
              <Badge
                variant="outline"
                className="rounded-none border-sky-300 bg-sky-500/25 px-1 py-0 font-body text-[9px] uppercase tracking-widest text-sky-100 backdrop-blur-sm"
              >
                {queuedHits}×
              </Badge>
            ) : null}
          </div>

          {/* Focus-fire is its own affordance now. Tapping the tile used to
              mark an enemy and do nothing at all on an ally — two different
              meanings for one gesture, on one screen. Tap always inspects;
              this button targets. */}
          {canTarget ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMark(unit.instanceId);
              }}
              aria-label={isMarked ? "Clear focus fire" : "Focus fire on this enemy"}
              aria-pressed={isMarked}
              title={isMarked ? "Focus-firing this enemy" : "Focus fire"}
              className={`absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center border text-[11px] leading-none backdrop-blur-sm transition-colors ${
                isMarked
                  ? "border-red-400 bg-red-500/30 text-red-100"
                  : "border-zinc-500 bg-black/70 text-zinc-300 hover:border-red-400 hover:text-red-200"
              }`}
            >
              ◎
            </button>
          ) : null}

          {isDead ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="border border-red-500/80 bg-red-950/70 px-2 py-0.5 font-heading text-sm tracking-[0.2em] text-red-300">
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
                className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rotate-[24deg] bg-white/80"
                style={{ display: fx.flash.strong ? undefined : "none" }}
              />
            </m.div>
          ) : null}
        </div>
      </div>
    </div>
  );
});

export default TeamUnitTile;

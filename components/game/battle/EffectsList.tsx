"use client";

import React from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Hourglass, Sparkles } from "lucide-react";
import { getCharacterArt } from "@/lib/game/characterArt";
import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";

type Category = "buff" | "debuff" | "effect";

const CATEGORY_STYLE: Record<
  Category,
  { row: string; chip: string; icon: React.ElementType }
> = {
  buff: {
    row: "border-el-blue/50 bg-el-blue/8",
    chip: "text-el-blue",
    icon: ArrowUp,
  },
  debuff: {
    row: "border-role-attack/50 bg-role-attack/8",
    chip: "text-role-attack",
    icon: ArrowDown,
  },
  effect: {
    row: "border-edge bg-inset",
    chip: "text-readout-muted",
    icon: Sparkles,
  },
};

interface CategorizedEffect {
  effect: StatusEffect;
  category: Category;
}

/** Ruling #30: uncancellable entries are grey "effects" regardless of whether
 * they live in buffs or debuffs. Order: buffs, then debuffs, then effects. */
export function categorizeEffects(unit: BattleCharacter): CategorizedEffect[] {
  const buffs = unit.buffs
    .filter((b) => !b.uncancellable)
    .map((effect) => ({ effect, category: "buff" as const }));
  const debuffs = unit.debuffs
    .filter((d) => !d.uncancellable)
    .map((effect) => ({ effect, category: "debuff" as const }));
  const effects = [...unit.buffs, ...unit.debuffs]
    .filter((e) => e.uncancellable)
    .map((effect) => ({ effect, category: "effect" as const }));
  return [...buffs, ...debuffs, ...effects];
}

export function prettyName(effect: StatusEffect): string {
  if (effect.name) return effect.name;
  return effect.type
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase());
}

/** A compact, human description for the row — numbers are tinted by the caller. */
function effectDescription(effect: StatusEffect): string {
  const perTurn =
    effect.capturedDamage ??
    (effect.type === "damageOverTime" || effect.type === "decay"
      ? effect.value
      : undefined);
  if (effect.type === "corrosion") {
    return `${effect.valuePercent ?? 10}% max HP per turn`;
  }
  if (perTurn !== undefined) return `${perTurn} damage per turn`;
  if (effect.type === "stun") return "Cannot act";
  if (effect.type === "seal") {
    return `${effect.sealType ?? "skill"} skills sealed`;
  }
  if (effect.type === "taunt") return "Attacks redirect to the source";
  if (effect.flatValue !== undefined && effect.stat) {
    const sign = effect.flatValue >= 0 ? "+" : "";
    return `${sign}${effect.flatValue} ${effect.stat.toUpperCase()}`;
  }
  if (effect.valuePercent !== undefined && effect.stat) {
    const sign = effect.valuePercent >= 0 ? "+" : "";
    return `${sign}${effect.valuePercent}% ${effect.stat.toUpperCase()}`;
  }
  if (effect.valuePercent !== undefined) return `${effect.valuePercent}%`;
  return "";
}

/** Highlight numeric tokens (e.g. "+30%", "10") — achromatic, so a number
 *  doesn't compete with the row's own buff/debuff hue. */
function DescriptionText({ text }: { text: string }): React.JSX.Element {
  const parts = text.split(/([+-]?\d[\d,.]*%?)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^[+-]?\d/.test(part) ? (
          <span key={i} className="font-semibold text-readout-strong">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/**
 * The itemized active-effects list (buffs, then debuffs, then grey effects),
 * each with duration, stacks, description, and the source unit's portrait.
 *
 * Rendered inside UnitDetailPanel. This module used to also export a whole
 * second overlay (EffectsQuickPanel) that answered the same question from a
 * different tap on the same tile; that overlay is gone and the panel is the
 * single destination. `categorizeEffects` is still shared with the tile's
 * status-chip strip.
 */
export function EffectsList({
  unit,
  allUnits,
  showUncancellable = true,
}: {
  unit: BattleCharacter;
  allUnits: BattleCharacter[];
  /** Include the grey uncancellable entries. Off in battle by default — see
   *  `settingsStore.showUncancellableEffects`. */
  showUncancellable?: boolean;
}): React.JSX.Element {
  const all = categorizeEffects(unit);
  const rows = showUncancellable
    ? all
    : all.filter((r) => r.category !== "effect");
  const hidden = all.length - rows.length;
  const sourceArt = (sourceId?: string): string | null => {
    if (!sourceId) return null;
    const src = allUnits.find((u) => u.instanceId === sourceId);
    return src ? getCharacterArt(src.id) : null;
  };
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center font-body text-sm font-bold uppercase tracking-[0.18em] text-readout-muted">
        {hidden > 0
          ? // Saying "no active effects" while hiding some would be a lie.
            `No buffs or debuffs — ${hidden} uncancellable hidden`
          : "No active effects."}
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {rows.map(({ effect, category }, idx) => {
        const style = CATEGORY_STYLE[category];
        const Icon = style.icon;
        const duration = effect.buffDuration ?? effect.debuffDuration;
        const stacks = effect.stacks ?? 1;
        const art = sourceArt(effect.sourceId);
        const desc = effectDescription(effect);
        return (
          <div
            key={`${effect.type}-${idx}`}
            className={`flex items-center gap-2.5 border px-2.5 py-2 ${style.row}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center border border-hairline bg-void/40 ${style.chip}`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-heading text-sm tracking-[0.04em] text-readout-strong">
                  {prettyName(effect)}
                </span>
                {duration ? (
                  <span className="flex items-center gap-0.5 font-body text-[10px] font-bold uppercase tracking-widest text-readout-dim">
                    <Hourglass className="h-3 w-3" />
                    {duration}
                  </span>
                ) : null}
                {stacks > 1 ? (
                  <span className="border border-edge bg-void/50 px-1 font-body text-[10px] font-bold text-readout">
                    ×{stacks}
                  </span>
                ) : null}
              </div>
              {desc ? (
                <p className="font-body text-xs text-readout-dim">
                  <DescriptionText text={desc} />
                </p>
              ) : null}
            </div>
            {art ? (
              <div className="h-9 w-9 shrink-0 overflow-hidden border border-edge">
                <Image
                  src={art}
                  alt=""
                  width={36}
                  height={36}
                  className="h-full w-full object-cover object-top"
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

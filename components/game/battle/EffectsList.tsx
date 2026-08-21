"use client";

import React from "react";
import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { statPhrase } from "@/lib/game/stats";
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

/**
 * How many cancellable buffs and debuffs are on a unit.
 *
 * Grey (uncancellable) entries are excluded entirely and count toward neither
 * side — ruling #30 says they are "effects", not buffs or debuffs, and the
 * strip that renders this is about what can still be played around.
 *
 * Counts ENTRIES, not stacks, matching the chip strip this replaced: three
 * stacks of one Corrosion were one chip and are one debuff.
 */
export function effectCounts(unit: BattleCharacter): {
  buffs: number;
  debuffs: number;
} {
  let buffs = 0;
  let debuffs = 0;
  for (const { category } of categorizeEffects(unit)) {
    if (category === "buff") buffs += 1;
    else if (category === "debuff") debuffs += 1;
  }
  return { buffs, debuffs };
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
  // Via statPhrase, so an entry declaring `stats: ["atk","def","hp"]` reads
  // "basic stats" instead of losing its stat name entirely — `effect.stat` is
  // undefined on every combined entry (see lib/game/stats.ts).
  const named = effect.stat || effect.stats?.length;
  if (effect.flatValue !== undefined && named) {
    const sign = effect.flatValue >= 0 ? "+" : "";
    return `${sign}${effect.flatValue} ${statPhrase(effect)}`;
  }
  if (effect.valuePercent !== undefined && named) {
    const sign = effect.valuePercent >= 0 ? "+" : "";
    return `${sign}${effect.valuePercent}% ${statPhrase(effect)}`;
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
 * The at-a-glance count under a unit's ult gauge: `↑4 ↓3`.
 *
 * Replaces a chip per effect, which grew past the width it had. Rules
 * (Tanveer, 2026-08-13):
 *  - a side with nothing active renders NOTHING — no zero, no dimmed arrow, so
 *    `↓2` alone is a unit carrying only debuffs;
 *  - grey uncancellable effects never appear here and never count;
 *  - with neither, the strip is empty rather than a placeholder.
 */
export function EffectCountStrip({
  unit,
  className = "",
}: {
  unit: BattleCharacter;
  className?: string;
}): React.JSX.Element | null {
  const { buffs, debuffs } = effectCounts(unit);
  if (buffs === 0 && debuffs === 0) return null;
  return (
    <div
      className={`flex items-center gap-2 font-body text-xs font-bold tabular-nums ${className}`}
      // One label for the pair: two separate ones read as unrelated numbers.
      aria-label={`${buffs} buff${buffs === 1 ? "" : "s"}, ${debuffs} debuff${debuffs === 1 ? "" : "s"}`}
    >
      {buffs > 0 ? (
        <span className="flex items-center gap-0.5 text-el-blue">
          <ArrowUp className="h-3 w-3" strokeWidth={3} aria-hidden />
          {buffs}
        </span>
      ) : null}
      {debuffs > 0 ? (
        <span className="flex items-center gap-0.5 text-role-attack">
          <ArrowDown className="h-3 w-3" strokeWidth={3} aria-hidden />
          {debuffs}
        </span>
      ) : null}
    </div>
  );
}

/**
 * One category as a table.
 *
 * Built to survive growth: the caller scrolls the body, and the table itself
 * scrolls sideways rather than crushing columns, so adding a column later
 * doesn't wreck the layout on a narrow panel.
 */
function EffectTable({
  rows,
  allUnits,
  emptyText,
}: {
  rows: CategorizedEffect[];
  allUnits: BattleCharacter[];
  emptyText: string;
}): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <p className="py-3 text-center font-body text-xs uppercase tracking-[0.18em] text-readout-muted">
        {emptyText}
      </p>
    );
  }
  const sourceName = (sourceId?: string): string => {
    if (!sourceId) return "—";
    return allUnits.find((u) => u.instanceId === sourceId)?.name ?? "—";
  };
  // Denser padding than the primitive's default: these rows sit in a modal
  // that has to hold a list of unbounded length without becoming a scroll of
  // its own.
  const CELL = "py-1.5 pr-2 pl-0";
  return (
    <Table className="min-w-[24rem]">
      <TableHeader>
        <TableRow>
          <TableHead className="py-1 pr-2 pl-0">Effect</TableHead>
          <TableHead className="py-1 pr-2 pl-0">Value</TableHead>
          <TableHead className="py-1 pr-2 pl-0 text-right">Stacks</TableHead>
          <TableHead className="py-1 pr-2 pl-0 text-right">Turns</TableHead>
          <TableHead className="py-1 pr-0 pl-0">From</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ effect, category }, idx) => {
          const style = CATEGORY_STYLE[category];
          const Icon = style.icon;
          const duration = effect.buffDuration ?? effect.debuffDuration;
          const stacks = effect.stacks ?? 1;
          const desc = effectDescription(effect);
          return (
            <TableRow key={`${effect.type}-${idx}`}>
              <TableCell className={CELL}>
                <span className="flex items-center gap-1.5">
                  <Icon
                    className={`h-3 w-3 shrink-0 ${style.chip}`}
                    strokeWidth={2.6}
                    aria-hidden
                  />
                  <span className="font-heading tracking-[0.04em] text-readout-strong">
                    {prettyName(effect)}
                  </span>
                </span>
              </TableCell>
              <TableCell className={`${CELL} text-readout-dim`}>
                {desc ? <DescriptionText text={desc} /> : "—"}
              </TableCell>
              <TableCell
                className={`${CELL} text-right tabular-nums text-readout-dim`}
              >
                {stacks > 1 ? `×${stacks}` : "—"}
              </TableCell>
              <TableCell
                className={`${CELL} text-right tabular-nums text-readout-dim`}
              >
                {duration ?? "—"}
              </TableCell>
              <TableCell className="truncate py-1.5 pr-0 pl-0 text-readout-muted">
                {sourceName(effect.sourceId)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/**
 * Everything active on a unit, as buff and debuff tables with the grey
 * uncancellable effects behind a toggle.
 *
 * This replaced an inline disclosure inside the info panel's own scroll zone,
 * which put a list of unbounded length inside a column that already scrolled
 * (Tanveer: "its not good UI"). Rendered by the caller inside a modal.
 */
export function EffectsTables({
  unit,
  allUnits,
  showUncancellable,
  onToggleUncancellable,
}: {
  unit: BattleCharacter;
  allUnits: BattleCharacter[];
  showUncancellable: boolean;
  onToggleUncancellable: () => void;
}): React.JSX.Element {
  const all = categorizeEffects(unit);
  const buffs = all.filter((r) => r.category === "buff");
  const debuffs = all.filter((r) => r.category === "debuff");
  const grey = all.filter((r) => r.category === "effect");

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h3 className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-el-blue">
          Buffs
        </h3>
        <EffectTable rows={buffs} allUnits={allUnits} emptyText="None active" />
      </section>

      <section className="space-y-1">
        <h3 className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-role-attack">
          Debuffs
        </h3>
        <EffectTable
          rows={debuffs}
          allUnits={allUnits}
          emptyText="None active"
        />
      </section>

      {grey.length > 0 ? (
        <section className="space-y-1">
          <button
            type="button"
            onClick={onToggleUncancellable}
            aria-expanded={showUncancellable}
            className="flex min-h-11 w-full items-center justify-between border border-dashed border-edge px-3 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted transition-colors hover:border-edge-strong hover:text-readout"
          >
            <span>
              {grey.length} fixed effect{grey.length === 1 ? "" : "s"}
            </span>
            <span>{showUncancellable ? "Hide" : "Show"}</span>
          </button>
          {showUncancellable ? (
            <EffectTable rows={grey} allUnits={allUnits} emptyText="None" />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

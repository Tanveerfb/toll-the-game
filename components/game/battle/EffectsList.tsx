"use client";

import React from "react";
import { ArrowDown, ArrowUp, ShieldHalf, Sparkles } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { entryTouchesStat, statPhrase } from "@/lib/game/stats";
import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";

/**
 * Ruling #133 (Tanveer, 2026-09-16): what an effect IS reads as a colour.
 *
 *   buff    blue    a free-standing raise; `cancelBuffs` takes it
 *   stance  yellow  a stance and every part of it; `cancelStances` takes it
 *   debuff  red     hostile
 *   effect  grey    uncancellable — *"they are not affected by any cancel
 *                   buffs or any cleanses … they are just effects"* (#30)
 *
 * The colour is the cancel rule made visible. A stance used to render blue
 * beside ordinary buffs, which is precisely the distinction #132 had just
 * spent an engine change drawing.
 */
type Category = "buff" | "stance" | "debuff" | "effect";

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
  stance: {
    row: "border-el-light/50 bg-el-light/8",
    chip: "text-el-light",
    icon: ShieldHalf,
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

/**
 * Which entries are part of a stance rather than free-standing buffs.
 *
 * The same predicate the cancel step uses (#132) — membership is by group, so
 * a DEF raise applied by a stance skill is part of that stance whatever its
 * own `type` says. Keeping one rule means the colour can never disagree with
 * what a cancel would actually remove.
 */
export function isStanceEntry(effect: StatusEffect): boolean {
  return (
    effect.type === "stance" ||
    effect.type === "taunt" ||
    effect.groupId !== undefined
  );
}

/** Ruling #30: uncancellable entries are grey "effects" regardless of whether
 * they live in buffs or debuffs. Order: buffs, stances, debuffs, then effects
 * — favourable things together, and #133's colours run in that order too. */
export function categorizeEffects(unit: BattleCharacter): CategorizedEffect[] {
  const live = unit.buffs.filter((b) => !b.uncancellable);
  const buffs = live
    .filter((b) => !isStanceEntry(b))
    .map((effect) => ({ effect, category: "buff" as const }));
  const stances = live
    .filter(isStanceEntry)
    .map((effect) => ({ effect, category: "stance" as const }));
  const debuffs = unit.debuffs
    .filter((d) => !d.uncancellable)
    .map((effect) => ({ effect, category: "debuff" as const }));
  const effects = [...unit.buffs, ...unit.debuffs]
    .filter((e) => e.uncancellable)
    .map((effect) => ({ effect, category: "effect" as const }));
  return [...buffs, ...stances, ...debuffs, ...effects];
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
  stances: number;
  debuffs: number;
} {
  let buffs = 0;
  let stances = 0;
  let debuffs = 0;
  for (const { category } of categorizeEffects(unit)) {
    if (category === "buff") buffs += 1;
    else if (category === "stance") stances += 1;
    else if (category === "debuff") debuffs += 1;
  }
  return { buffs, stances, debuffs };
}

export function prettyName(effect: StatusEffect): string {
  if (effect.name) return effect.name;
  return effect.type
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase());
}

/**
 * What a row inside a stance shows in the Turns column.
 *
 * A stance states its duration ONCE, on the stance, and its parts inherit it —
 * the shape 7DS uses ("Assumes a Stance for 1 turn(s) which Taunts enemies and
 * inflicts…"), and the reference Tanveer gave. Repeating the number on every
 * row reads as several independent timers on what is one thing.
 *
 * A part whose duration genuinely differs still shows its own, so a future
 * stance whose taunt outlasts its stat raise stays readable.
 */
export function memberDurationToShow(
  own: number | undefined,
  groupDuration: number | undefined,
  inGroup: boolean,
): number | undefined {
  if (!inGroup) return own;
  return own === groupDuration ? undefined : own;
}

/**
 * A stance and the entries it put up, or one ungrouped effect.
 *
 * Ruling #131: a stance is one thing the player chose, and its parts are
 * listed separately but under its name. Without the heading, Yalina's taunt
 * and her damage reduction read as two unrelated rows that happen to share a
 * duration.
 */
type Block =
  | { kind: "single"; row: CategorizedEffect }
  | { kind: "group"; name: string; rows: CategorizedEffect[] };

/**
 * Groups adjacent-by-id rows without reordering anything.
 *
 * Order is load-bearing — `categorizeEffects` returns buffs, then debuffs,
 * then grey effects (#30), and a group must not drag a row out of its band.
 * A group is emitted at the position of its FIRST member and collects only
 * members from the same category.
 */
export function blocksFor(rows: CategorizedEffect[]): Block[] {
  const blocks: Block[] = [];
  const taken = new Set<number>();
  rows.forEach((row, i) => {
    if (taken.has(i)) return;
    const id = row.effect.groupId;
    if (!id) {
      blocks.push({ kind: "single", row });
      return;
    }
    const members: CategorizedEffect[] = [];
    rows.forEach((other, j) => {
      if (taken.has(j)) return;
      if (other.effect.groupId !== id) return;
      if (other.category !== row.category) return;
      taken.add(j);
      members.push(other);
    });
    blocks.push({
      kind: "group",
      name: row.effect.groupName ?? prettyName(row.effect),
      rows: members,
    });
  });
  return blocks;
}

/**
 * What a row inside a group is called.
 *
 * The group heading already carries the skill name, so repeating "Stance" on
 * every member says nothing — this names the effect instead.
 */
function groupedLabel(effect: StatusEffect): string {
  if (effect.type === "taunt") return "Taunt";
  if (effect.counterDamagePercent !== undefined) return "Counter";
  if (effect.stat || effect.stats?.length) {
    const phrase = statPhrase(effect);
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
  }
  return prettyName(effect);
}

/** A compact, human description for the row — numbers are tinted by the caller. */
export function effectDescription(effect: StatusEffect): string {
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
  if (effect.type === "taunt") return "Enemies must attack this unit";
  // A counter stance's number is its counter damage, not a stat modifier, so
  // it is stored on its own field and every branch here used to miss it —
  // Meliodas's Full Counter rendered a row with a blank value, which is the
  // entire skill going unsaid while it was active (#131, 2026-09-16).
  if (effect.counterDamagePercent !== undefined) {
    return `Counters attackers for ${effect.counterDamagePercent}% ATK`;
  }
  // Via statPhrase, so an entry declaring `stats: ["atk","def","hp"]` reads
  // "basic stats" instead of losing its stat name entirely — `effect.stat` is
  // undefined on every combined entry (see lib/game/stats.ts).
  const named = effect.stat || effect.stats?.length;
  if (effect.flatValue !== undefined && named) {
    const sign = effect.flatValue >= 0 ? "+" : "";
    return `${sign}${effect.flatValue} ${statPhrase(effect)}`;
  }
  if (effect.valuePercent !== undefined && named) {
    // `damageReduction` reads as "damage taken" (Tanveer's battle-log
    // vocabulary, 2026-08-13), which inverts the sign: a unit with 25%
    // reduction takes 25% LESS. Printed straight, this row said "+25% damage
    // taken" over a stance that was protecting the unit — the opposite of
    // what was happening. The word stays his; only the sign is corrected.
    const inverted = entryTouchesStat(effect, "damageReduction", {
      allCounts: false,
    });
    const shown = inverted ? -effect.valuePercent : effect.valuePercent;
    const sign = shown >= 0 ? "+" : "";
    return `${sign}${shown}% ${statPhrase(effect)}`;
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
  const { buffs, stances, debuffs } = effectCounts(unit);
  if (buffs === 0 && stances === 0 && debuffs === 0) return null;
  // A stance gets its own token rather than being counted as a buff (#133) —
  // it answers a different question ("can this be cancelled, and by what") and
  // it is the one a player decides a turn on. `gap-1.5` rather than `gap-2`
  // because three tokens have to sit in a 44px-wide tile at 390px.
  return (
    <div
      className={`flex items-center gap-1.5 font-body text-xs font-bold tabular-nums ${className}`}
      // One label for the set: separate ones read as unrelated numbers.
      aria-label={`${buffs} buff${buffs === 1 ? "" : "s"}, ${stances} stance${stances === 1 ? "" : "s"}, ${debuffs} debuff${debuffs === 1 ? "" : "s"}`}
    >
      {buffs > 0 ? (
        <span className="flex items-center gap-0.5 text-el-blue">
          <ArrowUp className="h-3 w-3" strokeWidth={3} aria-hidden />
          {buffs}
        </span>
      ) : null}
      {stances > 0 ? (
        <span className="flex items-center gap-0.5 text-el-light">
          <ShieldHalf className="h-3 w-3" strokeWidth={3} aria-hidden />
          {stances}
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
        {blocksFor(rows).flatMap((block, bi) => {
          const cells = (
            { effect, category }: CategorizedEffect,
            key: string,
            inGroup: boolean,
            groupDuration?: number,
          ) => {
            const style = CATEGORY_STYLE[category];
            const Icon = style.icon;
            const duration = memberDurationToShow(
              effect.buffDuration ?? effect.debuffDuration,
              groupDuration,
              inGroup,
            );
            const stacks = effect.stacks ?? 1;
            // Inside a group the stat is already the row's name, so the value
            // column carries the bare number rather than saying it twice.
            const namesItsStat =
              inGroup && Boolean(effect.stat || effect.stats?.length);
            const desc = namesItsStat
              ? effect.valuePercent !== undefined
                ? `${effect.valuePercent >= 0 ? "+" : ""}${effect.valuePercent}%`
                : ""
              : effectDescription(effect);
            return (
              <TableRow key={key}>
                <TableCell className={CELL}>
                  <span
                    className={`flex items-center gap-1.5 ${inGroup ? "pl-3" : ""}`}
                  >
                    {inGroup ? (
                      <span
                        aria-hidden
                        className="shrink-0 text-readout-muted"
                      >
                        ↳
                      </span>
                    ) : (
                      <Icon
                        className={`h-3 w-3 shrink-0 ${style.chip}`}
                        strokeWidth={2.6}
                        aria-hidden
                      />
                    )}
                    <span className="font-heading tracking-[0.04em] text-readout-strong">
                      {inGroup ? groupedLabel(effect) : prettyName(effect)}
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
          };

          if (block.kind === "single") {
            return [cells(block.row, `s-${bi}`, false)];
          }
          const head = block.rows[0];
          const style = CATEGORY_STYLE[head.category];
          const Icon = style.icon;
          const duration =
            head.effect.buffDuration ?? head.effect.debuffDuration;
          return [
            <TableRow key={`g-${bi}`}>
              <TableCell className={CELL} colSpan={3}>
                <span className="flex items-center gap-1.5">
                  <Icon
                    className={`h-3 w-3 shrink-0 ${style.chip}`}
                    strokeWidth={2.6}
                    aria-hidden
                  />
                  <span className="font-heading uppercase tracking-[0.1em] text-readout-strong">
                    {block.name}
                  </span>
                </span>
              </TableCell>
              <TableCell
                className={`${CELL} text-right tabular-nums text-readout-dim`}
              >
                {duration ?? "—"}
              </TableCell>
              <TableCell className="truncate py-1.5 pr-0 pl-0 text-readout-muted">
                {sourceName(head.effect.sourceId)}
              </TableCell>
            </TableRow>,
            ...block.rows.map((row, ri) =>
              cells(row, `g-${bi}-${ri}`, true, duration),
            ),
          ];
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
  const stances = all.filter((r) => r.category === "stance");
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

      {stances.length > 0 ? (
        <section className="space-y-1">
          <h3 className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-el-light">
            Stances
          </h3>
          <EffectTable
            rows={stances}
            allUnits={allUnits}
            emptyText="None active"
          />
        </section>
      ) : null}

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

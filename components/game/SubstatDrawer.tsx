"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import type { BattleCharacter } from "@/types/character";
import {
  getEffectiveCritDamage,
  getEffectiveCritResist,
  getEffectiveLifesteal,
  getEffectiveRecoveryRate,
} from "@/lib/game/substats";

/**
 * Inline "▾ Substats" drawer (spec §4) — expands the 4 built substats in
 * place, no modal. Reused as-is in the character-detail screen (§5) and the
 * cramped in-battle mini-panel (§6), so it must work in a narrow container.
 */
export default function SubstatDrawer({
  unit,
}: {
  unit: BattleCharacter;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  const rows = [
    { label: "Crit Damage", value: getEffectiveCritDamage(unit) },
    { label: "Recovery Rate", value: getEffectiveRecoveryRate(unit) },
    { label: "Lifesteal", value: getEffectiveLifesteal(unit) },
    { label: "Crit Resistance", value: getEffectiveCritResist(unit) },
  ];

  return (
    <div className="border border-zinc-800 bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-h-11 items-center justify-between px-3 py-2 font-body text-xs uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:text-zinc-100"
      >
        <span>Substats</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-zinc-800 px-3 py-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate font-body text-[10px] uppercase tracking-[0.1em] text-zinc-500">
                {row.label}
              </span>
              <span className="shrink-0 font-body text-xs font-semibold text-amber-200">
                {row.value}%
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import React from "react";

import KeyworkHighlighter from "@/components/ui/KeyworkHighlighter";
import DetailOverlay from "@/components/game/DetailOverlay";
import type { DamagePreviewRow } from "@/lib/game/damagePreview";

/**
 * The kit's raw numbers, one ability at a time.
 *
 * **Why this is not a table any more.** It was a six-column `ProseTable` —
 * Ability · Tier · Mult · Scenario · Result · Notes — with a sentence in the
 * last column, rendered at 390px. Tanveer, 2026-09-17: *"when I'm viewing it on
 * a mobile width it is very squeezed… maybe something like a button to modal
 * overlay where it would not show everything, but the skills that are selected
 * — it will show only that detail."* This is that: a button per ability, and
 * the numbers for the one you tapped.
 *
 * **What it shows.** Every step of an ability's own ladder — ranks 1–3 for a
 * skill, ult levels 1–6 for an ultimate (#92) — against a training dummy at a
 * fixed baseline, so the figures are comparable across abilities and across
 * characters. The passive is deliberately excluded: *"the passive doesn't need
 * to be there — it's only the skills and ultimates."*
 */
export default function KitNumbers({
  rows,
}: {
  rows: DamagePreviewRow[];
}): React.JSX.Element | null {
  // Group by ability, preserving kit order. A phase label rides along so a
  // multi-phase boss keeps its two Abyssal Pierces apart.
  const abilities = React.useMemo(() => {
    const order: string[] = [];
    const byKey = new Map<string, DamagePreviewRow[]>();
    for (const row of rows) {
      const key = `${row.phaseLabel ?? ""}|${row.abilityName}`;
      if (!byKey.has(key)) {
        byKey.set(key, []);
        order.push(key);
      }
      byKey.get(key)!.push(row);
    }
    return order.map((key) => ({
      key,
      phaseLabel: byKey.get(key)![0].phaseLabel,
      name: byKey.get(key)![0].abilityName,
      rows: byKey.get(key)!,
    }));
  }, [rows]);

  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const open = abilities.find((ability) => ability.key === openKey);

  if (abilities.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        {abilities.map((ability) => {
          // The ladder's endpoints, which is what makes a closed button worth
          // reading: you can compare abilities without opening any of them.
          const first = ability.rows[0];
          const last = ability.rows[ability.rows.length - 1];
          const span =
            ability.rows.length > 1 && first.resultLabel !== last.resultLabel
              ? `${first.resultLabel} → ${last.resultLabel}`
              : first.resultLabel;
          return (
            <button
              key={ability.key}
              type="button"
              onClick={() => setOpenKey(ability.key)}
              className="flex min-h-11 w-full items-center justify-between gap-3 border border-hairline bg-panel px-3 py-2 text-left transition-colors hover:border-edge-strong"
            >
              <span className="min-w-0">
                {ability.phaseLabel ? (
                  <span className="block font-body text-[9px] font-bold uppercase tracking-label text-readout-muted">
                    {ability.phaseLabel}
                  </span>
                ) : null}
                <span className="block truncate font-heading text-base tracking-title text-readout-strong">
                  {ability.name}
                </span>
                <span className="block font-body text-[10px] uppercase tracking-label text-readout-muted">
                  {ability.rows.length} step
                  {ability.rows.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className="shrink-0 text-right font-heading text-sm tabular-nums text-signal">
                {span}
              </span>
            </button>
          );
        })}
      </div>

      {open ? (
        <DetailOverlay
          title={open.name}
          subtitle={
            open.phaseLabel
              ? `${open.phaseLabel} · vs a training dummy`
              : "vs a training dummy"
          }
          onClose={() => setOpenKey(null)}
        >
          <div className="flex flex-col gap-2">
            {open.rows.map((row) => (
              <div
                key={row.id}
                className="border border-hairline bg-inset px-3 py-2"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-body text-[10px] font-bold uppercase tracking-label text-readout-muted">
                    {row.rankLabel}
                    {row.multiplierLabel === "—"
                      ? ""
                      : ` · ${row.multiplierLabel}`}
                  </span>
                  <span className="font-heading text-lg tabular-nums text-readout-strong">
                    {row.resultLabel}
                  </span>
                </div>
                {row.notes ? (
                  // Full width and wrapping. In the old table this was the
                  // sixth column of six at 390px, which is what squeezed the
                  // whole thing.
                  //
                  // Still through `KeyworkHighlighter`: these notes name
                  // mechanics (Pierce, Decay, Spite), and that component is
                  // what makes them tappable for a definition. Rendering the
                  // string plainly would have deleted the glossary from this
                  // section without anything failing.
                  <KeyworkHighlighter
                    text={row.notes}
                    className="mt-1 block font-body text-[11px] leading-snug text-readout-dim"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </DetailOverlay>
      ) : null}
    </>
  );
}

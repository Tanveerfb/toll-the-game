"use client";

import React from "react";
import Image from "next/image";
import DetailOverlay from "@/components/game/DetailOverlay";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById, getCharacterKit } from "@/lib/game/characterCatalog";
import { ELEMENT_SWATCH } from "@/lib/game/elementSwatch";
import { getEffectiveAttack, getEffectiveDefense } from "@/lib/game/stats";
import type { BattleCharacter } from "@/types/character";

/**
 * Roster list for ONE side of the fight — portrait, element, effective
 * ATK/DEF, signature skill, live HP. Tapping a row opens that unit's detail
 * panel.
 *
 * Takes the team as a parameter rather than hardcoding `playerTeam`: the enemy
 * side had no way into the detail panel at all, even though the panel itself
 * always handled enemy units correctly.
 *
 * No "Lv" callout — the Dokkan reference has character levels on this screen
 * and this game's levels live on the profile, not in battle.
 */
export default function TeamDetailsList({
  team,
  title,
  onSelectUnit,
  onClose,
}: {
  team: BattleCharacter[];
  title: string;
  onSelectUnit: (unit: BattleCharacter) => void;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <DetailOverlay title={title} onClose={onClose}>
      <div className="space-y-2">
        {team.map((unit) => {
          const art = getCharacterArt(unit.id);
          const catalog = getCharacterById(unit.id);
          const kit = catalog
            ? getCharacterKit(catalog, unit.phaseIndex ?? 0)
            : null;
          const signature = kit?.ultimate?.skillName ?? kit?.skills[0]?.skillName;
          const isDead = unit.currentHP <= 0;
          return (
            <button
              key={unit.instanceId}
              type="button"
              onClick={() => onSelectUnit(unit)}
              className={`flex w-full items-center gap-3 border border-hairline bg-inset/40 px-3 py-2 text-left transition-colors hover:border-edge-strong ${isDead ? "opacity-50" : ""}`}
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-edge">
                {art ? (
                  <Image
                    src={art}
                    alt={unit.name}
                    fill
                    sizes="48px"
                    className={`object-cover object-top ${isDead ? "grayscale" : ""}`}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-heading text-lg text-readout-strong/80">
                    {unit.name.charAt(0)}
                  </span>
                )}
              </div>
              <span
                title={unit.color}
                className={`h-2.5 w-2.5 shrink-0 rotate-45 ${ELEMENT_SWATCH[unit.color]}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm tracking-[0.04em] text-readout-strong">
                  {unit.name}
                  {unit.isSub ? (
                    <span className="ml-1.5 font-body text-[9px] uppercase tracking-widest text-signal">
                      Sub
                    </span>
                  ) : null}
                  {isDead ? (
                    <span className="ml-1.5 font-body text-[9px] uppercase tracking-widest text-el-red">
                      Down
                    </span>
                  ) : null}
                </p>
                <p className="truncate font-body text-[10px] uppercase tracking-widest text-readout-muted">
                  {signature ?? "—"}
                </p>
              </div>
              <div className="shrink-0 text-right font-body text-[10px] uppercase tracking-widest text-readout-dim">
                <div className="text-readout tabular-nums">
                  {Math.max(0, unit.currentHP)}/{unit.hp}
                </div>
                <div className="tabular-nums">
                  ATK {getEffectiveAttack(unit)} · DEF {getEffectiveDefense(unit)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </DetailOverlay>
  );
}

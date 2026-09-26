"use client";

import React from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import MountedDialog from "@/components/ui/MountedDialog";
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
    <MountedDialog title={title} onClose={onClose} className="sm:max-w-lg">
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
              className={`flex min-h-11 w-full items-center gap-3 border-2 border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted ${isDead ? "opacity-50" : ""}`}
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden border-2 border-border bg-muted">
                {art ? (
                  <Image
                    src={art}
                    alt={unit.name}
                    fill
                    sizes="48px"
                    className={`object-cover object-top ${isDead ? "grayscale" : ""}`}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-heading text-lg">
                    {unit.name.charAt(0)}
                  </span>
                )}
              </div>
              <span
                aria-label={`Element: ${unit.color}`}
                className={`h-2.5 w-2.5 shrink-0 rotate-45 ${ELEMENT_SWATCH[unit.color]}`}
              />
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1.5 font-heading text-sm tracking-title">
                  <span className="truncate">{unit.name}</span>
                  {unit.isSub ? <Badge variant="secondary">Sub</Badge> : null}
                  {isDead ? <Badge variant="destructive">Down</Badge> : null}
                </p>
                <p className="truncate font-body text-label uppercase tracking-label text-muted-foreground">
                  {signature ?? "—"}
                </p>
              </div>
              <div className="shrink-0 text-right font-body text-label uppercase tracking-label text-muted-foreground">
                <div className="font-bold text-card-foreground tabular-nums">
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
    </MountedDialog>
  );
}

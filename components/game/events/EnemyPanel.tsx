"use client";

import React from "react";
import Image from "next/image";

import { Panel } from "@/components/ui/Panel";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { battleStats } from "@/lib/game/battleStats";

/**
 * An enemy's portrait, tier line and statline - the panel at the top of an
 * event brief.
 *
 * Extracted from `EventBrief` so Epic Battles' stage brief shows its enemy the
 * same way instead of restating the markup. The statline is what the enemy
 * actually fights at, from the same `battleStats` pipeline the battle builds it
 * through (see the note in `EventBrief` - the brief once printed catalog stats
 * beside a level that raised them).
 */
export default function EnemyPanel({
  enemyId,
  fallbackName,
  level,
  phases = 1,
  badge,
}: {
  /** Null for an event that names no single opponent (a trial). */
  enemyId: string | null;
  /** Shown when `enemyId` resolves to no kit. */
  fallbackName: string;
  /** The level the enemy is built at. */
  level: number;
  phases?: number;
  /** The yellow badge under the stats - what makes this fight this fight. */
  badge: React.ReactNode;
}): React.JSX.Element {
  const enemy = enemyId ? getCharacterById(enemyId) : null;
  const art = enemyId ? getCharacterArt(enemyId) : null;
  const stats = enemy
    ? battleStats(enemy, {
        progression: { level, ascension: 0 },
        side: "enemy",
      })
    : null;
  return (
    <Panel surface="paper" lift="slab" className="flex gap-3">
      <span className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-2 border-border bg-muted">
        {art ? (
          <Image
            src={art}
            alt=""
            fill
            sizes="96px"
            className="object-cover object-top"
          />
        ) : (
          <span className="font-heading text-4xl text-muted-foreground">☠</span>
        )}
      </span>
      <div className="min-w-0">
        <p className="font-heading text-xl tracking-title">
          {enemy?.name ?? fallbackName}
        </p>
        {/**
         * Only a named enemy gets a tier line.
         *
         * This read `enemy?.tier === "elite" ? "Elite" : "Standard"`, and a
         * trial resolves no enemy at all — so the First Ascension Trial
         * announced itself as **Standard** while its last fight is Molvarr,
         * who is `tier: "elite"`. A falsy `enemy` was being reported as a
         * fact about the fight (browser check, 2026-09-17).
         */}
        {enemy ? (
          <p className="font-body text-label font-bold uppercase tracking-label text-muted-foreground">
            {enemy.tier === "elite" ? "Elite" : "Standard"}
            {phases > 1 ? ` · ${phases} phases` : ""}
          </p>
        ) : null}
        {stats ? (
          <div className="mt-2 flex gap-4">
            {(
              [
                ["HP", stats.hp],
                ["ATK", stats.atk],
                ["DEF", stats.def],
              ] as const
            ).map(([label, value]) => (
              <span key={label}>
                <span className="block font-body text-label font-bold uppercase tracking-label text-muted-foreground">
                  {label}
                </span>
                <span className="block font-heading text-base tabular-nums">
                  {value.toLocaleString()}
                </span>
              </span>
            ))}
          </div>
        ) : null}
        {badge}
      </div>
    </Panel>
  );
}

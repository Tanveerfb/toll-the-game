"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { INK_TONE } from "@/components/ui/inkTone";
import { panelVariants } from "@/components/ui/Panel";
import { cn } from "@/lib/utils";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { getCharacterArt } from "@/lib/game/characterArt";
import type { FightSummary } from "@/lib/game/fightRun";
import type { TeamPick } from "@/types/teamPick";

/**
 * The battle road — where you are in a multi-fight run, and what is ahead.
 *
 * Tanveer's structure, 2026-09-16, from Dokkan's Super/Extreme Battle Road:
 * *"Clearing one fight will lead to next one. The hp of chars stay. And there
 * is no heal in between."* That rule is ruling #103 and was already what
 * `lib/game/fightRun.ts` does; what the reference adds is **seeing the route**,
 * so a player can read the whole commitment before spending the HP.
 *
 * This is the compact form of it — a vertical rail, one node per fight, the
 * upcoming enemies shown by portrait. The full winding map with a background
 * plate is a Phase 3 item and the art is queued in `docs/ART_REQUESTS.md`; the
 * rail ships today and needs no art that does not already exist, because it
 * composes portraits the roster already has.
 *
 * Two things it deliberately shows that a plain "Fight 2 of 3" line cannot:
 * the enemies waiting in later fights, and the HP the team is carrying into
 * the next one. Both are the information the no-heal rule makes load-bearing.
 */

export interface TrialRailProps {
  /** Every fight in the run, front to back. */
  fights: { enemies: TeamPick[] }[];
  /** Fights already won. Equals the index of the one coming up. */
  cleared: number;
  /** The team's carried state between fights. Fallen units read 0. */
  bars: { id: string; hp: number; max: number }[];
  /**
   * The fight just won, if this screen followed one.
   *
   * **Option C** (Tanveer, 2026-09-20): the win is announced here, on top of
   * the route this screen already draws, rather than on a card in front of it.
   * The card it replaces said CLAIM REWARDS on a run that pays nothing, and
   * its whole body was the turn counter.
   *
   * Absent when the road is shown before fight 1 — there is no fight to report.
   */
  lastFight?: FightSummary;
  onContinue: () => void;
  onQuit: () => void;
}

/** What a fight is called on the road. */
export function fightLabel(enemies: TeamPick[]): string {
  // One enemy is the name a player repeats to themselves; a group has no name
  // this component is entitled to invent (`AGENTS.md` — kits and names are
  // his), so it states the count instead.
  if (enemies.length === 1) {
    return getCharacterById(enemies[0].id)?.name ?? enemies[0].id;
  }
  return `${enemies.length} enemies`;
}

function EnemyPip({ pick, dimmed }: { pick: TeamPick; dimmed: boolean }) {
  const character = getCharacterById(pick.id);
  const art = getCharacterArt(pick.id);
  return (
    <span
      // On the ground, so its edge is `ground-line`: ink is invisible there.
      className={`relative block size-9 shrink-0 overflow-hidden border-2 ${
        dimmed ? "border-ground-line opacity-40" : "border-foreground"
      } bg-ground-raised`}
    >
      {art ? (
        <Image
          src={art}
          alt={character?.name ?? pick.id}
          fill
          sizes="36px"
          className="object-cover object-top"
        />
      ) : (
        // No art registered is not a blocker — the initial reads fine at 36px
        // and the request is queued (docs/ART_REQUESTS.md).
        <span className="flex size-full items-center justify-center font-heading text-sm text-ground-dim">
          {(character?.name ?? pick.id).slice(0, 1).toUpperCase()}
        </span>
      )}
      {pick.isSub ? (
        <span className="absolute inset-x-0 bottom-0 bg-card-foreground/85 text-center font-body text-micro font-bold uppercase tracking-label text-ground-dim">
          Sub
        </span>
      ) : null}
    </span>
  );
}

export default function TrialRail({
  fights,
  cleared,
  bars,
  lastFight,
  onContinue,
  onQuit,
}: TrialRailProps) {
  const next = fights[Math.min(cleared, fights.length - 1)];
  const nextLabel = next ? fightLabel(next.enemies) : null;
  const pooled = bars.reduce(
    (acc, bar) => ({ hp: acc.hp + bar.hp, max: acc.max + bar.max }),
    { hp: 0, max: 0 },
  );
  const pooledPercent = pooled.max > 0 ? (pooled.hp / pooled.max) * 100 : 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      {lastFight ? (
        <div
          className={cn(
            panelVariants({ surface: "paper", density: "none", lift: "primary" }),
            "px-3.5 py-3",
          )}
        >
          <div className="flex items-baseline gap-2.5">
            <span className={cn("font-heading text-2xl leading-none tracking-title", INK_TONE.reward)}>
              VICTORY
            </span>
            <span className="font-body text-label font-bold uppercase tracking-label text-muted-foreground">
              Fight {lastFight.index + 1} of {fights.length}
            </span>
          </div>
          {/* The numbers the card in front of this one never carried: it
              reported the turn counter and nothing else. */}
          <p className="mt-1.5 font-body text-xs text-muted-foreground">
            <b className="font-bold text-card-foreground">
              {lastFight.turns} turns
            </b>
            {" · "}
            <b className={cn("font-bold text-card-foreground", INK_TONE.loss)}>
              -{Math.round(lastFight.hpLostPercent)}% HP
            </b>
            {" · "}
            {lastFight.ultimates} ultimate
            {lastFight.ultimates === 1 ? "" : "s"}
            {lastFight.fallen.length > 0 ? (
              <>
                {" · "}
                <b className={cn("font-bold text-card-foreground", INK_TONE.loss)}>
                  {lastFight.fallen
                    .map((id) => getCharacterById(id)?.name ?? id)
                    .join(", ")}{" "}
                  fell
                </b>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div>
        <p className="font-body text-label font-bold uppercase tracking-eyebrow text-primary">
          Fight {Math.min(cleared + 1, fights.length)} of {fights.length}
        </p>
        <p className="font-heading text-2xl tracking-title">
          No healing between fights
        </p>
      </div>

      <ol className="flex flex-col">
        {fights.map((fight, index) => {
          const done = index < cleared;
          const current = index === cleared;
          return (
            <li key={index} className="flex items-stretch gap-3">
              {/* The rail itself: a node, and a connector to the next one. */}
              <div className="flex w-5 shrink-0 flex-col items-center">
                <span
                  className={`size-3 shrink-0 rotate-45 border ${
                    done
                      ? "border-role-heal bg-role-heal/60"
                      : current
                        ? "border-primary bg-primary"
                        : "border-ground-line bg-ground-raised"
                  }`}
                />
                {index < fights.length - 1 ? (
                  <span
                    className={`w-px flex-1 ${done ? "bg-role-heal/50" : "bg-ground-line"}`}
                  />
                ) : null}
              </div>
              <div
                className={`flex flex-1 items-center gap-2 pb-4 ${
                  current ? "" : "opacity-80"
                }`}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span
                    className={`font-body text-label font-bold uppercase tracking-label ${
                      current ? "text-primary" : "text-ground-dim"
                    }`}
                  >
                    {done
                      ? "Cleared"
                      : current
                        ? `Next — ${fightLabel(fight.enemies)}`
                        : `Fight ${index + 1}`}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {fight.enemies.map((pick, i) => (
                      <EnemyPip key={`${pick.id}-${i}`} pick={pick} dimmed={done} />
                    ))}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className={cn(panelVariants({ surface: "paper", density: "default" }), "flex flex-col gap-2")}>
        <div className="flex items-baseline justify-between">
          <span className="font-body text-label font-bold uppercase tracking-label text-muted-foreground">
            Carried into the next fight
          </span>
          <span className="font-heading text-sm tabular-nums">
            {Math.round(pooledPercent)}%
          </span>
        </div>
        {bars.map((bar) => {
          const percent = bar.max > 0 ? (bar.hp / bar.max) * 100 : 0;
          const character = getCharacterById(bar.id);
          return (
            <div key={bar.id} className="flex items-center gap-2">
              <span className="w-20 shrink-0 truncate font-body text-caption">
                {character?.name ?? bar.id}
              </span>
              <span className="relative h-2 flex-1 border border-border bg-muted">
                <span
                  className={`absolute inset-y-0 left-0 ${
                    bar.hp <= 0 ? "bg-role-attack/40" : "bg-role-heal"
                  }`}
                  style={{ width: `${Math.max(0, percent)}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right font-heading text-caption tabular-nums text-muted-foreground">
                {bar.hp <= 0 ? "DOWN" : `${Math.round(percent)}%`}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {/* The road's one primary action (ruling #154). */}
        <Button onClick={onContinue}>
          {nextLabel ? `Next fight — ${nextLabel}` : "Next fight"}
        </Button>
        <Button variant="outline" size="sm" onClick={onQuit}>
          Abandon run
        </Button>
      </div>
    </div>
  );
}

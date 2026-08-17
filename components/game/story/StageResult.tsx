"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { rankProgress } from "@/lib/game/accountRank";
import { materialLabel } from "@/lib/game/materials";
import type { MissionOutcome } from "@/lib/game/stageMissions";
import type { StageRunSummary } from "@/lib/game/stageMissions";
import { isEmptyPayout, type StageClearResult } from "@/lib/game/storyRewards";
import { usePlayerStore } from "@/store/playerStore";

/**
 * Stage result — arranged as consequence, top to bottom: what the run cost, what
 * it moved, what it paid, where to go.
 *
 * Carried over from the v1 clear summary, which was the one screen worth keeping:
 * the account panel is why a run paying 620 Coin reads as progress rather than as
 * trivia. Two things are new — the **run line** (waves, turns, losses), because
 * with waves the player needs to see what the attrition cost them, and the
 * **mission list**, where an unmet mission reads `STILL OPEN` rather than failed.
 *
 * **No clear time**, on his instruction. Nothing tracks it, and a timer would turn
 * a farm run into a speed test.
 */

interface ItemRow {
  key: string;
  label: string;
  qty: number;
  glyph: string;
  /** From a one-time source (first clear or a mission) rather than the farm roll
   *  — badged BONUS. */
  bonus: boolean;
}

function buildRows(result: StageClearResult): ItemRow[] {
  const once = result.firstClear;
  const missions = result.missions;
  const total = result.total;
  const fromOnce = (pick: (payout: typeof missions) => number) =>
    (once ? pick(once) : 0) + pick(missions) > 0;

  const rows: ItemRow[] = [];
  if (total.gems)
    rows.push({
      key: "gems",
      label: "Gems",
      qty: total.gems,
      glyph: "◈",
      bonus: fromOnce((p) => p.gems),
    });
  if (total.coin)
    rows.push({
      key: "coin",
      label: "Coin",
      qty: total.coin,
      glyph: "◇",
      bonus: fromOnce((p) => p.coin),
    });
  if (total.permanentTicket)
    rows.push({
      key: "ticket",
      label: "Permanent Ticket",
      qty: total.permanentTicket,
      glyph: "▤",
      bonus: fromOnce((p) => p.permanentTicket),
    });
  for (const [id, qty] of Object.entries(total.materials)) {
    if (!qty) continue;
    rows.push({
      key: id,
      label: materialLabel(id),
      qty,
      glyph: "✦",
      bonus: Boolean(once?.materials?.[id] ?? missions.materials[id]),
    });
  }
  return rows;
}

function Item({ row }: { row: ItemRow }): React.JSX.Element {
  return (
    <div className="relative w-[70px] text-center">
      {row.bonus ? (
        <span className="absolute -top-1.5 -left-1 z-10 bg-el-light px-1 font-heading text-[10px] tracking-[0.06em] text-void">
          BONUS
        </span>
      ) : null}
      <span
        className={`flex h-13 items-center justify-center border bg-inset font-heading text-2xl ${row.bonus ? "border-el-light text-el-light" : "border-edge-strong text-readout-dim"}`}
      >
        {row.glyph}
      </span>
      <span className="mt-1 block truncate font-body text-[10px] font-bold text-readout tabular-nums">
        ×{row.qty}
      </span>
      <span className="block truncate font-body text-[9px] tracking-[0.1em] text-readout-muted uppercase">
        {row.label}
      </span>
    </div>
  );
}

export default function StageResult({
  chapterTitle,
  stageLabel,
  stageName,
  run,
  missions,
  result,
  next,
  unlock,
  attemptCost,
  onNext,
  onAgain,
  onStages,
}: {
  chapterTitle: string;
  stageLabel: string;
  stageName: string;
  run: StageRunSummary;
  missions: MissionOutcome[];
  result: StageClearResult;
  /** The stage the story continues into — first clears only (ruling #97). */
  next?: { label: string; name: string } | null;
  /** A Bureau Order this clear just made claimable. */
  unlock?: string | null;
  attemptCost: number;
  onNext?: () => void;
  onAgain: () => void;
  onStages: () => void;
}): React.JSX.Element {
  const account = usePlayerStore((s) => s.account);
  const progress = rankProgress(account, account.clearedWalls);
  const rows = buildRows(result);
  const nothing =
    !result.firstClear &&
    isEmptyPayout(result.missions) &&
    (result.farm === null || isEmptyPayout(result.farm));
  const percent = progress
    ? Math.min(100, Math.round((progress.current / progress.required) * 100))
    : 100;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto">
      <header className="flex-none px-4 pt-5 pb-2 text-center">
        <p className="font-body text-[11px] font-bold tracking-[0.22em] text-readout-muted uppercase">
          {chapterTitle} · {stageLabel}
        </p>
        <h2 className="mt-0.5 font-heading text-3xl leading-none tracking-[0.06em] text-readout-strong">
          {stageName}
        </h2>
        <span className="mt-2 inline-block border border-role-heal/50 px-2 py-0.5 font-body text-[10px] font-bold tracking-[0.18em] text-role-heal uppercase">
          Stage clear
        </span>
        {/* The run line. On a 3-wave stage this is the story of the attempt. */}
        <p className="mt-1.5 font-body text-[11px] tracking-[0.14em] text-readout-dim tabular-nums">
          {run.wavesTotal > 0
            ? `${run.wavesCleared}/${run.wavesTotal} WAVES · ${run.turns} TURNS · ${
                run.fallen.length === 0
                  ? "NO LOSSES"
                  : `${run.fallen.length} LOST`
              }`
            : "SCENE COMPLETE"}
        </p>
      </header>

      <section className="mx-4 mb-2 border border-edge bg-panel px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-body text-[10px] font-bold tracking-[0.18em] text-readout-muted uppercase">
            Rank
          </span>
          <span className="font-heading text-2xl leading-none text-el-light">
            {account.rank}
          </span>
        </div>
        <span className="mt-2 block h-1.5 w-full border border-hairline bg-inset">
          <span className="block h-full bg-signal" style={{ width: `${percent}%` }} />
        </span>
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <span className="font-body text-[10px] font-bold tracking-[0.18em] text-readout-muted uppercase">
            {progress ? "Until next rank" : "Rank wall"}
          </span>
          <span className="font-body text-[11px] font-bold text-readout-dim tabular-nums">
            {progress
              ? `${Math.max(0, progress.required - progress.current)} XP`
              : "Ascend to continue"}
          </span>
        </div>
        {result.total.accountXp > 0 ? (
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-hairline pt-2">
            <span className="font-body text-[10px] font-bold tracking-[0.18em] text-readout-muted uppercase">
              Gained
            </span>
            <span className="font-body text-[11px] font-bold text-el-light tabular-nums">
              +{result.total.accountXp} XP
            </span>
          </div>
        ) : null}
      </section>

      {missions.length > 0 ? (
        <section className="mx-4 mb-2 border border-edge bg-panel px-3 py-2.5">
          <p className="font-body text-[9px] font-bold tracking-[0.22em] text-readout-muted uppercase">
            Missions
          </p>
          <ul className="mt-1">
            {missions.map((outcome) => {
              const banked = outcome.alreadyClaimed;
              const paid = outcome.paysNow;
              return (
                <li
                  key={outcome.mission.id}
                  className={`flex items-center gap-2.5 border-b border-gridline py-1.5 text-[13px] last:border-b-0 ${
                    outcome.met ? "text-readout" : "text-readout-muted"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`h-4 w-4 shrink-0 border ${
                      outcome.met || banked
                        ? "border-el-light bg-el-light"
                        : "border-edge-strong"
                    }`}
                  />
                  <span className="min-w-0">{outcome.mission.label}</span>
                  <span className="ml-auto shrink-0 font-body text-[10px] font-bold tracking-[0.16em] uppercase">
                    {paid ? (
                      <span className="text-el-light">Claimed now</span>
                    ) : banked ? (
                      <span className="text-readout-muted">Claimed</span>
                    ) : (
                      // Never "failed": an unmet mission stays claimable on any
                      // future run of this stage.
                      <span className="text-readout-muted">Still open</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mx-4 mb-2 border border-edge bg-panel px-3 py-2.5">
        <p className="font-body text-[9px] font-bold tracking-[0.22em] text-readout-muted uppercase">
          Obtained
        </p>
        {nothing ? (
          <p className="mt-2 font-body text-[11px] text-readout-muted">
            No drops this run.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2.5">
            {rows.map((row) => (
              <Item key={row.key} row={row} />
            ))}
          </div>
        )}
      </section>

      {unlock ? (
        <p className="mx-4 mb-2 border-l-2 border-el-light bg-el-light/6 px-3 py-2 font-body text-xs leading-relaxed text-readout">
          <span className="font-semibold text-el-light">◈ {unlock}</span> is yours —
          claim it in Orders.
        </p>
      ) : null}

      <footer
        className="mt-auto flex flex-none flex-col gap-2 border-t border-hairline bg-inset px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {next && onNext ? (
          <>
            <Button onClick={onNext} size="xl" className="chamfer">
              NEXT · {next.label} ▸
            </Button>
            <p className="-mt-1 truncate text-center font-body text-[11px] font-bold tracking-[0.16em] text-readout-muted uppercase">
              {next.name}
            </p>
          </>
        ) : null}
        <div className="flex gap-2">
          <Button
            onClick={onAgain}
            variant="outline"
            size="lg"
            className="chamfer flex-1 text-sm"
          >
            AGAIN{attemptCost > 0 ? ` · ${attemptCost}` : ""}
          </Button>
          <Button
            onClick={onStages}
            variant="outline"
            size="lg"
            className="chamfer flex-1 text-sm"
          >
            STAGES
          </Button>
        </div>
      </footer>
    </div>
  );
}

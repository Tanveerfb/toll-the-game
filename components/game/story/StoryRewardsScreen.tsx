"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { rankProgress } from "@/lib/game/accountRank";
import { materialLabel } from "@/lib/game/materials";
import { isEmptyPayout, type StoryClearResult } from "@/lib/game/storyRewards";
import { usePlayerStore } from "@/store/playerStore";

/**
 * The clear summary, arranged as Dokkan's results screen (Tanveer's reference,
 * 2026-08-17): what you're worth now, then what you just got, then where to go.
 *
 * It replaced a two-section list of `+N` rows. The difference that matters is the
 * account panel — a run that pays 620 Coin and 40 XP reads as trivial when the
 * only thing on screen is the coin, and as progress when the rank bar moves
 * under it.
 *
 * **No clear time**, on his instruction. Nothing tracks it anyway, and adding a
 * timer would make a farm route feel like a speed test.
 *
 * Item art doesn't exist yet — `public/` has no items directory. The glyphs
 * below are the fallback, and the icons are queued as Category C in
 * `docs/ART_REQUESTS.md`; when they land, only the `ico` span changes.
 */

interface ItemRow {
  key: string;
  label: string;
  qty: number;
  glyph: string;
  /** From the one-time bundle rather than the drop roll — badged BONUS. */
  bonus: boolean;
}

function buildRows(result: StoryClearResult): ItemRow[] {
  const bonus = result.firstClear;
  const total = result.total;
  const rows: ItemRow[] = [];
  if (total.gems)
    rows.push({
      key: "gems",
      label: "Gems",
      qty: total.gems,
      glyph: "◈",
      bonus: Boolean(bonus?.gems),
    });
  if (total.coin)
    rows.push({
      key: "coin",
      label: "Coin",
      qty: total.coin,
      glyph: "◇",
      bonus: Boolean(bonus?.coin),
    });
  if (total.permanentTicket)
    rows.push({
      key: "ticket",
      label: "Permanent Ticket",
      qty: total.permanentTicket,
      glyph: "▤",
      bonus: Boolean(bonus?.permanentTicket),
    });
  for (const [id, qty] of Object.entries(total.materials)) {
    if (!qty) continue;
    rows.push({
      key: id,
      label: materialLabel(id),
      qty,
      glyph: "✦",
      bonus: Boolean(bonus?.materials?.[id]),
    });
  }
  return rows;
}

function Item({ row }: { row: ItemRow }): React.JSX.Element {
  return (
    <div className="relative w-[70px] text-center">
      {row.bonus ? (
        <span className="absolute -left-1 -top-1.5 z-10 bg-el-light px-1 font-heading text-[10px] tracking-[0.06em] text-void">
          BONUS
        </span>
      ) : null}
      <span
        className={`flex h-13 items-center justify-center border bg-inset font-heading text-2xl ${row.bonus ? "border-el-light text-el-light" : "border-edge-strong text-readout-dim"}`}
      >
        {row.glyph}
      </span>
      <span className="mt-1 block truncate font-body text-[10px] font-bold tabular-nums text-readout">
        ×{row.qty}
      </span>
      <span className="block truncate font-body text-[9px] uppercase tracking-[0.1em] text-readout-muted">
        {row.label}
      </span>
    </div>
  );
}

export default function StoryRewardsScreen({
  partTitle,
  chapterTitle,
  result,
  next,
  unlock,
  attemptCost,
  onNext,
  onAgain,
  onContinue,
}: {
  partTitle: string;
  chapterTitle: string;
  result: StoryClearResult;
  /** The chapter the story continues into — first clears only. */
  next?: { title: string; number: number } | null;
  /** A Bureau Order this clear just made claimable. */
  unlock?: string | null;
  attemptCost: number;
  onNext?: () => void;
  onAgain: () => void;
  onContinue: () => void;
}): React.JSX.Element {
  const account = usePlayerStore((s) => s.account);
  const progress = rankProgress(account, account.clearedWalls);
  const rows = buildRows(result);
  const nothing = !result.firstClear && isEmptyPayout(result.drops);
  const percent = progress
    ? Math.min(100, Math.round((progress.current / progress.required) * 100))
    : 100;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex-none px-4 pb-2 pt-5 text-center">
        <p className="font-body text-[11px] font-bold uppercase tracking-[0.22em] text-readout-muted">
          {partTitle}
        </p>
        <h2 className="mt-0.5 font-heading text-3xl leading-none tracking-[0.06em] text-readout-strong">
          {chapterTitle}
        </h2>
        <span className="mt-2 inline-block border border-role-heal/50 px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-[0.18em] text-role-heal">
          Chapter cleared
        </span>
      </header>

      <section className="mx-4 mb-2 border border-edge bg-panel px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
            Rank
          </span>
          <span className="font-heading text-2xl leading-none text-el-light">
            {account.rank}
          </span>
        </div>
        <span className="mt-2 block h-1.5 w-full border border-hairline bg-inset">
          <span
            className="block h-full bg-signal"
            style={{ width: `${percent}%` }}
          />
        </span>
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
            {progress ? "Until next rank" : "Rank wall"}
          </span>
          <span className="font-body text-[11px] font-bold tabular-nums text-readout-dim">
            {progress
              ? `${Math.max(0, progress.required - progress.current)} XP`
              : "Ascend to continue"}
          </span>
        </div>
        {result.total.accountXp > 0 ? (
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-hairline pt-2">
            <span className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
              Gained
            </span>
            <span className="font-body text-[11px] font-bold tabular-nums text-el-light">
              +{result.total.accountXp} XP
            </span>
          </div>
        ) : null}
      </section>

      <section className="mx-4 mb-2 border border-edge bg-panel px-3 py-2.5">
        <p className="font-body text-[9px] font-bold uppercase tracking-[0.22em] text-readout-muted">
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

      {/* Only when there is one. The reference prints "None" into an
          otherwise-empty panel; a 9:16 screen has better uses for the height. */}
      {unlock ? (
        <p className="mx-4 mb-2 border-l-2 border-el-light bg-el-light/6 px-3 py-2 font-body text-xs leading-relaxed text-readout">
          <span className="font-semibold text-el-light">◈ {unlock}</span> is
          yours — claim it in Orders.
        </p>
      ) : null}

      <footer
        className="mt-auto flex flex-none flex-col gap-2 border-t border-hairline bg-inset px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {next && onNext ? (
          <>
            <Button onClick={onNext} size="xl" className="chamfer">
              CHAPTER {next.number} ▸
            </Button>
            <p className="-mt-1 truncate text-center font-body text-[11px] font-bold uppercase tracking-[0.16em] text-readout-muted">
              {next.title}
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
            ATTEMPT AGAIN{attemptCost > 0 ? ` · ${attemptCost}` : ""}
          </Button>
          <Button
            onClick={onContinue}
            variant="outline"
            size="lg"
            className="chamfer flex-1 text-sm"
          >
            CHAPTERS
          </Button>
        </div>
      </footer>
    </div>
  );
}

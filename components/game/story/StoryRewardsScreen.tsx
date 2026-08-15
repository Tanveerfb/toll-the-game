"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { materialLabel } from "@/lib/game/materials";
import { isEmptyPayout, type StoryClearResult, type StoryPayout } from "@/lib/game/storyRewards";

/** Flattens a payout into display rows, dropping zero entries so a section
 *  never renders "+0 Gems". */
function payoutRows(payout: StoryPayout): Array<[string, number]> {
  const rows: Array<[string, number]> = [];
  if (payout.gems) rows.push(["Gems", payout.gems]);
  if (payout.coin) rows.push(["Coin", payout.coin]);
  if (payout.permanentTicket) rows.push(["Permanent Ticket", payout.permanentTicket]);
  for (const [id, qty] of Object.entries(payout.materials)) {
    if (qty) rows.push([materialLabel(id), qty]);
  }
  return rows;
}

function RewardSection({
  heading,
  payout,
  accent,
}: {
  heading: string;
  payout: StoryPayout;
  accent: string;
}): React.JSX.Element | null {
  const rows = payoutRows(payout);
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className={`font-body text-[9px] font-bold uppercase tracking-[0.22em] ${accent}`}>{heading}</p>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between border-b border-hairline pb-2">
          <span className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-readout-dim">{label}</span>
          <span className="font-heading text-xl tabular-nums text-readout-strong">+{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function StoryRewardsScreen({
  chapterTitle,
  result,
  next,
  onNext,
  onContinue,
}: {
  chapterTitle: string;
  result: StoryClearResult;
  /** The chapter the story continues into, when there is one and this was a
   *  first clear. Null on a replay or at the end of the arc, which is what
   *  drops this screen back to a single CONTINUE. */
  next?: { title: string; number: number } | null;
  onNext?: () => void;
  onContinue: () => void;
}): React.JSX.Element {
  // A chapter can legitimately roll nothing (a 0-min range hitting 0 with no
  // coin entry), and a screen with a heading and no rows reads like a bug.
  const nothingDropped = !result.firstClear && isEmptyPayout(result.drops);

  return (
    <Card className="chamfer-lg w-full max-w-md border-signal bg-panel">
      <CardHeader className="bg-inset px-6 py-5">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.28em] text-signal">
          {chapterTitle}
        </p>
        <CardTitle className="mt-1 text-3xl tracking-[0.14em] text-signal">
          REWARDS
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-6 py-6">
        {result.firstClear ? (
          <RewardSection
            heading="First clear bonus"
            payout={result.firstClear}
            accent="text-role-ultimate"
          />
        ) : null}
        <RewardSection heading="Drops" payout={result.drops} accent="text-readout-muted" />
        {nothingDropped ? (
          <p className="font-body text-sm text-readout-muted">No drops this run.</p>
        ) : null}
        {/* Clearing a chapter used to end at the index, leaving the player to
            find chapter N+1 themselves. Naming the next chapter here is the
            difference between a story that continues and a menu you keep
            returning to. */}
        {next && onNext ? (
          <div className="mt-2 flex flex-col gap-2">
            <Button onClick={onNext} size="xl" className="chamfer">
              CHAPTER {next.number} ▸
            </Button>
            <p className="-mt-1 truncate text-center font-body text-[11px] font-bold uppercase tracking-[0.16em] text-readout-muted">
              {next.title}
            </p>
            <Button
              onClick={onContinue}
              variant="ghost"
              size="lg"
              className="chamfer text-sm hover:text-signal"
            >
              BACK TO STORY
            </Button>
          </div>
        ) : (
          <Button
            onClick={onContinue}
            size="xl"
            className="chamfer mt-2"
          >
            CONTINUE
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

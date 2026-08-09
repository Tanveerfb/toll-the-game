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
      <p className={`font-body text-[10px] uppercase tracking-[0.16em] ${accent}`}>{heading}</p>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <span className="font-body text-sm uppercase tracking-[0.12em] text-zinc-400">{label}</span>
          <span className="font-heading text-xl text-zinc-100">+{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function StoryRewardsScreen({
  chapterTitle,
  result,
  onContinue,
}: {
  chapterTitle: string;
  result: StoryClearResult;
  onContinue: () => void;
}): React.JSX.Element {
  // A chapter can legitimately roll nothing (a 0-min range hitting 0 with no
  // coin entry), and a screen with a heading and no rows reads like a bug.
  const nothingDropped = !result.firstClear && isEmptyPayout(result.drops);

  return (
    <Card className="w-full max-w-md rounded-none border-2 border-amber-300 bg-black/70 ring-0">
      <CardHeader className="border-b border-zinc-800 px-6 py-5">
        <p className="font-body text-xs uppercase tracking-[0.16em] text-zinc-500">
          {chapterTitle}
        </p>
        <CardTitle className="mt-1 font-heading text-3xl tracking-[0.14em] text-amber-300">
          REWARDS
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-6 py-6">
        {result.firstClear ? (
          <RewardSection
            heading="First clear bonus"
            payout={result.firstClear}
            accent="text-amber-300"
          />
        ) : null}
        <RewardSection heading="Drops" payout={result.drops} accent="text-sky-300" />
        {nothingDropped ? (
          <p className="font-body text-sm text-zinc-500">No drops this run.</p>
        ) : null}
        <Button
          onClick={onContinue}
          className="mt-2 h-12 rounded-none border-2 border-amber-300 font-heading text-lg tracking-[0.14em]"
        >
          CONTINUE
        </Button>
      </CardContent>
    </Card>
  );
}

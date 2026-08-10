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
    <Card className="chamfer-lg w-full max-w-md rounded-none border border-signal bg-panel ring-0">
      <CardHeader className="border-b border-hairline bg-inset px-6 py-5">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.28em] text-signal">
          {chapterTitle}
        </p>
        <CardTitle className="mt-1 font-heading text-3xl tracking-[0.14em] text-signal">
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
        <Button
          onClick={onContinue}
          className="chamfer mt-2 h-12 rounded-none border border-signal bg-signal font-heading text-lg tracking-[0.12em] text-void"
        >
          CONTINUE
        </Button>
      </CardContent>
    </Card>
  );
}

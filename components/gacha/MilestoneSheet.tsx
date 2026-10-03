"use client";

import React from "react";
import ClaimSection from "@/components/gacha/ClaimSection";
import PanelSheet from "@/components/ui/PanelSheet";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The milestone track and its rewards, behind the milestone panel.
 *
 * The track used to sit on the summon page above the draw buttons, which cost
 * the page a screen of scrolling to carry something read a few times a session.
 * The page now shows the bar and a "Claim" badge when something is owed, and
 * this sheet holds the rest. Claiming works exactly as it did: `ClaimSection`
 * is unchanged.
 *
 * A claim ends in the results screen, so the sheet closes first; the results
 * should not open over it.
 */

/** Where a milestone marker sits on the track, as a percentage. */
function markerAt(threshold: number, final: number): number {
  return Math.min(100, (threshold / final) * 100);
}

type ClaimProps = React.ComponentProps<typeof ClaimSection>;

export default function MilestoneSheet({
  trigger,
  hasHydrated,
  unit,
  bar,
  firstThreshold,
  finalThreshold,
  onClaimFirst,
  onClaimFinal,
  ...claim
}: {
  /** The panel that opens this sheet. */
  trigger: React.ReactNode;
  hasHydrated: boolean;
  /** "gems" / "tickets". Already plural. */
  unit: string;
} & ClaimProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const barPercent = Math.min(100, (bar / finalThreshold) * 100);

  return (
    <PanelSheet
      trigger={trigger}
      title="Milestone"
      description={
        <>
          {hasHydrated ? bar.toLocaleString() : <Skeleton className="h-3 w-8" />} /{" "}
          {finalThreshold.toLocaleString()} {unit} spent
        </>
      }
      open={open}
      onOpenChange={setOpen}
    >
      <div className="relative mt-1 mb-5 h-2.5 border border-border bg-muted">
        <span
          className="block h-full bg-primary transition-[width] duration-500"
          style={{ width: hasHydrated ? `${barPercent}%` : "0%" }}
        />
        {firstThreshold !== null ? (
          <span
            className="absolute -top-1 h-4.5 w-0.5 bg-border"
            style={{ left: `${markerAt(firstThreshold, finalThreshold)}%` }}
          >
            <span className="absolute left-1/2 top-5 -translate-x-1/2 font-body text-label font-bold tabular-nums text-muted-foreground">
              {firstThreshold}
            </span>
          </span>
        ) : null}
        <span className="absolute -top-1 right-0 h-4.5 w-1 border border-border bg-el-light">
          <span className="absolute left-1/2 top-5 -translate-x-1/2 font-body text-label font-bold tabular-nums text-muted-foreground">
            {finalThreshold}
          </span>
        </span>
      </div>

      <ClaimSection
        {...claim}
        bar={bar}
        firstThreshold={firstThreshold}
        finalThreshold={finalThreshold}
        onClaimFirst={() => {
          setOpen(false);
          onClaimFirst();
        }}
        onClaimFinal={(characterId) => {
          setOpen(false);
          onClaimFinal(characterId);
        }}
      />
    </PanelSheet>
  );
}

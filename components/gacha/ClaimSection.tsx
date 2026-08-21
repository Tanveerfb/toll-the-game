"use client";

import React from "react";
import MilestonePicker from "@/components/gacha/MilestonePicker";

/**
 * The milestone rewards, always on screen.
 *
 * This block used to carry `hidden` until something was claimable, so the
 * entire 300/600 system was invisible right up until it fired — a player had
 * no way to learn it existed, or how far off it was (Tanveer, 2026-08-11).
 *
 * It also encodes the rule that replaced the old reset-on-final behaviour: the
 * lap only wraps once *every* reward on it has been taken, so an unclaimed
 * first milestone can no longer be destroyed by claiming the final one.
 */

function Row({
  threshold,
  title,
  detail,
  bar,
  claimable,
  claimed,
  onClaim,
}: {
  threshold: number;
  title: string;
  detail: string;
  bar: number;
  claimable: boolean;
  claimed: boolean;
  onClaim: () => void;
}): React.JSX.Element {
  const remaining = Math.max(0, threshold - bar);
  return (
    <div
      className={`flex items-center gap-3 border px-3 py-2.5 ${
        claimable ? "border-el-light bg-el-light/8" : "border-hairline bg-panel"
      }`}
    >
      <span className="w-12 shrink-0 font-heading text-xl leading-none tabular-nums text-readout-strong">
        {threshold}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-sm font-semibold text-readout-strong">
          {title}
        </span>
        <span className="block font-body text-[11px] text-readout-muted">
          {claimed
            ? "Claimed this lap"
            : remaining > 0
              ? `${detail} · ${remaining.toLocaleString()} gems to go`
              : detail}
        </span>
      </span>
      {claimable ? (
        <button
          type="button"
          onClick={onClaim}
          className="flex min-h-11 shrink-0 items-center border border-el-light bg-el-light/12 px-4 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-el-light transition-colors hover:bg-el-light/20"
        >
          Claim
        </button>
      ) : (
        <span className="shrink-0 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-readout-muted">
          {claimed ? "Taken" : "Locked"}
        </span>
      )}
    </div>
  );
}

export default function ClaimSection({
  bar,
  firstThreshold,
  finalThreshold,
  firstTitle,
  firstDetail,
  claimableFirst,
  claimedFirst,
  claimableFinal,
  claimedFinal,
  featured,
  onClaimFirst,
  onClaimFinal,
}: {
  bar: number;
  firstThreshold: number | null;
  finalThreshold: number;
  firstTitle: string;
  firstDetail: string;
  claimableFirst: boolean;
  claimedFirst: boolean;
  claimableFinal: boolean;
  claimedFinal: boolean;
  featured: string[];
  onClaimFirst: () => void;
  onClaimFinal: (characterId: string) => void;
}): React.JSX.Element {
  const [showPicker, setShowPicker] = React.useState(false);

  // The bar has reached the end but something on it is still unclaimed — so
  // it isn't going to wrap yet, and the player should know why.
  const heldOpen =
    bar >= finalThreshold &&
    ((firstThreshold !== null && !claimedFirst) || !claimedFinal);

  return (
    <>
      <div className="flex flex-col gap-2">
        {firstThreshold !== null ? (
          <Row
            threshold={firstThreshold}
            title={firstTitle}
            detail={firstDetail}
            bar={bar}
            claimable={claimableFirst}
            claimed={claimedFirst}
            onClaim={onClaimFirst}
          />
        ) : null}
        <Row
          threshold={finalThreshold}
          title="Pick any featured unit"
          detail="Your choice from the banner"
          bar={bar}
          claimable={claimableFinal}
          claimed={claimedFinal}
          onClaim={() => setShowPicker(true)}
        />
        {heldOpen ? (
          <p className="border-l-2 border-signal bg-signal/5 px-3 py-2 font-body text-[11px] leading-snug text-readout-dim">
            The bar keeps running until every reward on this lap is taken —
            claiming the last one first can&rsquo;t cost you the other.
          </p>
        ) : null}
      </div>

      {showPicker ? (
        <MilestonePicker
          characterIds={featured}
          onPick={(characterId) => {
            onClaimFinal(characterId);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      ) : null}
    </>
  );
}

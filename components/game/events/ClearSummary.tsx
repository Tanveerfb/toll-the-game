"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { RewardList } from "@/components/game/events/RewardList";
import { rewardRows } from "@/lib/game/worldBossPreview";
import type { WorldBossRewards } from "@/lib/game/worldBossRewards";

/**
 * The panel a cleared event lands on.
 *
 * The boss and the trial screens were two hand-built copies of one layout —
 * centred panel, inset header carrying `<event> cleared` above a title, then a
 * body. They diverged only in what the body says, which is the one thing that
 * genuinely differs: a boss pays a loot table, a trial pays a lifted rank cap
 * and nothing else.
 */
function ClearPanel({
  eventName,
  title,
  children,
}: {
  eventName: string;
  title: React.ReactNode;
  /** The body, including its own "back" action — see the two callers. */
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Screen variant="center" width="none" className="px-4">
      <Panel density="none" className="w-full max-w-panel">
        <PanelHeader>
          <SectionHeader
            size="panel"
            eyebrow={`${eventName} cleared`}
            title={title}
          />
        </PanelHeader>
        <PanelBody className="flex flex-col gap-1.5">{children}</PanelBody>
      </Panel>
    </Screen>
  );
}

/** A world-boss clear: the itemised payout. */
export function BossClearSummary({
  eventName,
  rewards,
  onBack,
}: {
  eventName: string;
  rewards: WorldBossRewards;
  onBack: () => void;
}): React.JSX.Element {
  return (
    <ClearPanel eventName={eventName} title="Rewards">
      <RewardList rows={rewardRows(rewards)} />
      <Button variant="secondary" size="sm" onClick={onBack} className="mt-3">
        Back to events
      </Button>
    </ClearPanel>
  );
}

/**
 * An ascension-trial clear: no loot table at all.
 *
 * The lifted cap IS the reward, plus every rank banked while the player sat
 * against the wall, which `clearRankWall` pays out at once. That payout is why
 * a wall does not punish you for playing through it — and it has to be said
 * out loud, because several ranks arriving in one frame otherwise reads as a
 * glitch.
 */
export function TrialClearSummary({
  eventName,
  wall,
  rankBefore,
  rankAfter,
  onBack,
}: {
  eventName: string;
  wall: number;
  rankBefore: number;
  rankAfter: number;
  onBack: () => void;
}): React.JSX.Element {
  const gained = rankAfter - rankBefore;
  return (
    <ClearPanel
      eventName={eventName}
      title={`Rank ${wall} cap lifted`}
    >
      <p className="font-body text-sm text-readout-dim">
        {gained > 0
          ? `Account rank ${rankBefore} → ${rankAfter}. Everything you earned against the wall paid out at once, and stamina is full.`
          : `Account rank ${rankAfter}. Ranks climb again from here.`}
      </p>
      <div className="flex items-center justify-between gap-3 border-b border-hairline pb-1.5">
        <span className="font-body text-sm text-readout-dim">Account rank</span>
        <span className="font-heading text-lg tabular-nums text-readout-strong">
          {rankAfter}
          {gained > 0 ? ` (+${gained})` : ""}
        </span>
      </div>
      <Button variant="secondary" size="sm" onClick={onBack} className="mt-3">
        Back to events
      </Button>
    </ClearPanel>
  );
}

/**
 * Shown only if a trial view outlives its encounter — a configuration error,
 * not a player-facing state. It exists so the guard has somewhere to go.
 */
export function TrialMissing({
  onBack,
}: {
  onBack: () => void;
}): React.JSX.Element {
  return (
    <Screen variant="center" width="none" className="px-4">
      <Panel density="roomy" className="w-full max-w-panel">
        <p className="font-body text-sm text-readout-dim">
          This trial has no encounter authored.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={onBack}
          className="mt-3 w-full"
        >
          Back to events
        </Button>
      </Panel>
    </Screen>
  );
}

"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { INK_TONE } from "@/components/ui/inkTone";
import { cn } from "@/lib/utils";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { RewardList } from "@/components/game/events/RewardList";
import { fightLabel } from "@/components/game/events/TrialRail";
import { MAX_ACCOUNT_RANK, RANK_WALLS } from "@/lib/game/accountRank";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { fightSummaries, type FightRunState } from "@/lib/game/fightRun";
import { rewardRows } from "@/lib/game/worldBossPreview";
import type { WorldBossRewards } from "@/lib/game/worldBossRewards";
import type { TeamPick } from "@/types/teamPick";

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
      <Panel surface="paper" lift="slab" density="none" className="w-full max-w-panel">
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
      <Button onClick={onBack} className="mt-3">
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
/** One line of the "what this opened" block. */
function UnlockRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 border border-rule bg-muted px-2.5 py-2">
      <span className="font-body text-xs">{label}</span>
      <span className={cn("font-heading text-base tabular-nums", INK_TONE.reward)}>
        {value}
      </span>
    </div>
  );
}

export function TrialClearSummary({
  eventName,
  wall,
  rankBefore,
  rankAfter,
  run,
  fights,
  onBack,
}: {
  eventName: string;
  wall: number;
  rankBefore: number;
  rankAfter: number;
  /** The finished run. Absent on the older single-fight trial route, which
   *  never builds one — that path shows the unlock block alone. */
  run?: FightRunState;
  /** The encounter's fights, for naming each recap row. */
  fights?: { enemies: TeamPick[] }[];
  onBack: () => void;
}): React.JSX.Element {
  const gained = rankAfter - rankBefore;
  const ceiling = RANK_WALLS.find((next) => next > wall) ?? MAX_ACCOUNT_RANK;
  const summaries = run ? fightSummaries(run) : [];
  const survivors = run ? run.team.length - run.fallen.length : 0;
  const ended = summaries.length
    ? Math.round(summaries[summaries.length - 1].hpLeftPercent)
    : null;

  return (
    <ClearPanel eventName={eventName} title="Trial cleared">
      {/* Option E (Tanveer, 2026-09-20): the run first, then what it opened.
          It was a three-fight commitment on one HP bar, so the recap is what
          makes the attrition rule (#103) legible in hindsight. */}
      {summaries.length > 0 ? (
        <>
          <p className="font-body text-label font-bold uppercase tracking-label text-muted-foreground">
            The run
          </p>
          <ol className="flex flex-col gap-1">
            {summaries.map((fight) => {
              const enemies = fights?.[fight.index]?.enemies;
              return (
                <li
                  key={fight.index}
                  className="border-l-4 border-role-heal bg-muted px-2.5 py-1.5"
                >
                  <span className="font-body text-label font-bold uppercase tracking-label text-muted-foreground">
                    Fight {fight.index + 1}
                    {enemies ? ` — ${fightLabel(enemies)}` : ""}
                  </span>
                  <p className="font-body text-xs text-muted-foreground">
                    <b className="font-bold text-card-foreground">
                      {fight.turns} turns
                    </b>
                    {" · "}
                    <b className={cn("font-bold text-card-foreground", INK_TONE.loss)}>
                      -{Math.round(fight.hpLostPercent)}% HP
                    </b>
                    {fight.fallen.length > 0 ? (
                      <>
                        {" · "}
                        <b className={cn("font-bold text-card-foreground", INK_TONE.loss)}>
                          {fight.fallen
                            .map((id) => getCharacterById(id)?.name ?? id)
                            .join(", ")}{" "}
                          fell
                        </b>
                      </>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="mt-1 border border-rule bg-muted px-2.5">
            <div className="flex items-baseline justify-between gap-3 border-b border-rule py-1.5">
              <span className="font-body text-xs">
                Total turns
              </span>
              <span className="font-heading text-base tabular-nums">
                {run ? run.turns : 0}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-rule py-1.5">
              <span className="font-body text-xs">
                Survivors
              </span>
              <span className={cn("font-heading text-base tabular-nums", INK_TONE.gain)}>
                {survivors} of {run ? run.team.length : 0}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="font-body text-xs">
                Ended on
              </span>
              <span className="font-heading text-base tabular-nums">
                {ended === null ? "—" : `${ended}% HP`}
              </span>
            </div>
          </div>
        </>
      ) : null}

      <p className="mt-2 font-body text-label font-bold uppercase tracking-label text-muted-foreground">
        What this opened
      </p>
      <UnlockRow label="Account rank ceiling" value={`${wall} → ${ceiling}`} />
      {gained > 0 ? (
        <>
          <UnlockRow label="Banked ranks paid out" value={`+${gained}`} />
          <UnlockRow label="Stamina" value="Refilled" />
        </>
      ) : null}
      {gained > 0 ? (
        <p className="font-body text-xs leading-relaxed text-muted-foreground">
          Every rank you earned while held at the wall paid out at once, which
          is why several arrived together.
        </p>
      ) : (
        <p className="font-body text-xs leading-relaxed text-muted-foreground">
          Account rank {rankAfter}. Ranks climb again from here.
        </p>
      )}
      <Button onClick={onBack} className="mt-3">
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
      <Panel surface="paper" density="roomy" className="w-full max-w-panel">
        <p className="font-body text-sm">
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

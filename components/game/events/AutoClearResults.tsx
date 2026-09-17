"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DetailOverlay from "@/components/game/DetailOverlay";
import { RewardList } from "@/components/game/events/RewardList";
import { rewardRows } from "@/lib/game/worldBossPreview";
import type { WorldBossRewards } from "@/lib/game/worldBossRewards";

/** One skipped fight, as the results table reports it. */
export interface AutoClearRun {
  id: string;
  staminaUsed: number;
  staminaAfter: number;
  rewards: WorldBossRewards;
}

/**
 * Auto Clear's results, as Tanveer specified them: a row per skipped run
 * carrying that run's id, the stamina it cost and what was left afterwards,
 * with its rewards behind a button; then a totals row with the same button for
 * the combined haul.
 *
 * A row per run rather than one merged number because the runs are not
 * identical — each rolls its own drops, and a rank-up mid-batch refills the
 * bar, which the stamina-after column shows as the jump it was.
 */
export default function AutoClearResults({
  eventName,
  runs,
  totals,
  onBack,
}: {
  eventName: string;
  runs: AutoClearRun[];
  totals: WorldBossRewards;
  onBack: () => void;
}): React.JSX.Element {
  // `null` = closed. A run id or "total" names which breakdown is open, so one
  // modal serves every row instead of one per run.
  const [open, setOpen] = React.useState<string | null>(null);
  const openRun = runs.find((run) => run.id === open);
  const openRewards = open === "total" ? totals : openRun?.rewards;
  const totalStamina = runs.reduce((sum, run) => sum + run.staminaUsed, 0);

  return (
    <Screen variant="center" width="none" className="px-4 py-6">
      {/* Wider than `max-w-panel`: this one carries a four-column table, and
          the table sets its own `min-w` and scrolls inside itself. */}
      <Panel density="none" className="w-full max-w-lg">
        <PanelHeader>
          <SectionHeader
            size="panel"
            eyebrow={`${eventName} · auto cleared`}
            title={`${runs.length} run${runs.length === 1 ? "" : "s"}`}
          />
        </PanelHeader>

        <Table className="min-w-[26rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Instance</TableHead>
              <TableHead className="px-2 text-right">Stamina</TableHead>
              <TableHead className="px-2 text-right">Remaining</TableHead>
              <TableHead className="text-right">Rewards</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-mono">{run.id}</TableCell>
                <TableCell className="px-2 text-right tabular-nums text-readout-dim">
                  −{run.staminaUsed}
                </TableCell>
                <TableCell className="px-2 text-right tabular-nums text-readout-dim">
                  {run.staminaAfter}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setOpen(run.id)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="uppercase tracking-label text-readout-strong">
                Total
              </TableCell>
              <TableCell className="px-2 text-right tabular-nums text-readout-strong">
                −{totalStamina}
              </TableCell>
              <TableCell className="px-2 text-right tabular-nums text-readout-muted">
                {runs[runs.length - 1]?.staminaAfter ?? 0}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setOpen("total")}
                >
                  View all
                </Button>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        <PanelBody>
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="w-full"
          >
            Back to events
          </Button>
        </PanelBody>
      </Panel>

      {openRewards ? (
        <DetailOverlay
          title={open === "total" ? "All rewards" : "Run rewards"}
          subtitle={
            open === "total" ? `${runs.length} runs combined` : (open ?? "")
          }
          onClose={() => setOpen(null)}
        >
          <RewardList rows={rewardRows(openRewards)} />
        </DetailOverlay>
      ) : null}
    </Screen>
  );
}

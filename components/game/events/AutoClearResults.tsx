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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RewardList } from "@/components/game/events/RewardList";
import { useReturnFocus } from "@/hooks/useReturnFocus";
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
  // One dialog serves every row, so there is no single trigger for radix to
  // return focus to; the row that opened it is remembered instead.
  const returnFocus = useReturnFocus();
  const show = (key: string, opener: HTMLElement): void => {
    returnFocus.remember(opener);
    setOpen(key);
  };
  const openRun = runs.find((run) => run.id === open);
  const openRewards = open === "total" ? totals : openRun?.rewards;
  const totalStamina = runs.reduce((sum, run) => sum + run.staminaUsed, 0);

  return (
    <Screen variant="center" width="none" className="px-4 py-6">
      {/* Wider than `max-w-panel`: this one carries a four-column table, and
          the table sets its own `min-w` and scrolls inside itself. */}
      <Panel surface="paper" lift="slab" density="none" className="w-full max-w-lg">
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
                <TableCell className="px-2 text-right tabular-nums text-muted-foreground">
                  −{run.staminaUsed}
                </TableCell>
                <TableCell className="px-2 text-right tabular-nums text-muted-foreground">
                  {run.staminaAfter}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="xs" onClick={(event) => show(run.id, event.currentTarget)}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="uppercase tracking-label">
                Total
              </TableCell>
              <TableCell className="px-2 text-right tabular-nums">
                −{totalStamina}
              </TableCell>
              <TableCell className="px-2 text-right tabular-nums text-muted-foreground">
                {runs[runs.length - 1]?.staminaAfter ?? 0}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="secondary" size="xs" onClick={(event) => show("total", event.currentTarget)}>
                  View all
                </Button>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        <PanelBody>
          <Button onClick={onBack} className="w-full">
            Back to events
          </Button>
        </PanelBody>
      </Panel>

      <Dialog
        open={openRewards !== undefined}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
      >
        {openRewards ? (
          <DialogContent
            onCloseAutoFocus={returnFocus.onCloseAutoFocus}
          >
            <DialogHeader>
              <DialogTitle>
                {open === "total" ? "All rewards" : "Run rewards"}
              </DialogTitle>
              <DialogDescription className="text-caption font-bold uppercase tracking-eyebrow">
                {open === "total" ? `${runs.length} runs combined` : open}
              </DialogDescription>
            </DialogHeader>
            <RewardList rows={rewardRows(openRewards)} />
          </DialogContent>
        ) : null}
      </Dialog>
    </Screen>
  );
}

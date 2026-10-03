"use client";

import React from "react";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/Panel";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import TeamPicker from "@/components/game/TeamPicker";
import EnemyPanel from "@/components/game/events/EnemyPanel";
import type { CharacterData } from "@/lib/game/characterCatalog";
import {
  arcLabel,
  type EpicArc,
  type EpicStage,
} from "@/lib/game/epicBattles";
import { stageEnemyLine } from "@/components/game/events/EpicArcScreen";

/**
 * A stage's brief: the enemy, the player's own team, and the way in.
 *
 * It costs nothing and pays nothing, and says both out loud - a free,
 * rewardless fight that stayed silent about it would read as a missing cost
 * and a missing prize. Enemy stats come from `EnemyPanel`, so the figures are
 * what the fight is built at.
 */
export default function EpicStageBrief({
  arc,
  stage,
  roster,
  team,
  onPickTeam,
  onBack,
  onEnter,
}: {
  arc: EpicArc;
  stage: EpicStage;
  roster: string[];
  team: CharacterData[];
  onPickTeam: (team: CharacterData[]) => void;
  onBack: () => void;
  onEnter: () => void;
}): React.JSX.Element {
  const fights = stage.encounter.fights;
  // The first listed non-sub enemy is the one the panel features.
  const lead = fights[0]?.enemies.find((pick) => pick.isSub !== true);
  return (
    <Screen width="app">
      <Button variant="link" size="xs" onClick={onBack} className="gap-1 px-0">
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.6} />
        {arcLabel(arc)}
      </Button>
      <SectionHeader eyebrow={`Stage ${stage.order}`} title={stage.name}>
        <p className="mt-2 font-body text-caption text-ground-dim">
          {stage.caption}
        </p>
      </SectionHeader>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <EnemyPanel
            enemyId={lead?.id ?? null}
            fallbackName={stage.name}
            level={lead?.level ?? 1}
            badge={<Badge className="mt-2">{stageEnemyLine(stage)}</Badge>}
          />
        </div>

        <div className="flex flex-col gap-3">
          <TeamPicker ownedIds={roster} team={team} onChange={onPickTeam} />

          <Panel surface="paper" lift="slab" className="flex items-center gap-3">
            <span>
              <span className="block font-body text-label font-bold uppercase tracking-label text-muted-foreground">
                Cost
              </span>
              <span className="font-heading text-2xl">0</span>
              <span className="ml-1.5 font-body text-label text-muted-foreground">
                stamina · no rewards
              </span>
            </span>
            {/* The screen's one primary action, as on every event brief. */}
            <Button
              disabled={team.length === 0}
              onClick={onEnter}
              className="ml-auto"
            >
              Enter battle
            </Button>
          </Panel>
        </div>
      </div>
    </Screen>
  );
}

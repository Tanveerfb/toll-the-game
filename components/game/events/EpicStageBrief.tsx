"use client";

import React from "react";

import BackLink from "@/components/ui/BackLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/Panel";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import TeamPicker from "@/components/game/TeamPicker";
import EnemyPanel from "@/components/game/events/EnemyPanel";
import type { CharacterData } from "@/lib/game/characterCatalog";
import {
  type EpicArc,
  type EpicStage,
} from "@/lib/game/epicBattles";
import { stageLevelLine } from "@/components/game/events/EpicArcScreen";

/**
 * A stage's brief: the enemy, the player's own team, and the way in.
 *
 * It costs nothing and pays nothing, and says neither (less is more, ruling
 * #178): there is no cost bar here, only the way in. Enemy stats come from `EnemyPanel`, so the figures are
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
      <BackLink label={arc.title} onClick={onBack} />
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
            pageTitle={stage.name}
            badge={
              stageLevelLine(stage) ? (
                <Badge className="mt-2">{stageLevelLine(stage)}</Badge>
              ) : null
            }
          />
        </div>

        <div className="flex flex-col gap-3">
          <TeamPicker ownedIds={roster} team={team} onChange={onPickTeam} />

          <Panel surface="paper" lift="slab" className="flex items-center gap-3">
            {/* The screen's one primary action, as on every event brief. */}
            <Button
              disabled={team.length === 0}
              onClick={onEnter}
              className="ml-auto"
            >
              Fight
            </Button>
          </Panel>
        </div>
      </div>
    </Screen>
  );
}

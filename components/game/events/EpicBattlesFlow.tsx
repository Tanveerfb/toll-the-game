"use client";

import React from "react";

import { Screen } from "@/components/ui/Screen";
import BattleArena from "@/components/game/BattleArena";
import Deck from "@/components/game/Deck";
import { toTeamPicks } from "@/components/game/TeamPicker";
import EpicArcScreen from "@/components/game/events/EpicArcScreen";
import EpicStageBrief from "@/components/game/events/EpicStageBrief";
import { EpicClearSummary } from "@/components/game/events/ClearSummary";
import { useBattleContext } from "@/hooks/BattleProvider";
import { useGameStore } from "@/store/gameStore";
import { usePlayerStore } from "@/store/playerStore";
import type { CharacterData } from "@/lib/game/characterCatalog";
import {
  arcLabel,
  stageKey,
  type EpicArc,
  type EpicStage,
} from "@/lib/game/epicBattles";

/** Where the flow opens: an arc's stage list, or a fight already under way
 *  (a reload resuming the battle - see `resumedEventBattle`). */
export type EpicFlowStart =
  | { phase: "arc"; arc: EpicArc }
  | { phase: "battle"; arc: EpicArc; stage: EpicStage };

/** Which kind of screen the flow is on, for the page's music. */
export type EpicFlowPhase = "menu" | "battle" | "results";

type FlowView =
  | { kind: "arc"; arc: EpicArc }
  | { kind: "brief"; arc: EpicArc; stage: EpicStage }
  | { kind: "battle"; arc: EpicArc; stage: EpicStage }
  | {
      kind: "results";
      arc: EpicArc;
      stage: EpicStage;
      turns: number;
    };

/**
 * The Epic Battles screens in sequence: stage list -> brief -> fight ->
 * result, and back to the stage list.
 *
 * Split out of `app/events/page.tsx` (whose size is pinned by
 * `tests/layoutSystem.test.ts`) because none of the event machinery applies
 * here: a stage is always open, costs no stamina and pays no rewards
 * (Tanveer, 2026-10-03), so there is no lock reason, difficulty, auto clear or
 * reward roll to share with the page. The page owns only the entry and exit.
 */
export default function EpicBattlesFlow({
  start,
  onExit,
  onPhase,
}: {
  start: EpicFlowStart;
  /** Leave the collection, back to the events board. */
  onExit: () => void;
  onPhase: (phase: EpicFlowPhase) => void;
}): React.JSX.Element {
  const { startCustomBattle } = useBattleContext();
  const resetBattle = useGameStore((s) => s.resetBattle);
  const roster = usePlayerStore((s) => s.roster);
  const recordEpicClear = usePlayerStore((s) => s.recordEpicClear);
  const rememberLastTeam = usePlayerStore((s) => s.rememberLastTeam);

  const [view, setView] = React.useState<FlowView>(
    start.phase === "battle"
      ? { kind: "battle", arc: start.arc, stage: start.stage }
      : { kind: "arc", arc: start.arc },
  );
  const [team, setTeam] = React.useState<CharacterData[]>([]);

  React.useEffect(() => {
    onPhase(
      view.kind === "battle"
        ? "battle"
        : view.kind === "results"
          ? "results"
          : "menu",
    );
  }, [view.kind, onPhase]);

  /**
   * Start the stage's fight. Nothing is spent and only a picked team is
   * required. A stage is one fight (the schema enforces it), so there is no
   * run to carry between fights.
   */
  const enter = React.useCallback(
    (arc: EpicArc, stage: EpicStage) => {
      const fight = stage.encounter.fights[0];
      if (!fight || team.length === 0) return;
      rememberLastTeam(team.map((c) => c.id));
      startCustomBattle(toTeamPicks(team), fight.enemies, {
        stageEffects: fight.stageEffects,
        victoryAtEnemyHpPercent: fight.victoryAtEnemyHpPercent,
        owner: {
          route: "/events",
          view: { kind: "epic", arcId: arc.id, stageId: stage.id },
        },
      });
      setView({ kind: "battle", arc, stage });
    },
    [team, rememberLastTeam, startCustomBattle],
  );

  if (view.kind === "battle") {
    const { arc, stage } = view;
    return (
      <Screen variant="fixed" width="none">
        <BattleArena
          contextLabel={`${arcLabel(arc)} · ${stage.name}`}
          worldBoss={{
            continueLabel: "Continue",
            onContinue: () => {
              // Read from the battle store, not the picker's state: the
              // picker's team is gone after a reload, the battle's is not,
              // and the record must name the units that actually won.
              const battle = useGameStore.getState();
              const turns = battle.playerTurns;
              const key = stageKey(arc.id, stage.id);
              recordEpicClear(
                key,
                battle.playerTeam.map((unit) => unit.id),
                turns,
              );
              resetBattle();
              setView({ kind: "results", arc, stage, turns });
            },
            // No stamina to re-spend: a retry is the same fight again. After a
            // reload the picked team is gone, so fall back to the brief rather
            // than starting a fight with nobody in it.
            onRetry: () => {
              resetBattle();
              if (team.length > 0) enter(arc, stage);
              else setView({ kind: "brief", arc, stage });
            },
            onQuit: () => {
              resetBattle();
              setView({ kind: "arc", arc });
            },
          }}
        />
        <Deck />
      </Screen>
    );
  }

  if (view.kind === "results") {
    const { arc, stage } = view;
    return (
      <EpicClearSummary
        arcLabel={arcLabel(arc)}
        arcTitle={arc.title}
        stageName={stage.name}
        turns={view.turns}
        onAgain={() =>
          team.length > 0 ? enter(arc, stage) : setView({ kind: "brief", arc, stage })
        }
        onBack={() => setView({ kind: "arc", arc })}
      />
    );
  }

  if (view.kind === "brief") {
    const { arc, stage } = view;
    return (
      <EpicStageBrief
        arc={arc}
        stage={stage}
        roster={roster}
        team={team}
        onPickTeam={setTeam}
        onBack={() => setView({ kind: "arc", arc })}
        onEnter={() => enter(arc, stage)}
      />
    );
  }

  const { arc } = view;
  return (
    <EpicArcScreen
      arc={arc}
      onBack={onExit}
      onSelectStage={(stage) => setView({ kind: "brief", arc, stage })}
    />
  );
}

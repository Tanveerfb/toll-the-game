"use client";

import React from "react";

import { Alert } from "@/components/ui/alert";
import BackLink from "@/components/ui/BackLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/Panel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import AutoClearConfirm from "@/components/game/AutoClearConfirm";
import TeamPicker from "@/components/game/TeamPicker";
import { RewardChips } from "@/components/game/events/RewardList";
import EnemyPanel from "@/components/game/events/EnemyPanel";
import type { CharacterData } from "@/lib/game/characterCatalog";
import {
  eventFightCount,
  eventLockReason,
  eventPhaseCount,
  type GameEvent,
} from "@/lib/game/events";
import { autoClearAvailability, maxBatchSize } from "@/lib/game/autoClear";
import { enemyLevelForDifficulty } from "@/lib/game/worldLevel";
import { tierKey } from "@/lib/game/worldBossRewards";
import { farmablePreview, firstClearPreview } from "@/lib/game/worldBossPreview";

/** Every piece of player state the brief reads, passed in rather than pulled
 *  from the store — the page owns the store subscription (ruling #139: one
 *  screen, one source of truth for what it renders). */
export interface EventBriefState {
  roster: string[];
  team: CharacterData[];
  difficulty: number;
  difficulties: number[];
  currentStamina: number;
  accountRank: number;
  clearedWalls: number[];
  clearedEvents: string[];
  autoClearTickets: number;
  notice: string | null;
}

/** The enemy portrait, statline and what the run is. */
function EnemyCard({
  event,
  difficulty,
}: {
  event: GameEvent;
  difficulty: number;
}): React.JSX.Element {
  return (
    <EnemyPanel
      enemyId={event.enemyId ?? null}
      fallbackName={event.name}
      // What the enemy actually fights at on this difficulty. First phase only
      // - the phases line says there are more.
      level={event.kind === "boss" ? enemyLevelForDifficulty(difficulty) : 1}
      phases={eventPhaseCount(event)}
      pageTitle={event.name}
      badge={
        event.kind === "boss" ? null : (
          // A trial's enemies carry authored levels, so the world level dial
          // never reaches them. Say what the run IS.
          <Badge className="mt-2">
            {eventFightCount(event)} fights · one HP bar
          </Badge>
        )
      }
    />
  );
}

/**
 * The world level ladder.
 *
 * Boss-only. A trial's enemies are authored at fixed levels, so on a trial this
 * offered a dial that changed nothing and described rewards the fight does not
 * pay.
 */
function DifficultyLadder({
  event,
  difficulty,
  difficulties,
  clearedEvents,
  onPick,
}: {
  event: GameEvent;
  difficulty: number;
  difficulties: number[];
  clearedEvents: string[];
  onPick: (level: number) => void;
}): React.JSX.Element {
  return (
    <Panel surface="paper">
      <SectionHeader size="block" eyebrow="Difficulty" rule />
      {/* One difficulty out of four: the shadcn toggle group (ruling #154),
          the mockup's segmented row. */}
      <ToggleGroup
        type="single"
        variant="outline"
        value={String(difficulty)}
        onValueChange={(value) => {
          if (value) onPick(Number(value));
        }}
        className="grid w-full grid-cols-4 gap-1.5"
        aria-label="Difficulty"
      >
        {[1, 2, 3, 4].map((level) => {
          const allowed = difficulties.includes(level);
          return (
            <ToggleGroupItem
              key={level}
              value={String(level)}
              disabled={!allowed}
              className="flex-col gap-0 px-2 py-2"
            >
              <span className="block font-heading text-lg">{level}</span>
              <span className="block font-body text-label font-bold uppercase tracking-title">
                {/* No multiplier here any more: difficulty pays through its
                    own reward table, not a coefficient (ruling #80). The old
                    "×2.05" advertised a bonus the code never applied. */}
                {!allowed
                  ? "Locked"
                  : clearedEvents.includes(tierKey(event.id, level))
                    ? "Cleared"
                    : null}
              </span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </Panel>
  );
}

/**
 * What the fight pays.
 *
 * Two lists, because a fight pays two different things: a one-off bundle and
 * the farm. Showing them merged is what made the old preview read as *"you get
 * this every time"*.
 */
function RewardPreview({
  event,
  difficulty,
  clearedEvents,
}: {
  event: GameEvent;
  difficulty: number;
  clearedEvents: string[];
}): React.JSX.Element {
  const alreadyCleared = clearedEvents.includes(tierKey(event.id, difficulty));
  return (
    <Panel surface="paper">
      {!alreadyCleared ? (
        <>
          <SectionHeader
            size="block"
            eyebrow="First clear · once only"
            rule
            tone="highlight"
          />
          <RewardChips
            rows={firstClearPreview(difficulty)}
            tone="highlight"
            className="mb-3"
          />
        </>
      ) : null}

      <SectionHeader size="block" eyebrow="Every clear" rule />
      <RewardChips rows={farmablePreview(difficulty)} />
    </Panel>
  );
}

/**
 * An event's brief: who you are fighting, what it pays, and the two ways in.
 *
 * Extracted from `app/events/page.tsx` on 2026-09-17. The page keeps every
 * store subscription and every state transition; this renders what it is given
 * and calls back.
 */
export default function EventBrief({
  event,
  state,
  onBack,
  onPickDifficulty,
  onPickTeam,
  onEnter,
  onAutoClear,
}: {
  event: GameEvent;
  state: EventBriefState;
  onBack: () => void;
  onPickDifficulty: (level: number) => void;
  onPickTeam: (team: CharacterData[]) => void;
  onEnter: () => void;
  onAutoClear: (runs: number) => void;
}): React.JSX.Element {
  const {
    roster,
    team,
    difficulty,
    difficulties,
    currentStamina,
    accountRank,
    clearedWalls,
    clearedEvents,
    autoClearTickets,
    notice,
  } = state;

  /** Open when Auto Clear is awaiting a run count. `maxRuns` is frozen at the
   *  moment the button was pressed so the slider's ceiling can't move under
   *  the player's finger while the modal is open. */
  const [autoConfirm, setAutoConfirm] = React.useState<number | null>(null);

  /**
   * One source of truth for "can this be entered".
   *
   * This used to ask `!!event.enemyId`, which is **null on a trial** — a trial
   * names no single opponent because it is a multi-fight encounter
   * (`trialEncounters.ts`). So the First Ascension Trial's Enter button was
   * permanently disabled and the fight was unreachable, while
   * `eventLockReason` cheerfully reported it as unlocked. Two conditions
   * answering the same question, and only one of them was updated when trials
   * gained encounters (found by opening the page, 2026-09-17).
   *
   * `eventLockReason` already covers rank, an already-cleared one-off and a
   * missing encounter; this adds only what the *brief* knows — that a team is
   * picked and the stamina is there.
   */
  const canEnter =
    team.length > 0 &&
    currentStamina >= event.staminaCost &&
    eventLockReason(event, accountRank, clearedWalls) === null;

  const auto = autoClearAvailability({
    eligible: event.autoClearEligible === true,
    clearedEvents,
    eventId: event.id,
    // Per tier: beating world level 1 doesn't unlock farming world level 4.
    difficulty,
    tickets: autoClearTickets,
    stamina: currentStamina,
    staminaCost: event.staminaCost,
  });
  const autoRuns = Math.min(auto.affordable, maxBatchSize(event.staminaCost));

  return (
    <Screen width="app">
      <BackLink label="Events" onClick={onBack} />
      <SectionHeader eyebrow={event.kicker} title={event.name} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <EnemyCard event={event} difficulty={difficulty} />

          {event.kind === "boss" ? (
            <>
              <DifficultyLadder
                event={event}
                difficulty={difficulty}
                difficulties={difficulties}
                clearedEvents={clearedEvents}
                onPick={onPickDifficulty}
              />
              <RewardPreview
                event={event}
                difficulty={difficulty}
                clearedEvents={clearedEvents}
              />
            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <TeamPicker ownedIds={roster} team={team} onChange={onPickTeam} />

          {notice ? (
            <Alert variant="destructive">{notice}</Alert>
          ) : null}

          <Panel surface="paper" lift="slab" className="flex items-center gap-3">
            <span>
              <span className="block font-body text-label font-bold uppercase tracking-label text-muted-foreground">
                Cost
              </span>
              <span className="font-heading text-2xl">
                {event.staminaCost}
              </span>
              <span className="ml-1.5 font-body text-label text-muted-foreground">
                of {currentStamina} stamina
              </span>
            </span>
            {/* Auto Clear sits beside Enter, never replacing it. Hidden
                outright on an ineligible event — a permanently disabled
                control on the trials would only raise a question whose answer
                is "never". */}
            {auto.eligible ? (
              <Button
                variant="outline"
                disabled={autoRuns < 1}
                onClick={() => setAutoConfirm(autoRuns)}
                className="ml-auto"
              >
                {/* No ticket count here. It read "Auto clear ×15" and was
                    taken to mean fifteen skips already used (Tanveer,
                    2026-08-13) — a bare ×N beside a verb reads as a count of
                    the verb. The balance belongs in the confirm modal, shown
                    as a before → after shift next to the run count actually
                    being spent. The button's own job is to be pressable or
                    not: `autoRuns < 1` covers zero tickets, so a player with
                    none can never reach the modal. */}
                Auto clear
              </Button>
            ) : null}
            {/* The screen's one primary action, so the one slanted yellow
                button (the mockup's Enter, ruling #154). */}
            <Button
              disabled={!canEnter}
              onClick={onEnter}
              className={auto.eligible ? undefined : "ml-auto"}
            >
              Fight
            </Button>
          </Panel>

          {/**
           * Why Auto Clear is unpressable, in the page rather than in a
           * `title=`.
           *
           * It WAS a `title=` on the button, which is hover-only: no tap, no
           * focus, invisible on a phone — exactly the failure ruling #125
           * exists to stop. `tests/touchTargets.test.ts` is written to catch
           * it and skipped this one, because `disabled={autoRuns < 1}` on the
           * line above put a `<` between the tag and the attribute and the
           * guard's walk-back landed on it (both fixed 2026-09-17).
           *
           * Only shown when Auto Clear is eligible and blocked for a reason the
           * screen does not already show: the "locked" case (the tier is not
           * beaten yet) is carried by the disabled button alone, and the
           * "Cleared" chips on the ladder.
           */}
          {auto.eligible && auto.blocker && auto.blocker !== "locked" ? (
            <Alert>
              {auto.blocker === "no-tickets"
                ? "No Auto Clear tickets. They arrive with account ranks."
                : "Not enough stamina — Auto Clear still pays the full cost of every run it skips."}
            </Alert>
          ) : null}
        </div>
      </div>

      {autoConfirm !== null ? (
        <AutoClearConfirm
          eventName={event.name}
          difficulty={difficulty}
          maxRuns={autoConfirm}
          staminaCost={event.staminaCost}
          stamina={currentStamina}
          tickets={autoClearTickets}
          dropRows={farmablePreview(difficulty)}
          onCancel={() => setAutoConfirm(null)}
          onConfirm={(runs) => {
            setAutoConfirm(null);
            onAutoClear(runs);
          }}
        />
      ) : null}
    </Screen>
  );
}

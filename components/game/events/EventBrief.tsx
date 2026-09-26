"use client";

import React from "react";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/Panel";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import AutoClearConfirm from "@/components/game/AutoClearConfirm";
import TeamPicker from "@/components/game/TeamPicker";
import { RewardChips } from "@/components/game/events/RewardList";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  getCharacterById,
  type CharacterData,
} from "@/lib/game/characterCatalog";
import {
  eventFightCount,
  eventLockReason,
  eventPhaseCount,
  type GameEvent,
} from "@/lib/game/events";
import { autoClearAvailability, maxBatchSize } from "@/lib/game/autoClear";
import { enemyLevelForDifficulty } from "@/lib/game/worldLevel";
import { battleStats } from "@/lib/game/battleStats";
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
  rankCap: number;
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
  const enemy = event.enemyId ? getCharacterById(event.enemyId) : null;
  const art = event.enemyId ? getCharacterArt(event.enemyId) : null;
  const phases = eventPhaseCount(event);
  /**
   * What the enemy actually fights at on this difficulty, from the same
   * pipeline the battle builds him through. This printed the catalog
   * statline beside "Level 26 at difficulty 2", so the brief said the level
   * rose and showed stats that did not (Tanveer, 2026-09-26). First phase
   * only — the phases line says there are more.
   */
  const stats = enemy
    ? battleStats(enemy, {
        progression: {
          level: event.kind === "boss" ? enemyLevelForDifficulty(difficulty) : 1,
          ascension: 0,
        },
        side: "enemy",
      })
    : null;
  return (
    <Panel className="flex gap-3">
      <span className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border border-edge bg-inset">
        {art ? (
          <Image
            src={art}
            alt=""
            fill
            sizes="96px"
            className="object-cover object-top"
          />
        ) : (
          <span className="font-heading text-4xl text-readout-muted">☠</span>
        )}
      </span>
      <div className="min-w-0">
        <p className="font-heading text-xl tracking-title text-readout-strong">
          {enemy?.name ?? event.name}
        </p>
        {/**
         * Only a named enemy gets a tier line.
         *
         * This read `enemy?.tier === "elite" ? "Elite" : "Standard"`, and a
         * trial resolves no enemy at all — so the First Ascension Trial
         * announced itself as **Standard** while its last fight is Molvarr,
         * who is `tier: "elite"`. A falsy `enemy` was being reported as a
         * fact about the fight (browser check, 2026-09-17).
         */}
        {enemy ? (
          <p className="font-body text-[10px] font-bold uppercase tracking-label text-readout-muted">
            {enemy.tier === "elite" ? "Elite" : "Standard"}
            {phases > 1 ? ` · ${phases} phases` : ""}
          </p>
        ) : null}
        {stats ? (
          <div className="mt-2 flex gap-4">
            {(
              [
                ["HP", stats.hp],
                ["ATK", stats.atk],
                ["DEF", stats.def],
              ] as const
            ).map(([label, value]) => (
              <span key={label}>
                <span className="block font-body text-[9px] font-bold uppercase tracking-label text-readout-muted">
                  {label}
                </span>
                <span className="block font-heading text-base tabular-nums text-readout-strong">
                  {value.toLocaleString()}
                </span>
              </span>
            ))}
          </div>
        ) : null}
        {event.kind === "boss" ? (
          <p className="mt-2 font-body text-[10px] font-bold uppercase tracking-label text-signal">
            Level {enemyLevelForDifficulty(difficulty)} at difficulty{" "}
            {difficulty}
          </p>
        ) : (
          // A trial's enemies carry authored levels, so the world level dial
          // never reaches them. Say what the run IS.
          <p className="mt-2 font-body text-[10px] font-bold uppercase tracking-label text-signal">
            {eventFightCount(event)} fights · one HP bar
          </p>
        )}
      </div>
    </Panel>
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
  rankCap,
  accountRank,
  clearedEvents,
  onPick,
}: {
  event: GameEvent;
  difficulty: number;
  difficulties: number[];
  rankCap: number;
  accountRank: number;
  clearedEvents: string[];
  onPick: (level: number) => void;
}): React.JSX.Element {
  return (
    <Panel surface="quiet">
      <SectionHeader size="block" eyebrow="Difficulty" rule />
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((level) => {
          const allowed = difficulties.includes(level);
          const active = difficulty === level;
          return (
            <button
              key={level}
              type="button"
              disabled={!allowed}
              onClick={() => onPick(level)}
              className={`border px-2 py-2 text-center transition-colors ${
                active
                  ? "border-signal bg-signal/10"
                  : "border-edge bg-inset hover:border-edge-strong"
              } disabled:opacity-40`}
            >
              <span
                className={`block font-heading text-lg ${active ? "text-signal" : "text-readout-strong"}`}
              >
                {level}
              </span>
              <span className="block font-body text-[9px] font-bold uppercase tracking-title text-readout-muted">
                {/* No multiplier here any more: difficulty pays through its
                    own reward table, not a coefficient (ruling #80). The old
                    "×2.05" advertised a bonus the code never applied. */}
                {!allowed
                  ? "Locked"
                  : clearedEvents.includes(tierKey(event.id, level))
                    ? "Cleared"
                    : "New"}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 font-body text-[11px] leading-snug text-readout-muted">
        World level {rankCap} is your cap at account rank {accountRank}. Each
        difficulty is its own fight with its own one-off bundle and its own drop
        table — and each has to be beaten before it can be auto cleared.
      </p>
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
    <Panel surface="quiet">
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
      <p className="mt-2 font-body text-[11px] leading-snug text-readout-muted">
        {alreadyCleared
          ? "Ranges, not promises — the roll happens on victory. This difficulty's first-clear bundle is already paid."
          : "The bundle above is fixed and pays once, for this difficulty. Everything below rolls, every time."}
      </p>
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
    rankCap,
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
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* The primitive, not a hand-rolled link: it was a ~20px tap target
            in a bare `<button>`, and `size="xs"` carries the 44px floor
            (rulings #119–120). `variant="link"` keeps it reading as a
            breadcrumb rather than an action. */}
        <Button
          variant="link"
          size="xs"
          onClick={onBack}
          className="gap-1 px-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.6} />
          Events
        </Button>
        <span className="font-body text-[9px] font-bold uppercase tracking-eyebrow text-readout-muted">
          {event.kicker}
        </span>
        <h1 className="w-full font-heading text-3xl tracking-title text-readout-strong">
          {event.name}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <EnemyCard event={event} difficulty={difficulty} />

          {event.kind === "boss" ? (
            <>
              <DifficultyLadder
                event={event}
                difficulty={difficulty}
                difficulties={difficulties}
                rankCap={rankCap}
                accountRank={accountRank}
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
            <p className="border-l-2 border-el-red bg-el-red/5 px-3 py-2 font-body text-xs text-el-red">
              {notice}
            </p>
          ) : null}

          <Panel className="flex items-center gap-3">
            <span>
              <span className="block font-body text-[9px] font-bold uppercase tracking-label text-readout-muted">
                Cost
              </span>
              <span className="font-heading text-2xl text-readout-strong">
                {event.staminaCost}
              </span>
              <span className="ml-1.5 font-body text-[10px] text-readout-muted">
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
            <Button
              variant="secondary"
              disabled={!canEnter}
              onClick={onEnter}
              className={auto.eligible ? undefined : "ml-auto"}
            >
              Enter battle
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
           * Only shown when Auto Clear is eligible and blocked: an event that
           * never offers it says nothing, and an available one needs no
           * explanation.
           */}
          {auto.eligible && auto.blocker ? (
            <p className="border-l-2 border-edge-strong bg-inset px-3 py-2 font-body text-xs text-readout-dim">
              {auto.blocker === "locked"
                ? `Beat ${event.name} once yourself to unlock Auto Clear. A ticket skips the fight — it never skips the stamina.`
                : auto.blocker === "no-tickets"
                  ? "No Auto Clear Tickets. They arrive with account ranks."
                  : "Not enough stamina — Auto Clear still pays the full cost of every run it skips."}
            </p>
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

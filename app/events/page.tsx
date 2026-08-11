"use client";

import React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import BattleArena from "@/components/game/BattleArena";
import Deck from "@/components/game/Deck";
import TeamPicker, { toTeamPicks } from "@/components/game/TeamPicker";
import { useBattleContext } from "@/hooks/BattleProvider";
import { useScreenMusic } from "@/hooks/useScreenMusic";
import { useGameStore } from "@/store/gameStore";
import { usePlayerStore } from "@/store/playerStore";
import { getCurrentStamina, STAMINA_CAP } from "@/lib/game/stamina";
import {
  rollWorldBossRewards,
  type WorldBossRewards,
} from "@/lib/game/worldBossRewards";
import { getCharacterArt } from "@/lib/game/characterArt";
import {
  getCharacterById,
  type CharacterData,
} from "@/lib/game/characterCatalog";
import {
  eventLockReason,
  eventPhaseCount,
  GAME_EVENTS,
  type GameEvent,
} from "@/lib/game/events";
import {
  availableDifficulties,
  enemyLevelForDifficulty,
  rewardMultiplierForDifficulty,
  worldLevelCapForRank,
} from "@/lib/game/worldLevel";
import { materialLabel } from "@/lib/game/materials";

type View =
  | { kind: "board" }
  | { kind: "brief"; event: GameEvent }
  | { kind: "battle"; event: GameEvent }
  | { kind: "results"; event: GameEvent; rewards: WorldBossRewards };

/** What the brief promises. Ranges, not guarantees — the roll happens on
 *  victory (`rollWorldBossRewards`), and the brief exists to answer "what am I
 *  playing for", which nothing did before. */
const BOSS_REWARD_PREVIEW: Array<[string, string]> = [
  [materialLabel("sea_monster_eye"), "2–4"],
  [materialLabel("corroded_seaweed"), "1–3"],
  [materialLabel("training_manual"), "1–2"],
  ["Coin", "3,000–6,000"],
];

function EventCard({
  event,
  lockReason,
  onSelect,
}: {
  event: GameEvent;
  lockReason: string | null;
  onSelect: () => void;
}): React.JSX.Element {
  const art = event.enemyId ? getCharacterArt(event.enemyId) : null;
  const phases = eventPhaseCount(event);
  const locked = lockReason !== null;
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onSelect}
      className={`flex items-stretch gap-3 border bg-panel p-2.5 text-left transition-colors ${
        locked
          ? "border-hairline opacity-55"
          : "border-hairline hover:border-edge-strong"
      }`}
    >
      <span className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden border border-edge bg-inset">
        {art ? (
          <Image
            src={art}
            alt=""
            fill
            sizes="72px"
            className="object-cover object-top"
          />
        ) : (
          // Only reached by an event with no authored encounter — the two
          // ascension trials. Every fightable enemy resolves art, bosses
          // included (`getCharacterArt` maps NPC ids to `public/npc/`).
          <span className="font-heading text-2xl text-readout-muted">
            {locked ? <Lock className="h-6 w-6" strokeWidth={1.8} /> : "☠"}
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-signal">
          {event.kicker}
        </span>
        <span className="font-heading text-xl leading-tight tracking-[0.04em] text-readout-strong">
          {event.name}
        </span>
        <span className="font-body text-xs text-readout-dim">
          {event.summary}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {locked ? (
            <span className="border border-hairline px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-muted">
              {lockReason}
            </span>
          ) : (
            <>
              <span className="border border-hairline px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-muted">
                {event.staminaCost} stamina
              </span>
              <span className="border border-hairline px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-muted">
                {event.repeatable ? "Repeatable" : "One clear"}
              </span>
              {phases > 1 ? (
                <span className="border border-hairline px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-muted">
                  {phases} phases
                </span>
              ) : null}
            </>
          )}
        </span>
      </span>

      <span className="flex shrink-0 items-center text-readout-muted">
        {locked ? (
          <Lock className="h-4 w-4" strokeWidth={2} />
        ) : (
          <ChevronRight className="h-5 w-5" strokeWidth={2} />
        )}
      </span>
    </button>
  );
}

export default function EventsPage(): React.JSX.Element {
  const { startCustomBattle } = useBattleContext();
  const resetBattle = useGameStore((s) => s.resetBattle);
  const roster = usePlayerStore((s) => s.roster);
  const stamina = usePlayerStore((s) => s.stamina);
  const account = usePlayerStore((s) => s.account);
  const worldLevel = usePlayerStore((s) => s.worldLevel);
  const spendStaminaAction = usePlayerStore((s) => s.spendStaminaAction);
  const rememberLastTeam = usePlayerStore((s) => s.rememberLastTeam);
  const grantWorldBossRewards = usePlayerStore((s) => s.grantWorldBossRewards);

  const [view, setView] = React.useState<View>({ kind: "board" });
  const [team, setTeam] = React.useState<CharacterData[]>([]);
  const [difficulty, setDifficulty] = React.useState<number>(worldLevel);
  const [notice, setNotice] = React.useState<string | null>(null);

  useScreenMusic(
    view.kind === "battle"
      ? "battle"
      : view.kind === "results"
        ? "victory"
        : "menu",
  );

  const currentStamina = getCurrentStamina(stamina);
  const rankCap = worldLevelCapForRank(account.rank);
  const difficulties = availableDifficulties({ cap: rankCap });

  const enter = React.useCallback(
    (event: GameEvent) => {
      if (!event.enemyId) return;
      if (!spendStaminaAction(event.staminaCost)) {
        setNotice("Not enough stamina — wait for it to regenerate.");
        return;
      }
      setNotice(null);
      // Remembered on launch, not on selection — see the story brief.
      if (team.length > 0) rememberLastTeam(team.map((c) => c.id));
      startCustomBattle(toTeamPicks(team), [
        // Difficulty finally reaches the engine: `enemyLevelForDifficulty` and
        // `worldLevel` have existed since 2026-08-11 and drove nothing.
        { id: event.enemyId, level: enemyLevelForDifficulty(difficulty) },
      ]);
      setView({ kind: "battle", event });
    },
    [spendStaminaAction, startCustomBattle, team, rememberLastTeam, difficulty],
  );

  if (view.kind === "battle") {
    return (
      <main className="terminal-grid screen-below-nav relative flex flex-col overflow-hidden bg-void text-readout">
        <BattleArena
          contextLabel={view.event.name}
          worldBoss={{
            onContinue: () => {
              const rewards = rollWorldBossRewards();
              grantWorldBossRewards(rewards);
              resetBattle();
              setView({ kind: "results", event: view.event, rewards });
            },
            onRetry: () => enter(view.event),
            onQuit: () => {
              resetBattle();
              setView({ kind: "board" });
            },
          }}
        />
        <Deck />
      </main>
    );
  }

  if (view.kind === "results") {
    const rows: Array<[string, number]> = [
      [materialLabel("sea_monster_eye"), view.rewards.sea_monster_eye],
      [materialLabel("corroded_seaweed"), view.rewards.corroded_seaweed],
      [materialLabel("training_manual"), view.rewards.training_manual],
      ["Coin", view.rewards.coin],
    ];
    return (
      <main className="terminal-grid flex min-h-screen items-center justify-center bg-void px-4">
        <div className="w-full max-w-md border border-edge-strong bg-panel">
          <div className="border-b border-hairline bg-inset px-5 py-4">
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-signal">
              {view.event.name} cleared
            </p>
            <p className="font-heading text-2xl tracking-[0.08em] text-readout-strong">
              Rewards
            </p>
          </div>
          <div className="flex flex-col gap-1.5 px-5 py-4">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-3 border-b border-hairline pb-1.5 last:border-b-0"
              >
                <span className="font-body text-sm text-readout-dim">
                  {label}
                </span>
                <span className="font-heading text-lg tabular-nums text-readout-strong">
                  +{value.toLocaleString()}
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setView({ kind: "board" })}
              className="mt-3 border border-signal bg-signal/12 py-3 text-center font-body text-[11px] font-bold uppercase tracking-[0.18em] text-signal transition-colors hover:bg-signal/20"
            >
              Back to events
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (view.kind === "brief") {
    const event = view.event;
    const enemy = event.enemyId ? getCharacterById(event.enemyId) : null;
    const art = event.enemyId ? getCharacterArt(event.enemyId) : null;
    const phases = eventPhaseCount(event);
    const enemyLevel = enemyLevelForDifficulty(difficulty);
    const canEnter =
      team.length > 0 && currentStamina >= event.staminaCost && !!event.enemyId;

    return (
      <main className="terminal-grid min-h-screen bg-void">
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-6 md:px-8">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => setView({ kind: "board" })}
              className="flex items-center gap-1 font-body text-[10px] font-bold uppercase tracking-[0.16em] text-signal"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.6} />
              Events
            </button>
            <span className="font-body text-[9px] font-bold uppercase tracking-[0.2em] text-readout-muted">
              {event.kicker}
            </span>
            <h1 className="w-full font-heading text-3xl tracking-[0.06em] text-readout-strong">
              {event.name}
            </h1>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
            <div className="flex flex-col gap-3">
              <div className="flex gap-3 border border-edge-strong bg-panel p-3">
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
                    <span className="font-heading text-4xl text-readout-muted">
                      ☠
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-heading text-xl tracking-[0.05em] text-readout-strong">
                    {enemy?.name ?? event.name}
                  </p>
                  <p className="font-body text-[10px] font-bold uppercase tracking-[0.14em] text-readout-muted">
                    {enemy?.tier === "elite" ? "Elite" : "Standard"}
                    {phases > 1 ? ` · ${phases} phases` : ""}
                  </p>
                  {enemy ? (
                    <div className="mt-2 flex gap-4">
                      {(
                        [
                          ["HP", enemy.hp],
                          ["ATK", enemy.atk],
                          ["DEF", enemy.def],
                        ] as const
                      ).map(([label, value]) => (
                        <span key={label}>
                          <span className="block font-body text-[9px] font-bold uppercase tracking-[0.16em] text-readout-muted">
                            {label}
                          </span>
                          <span className="block font-heading text-base tabular-nums text-readout-strong">
                            {value.toLocaleString()}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 font-body text-[10px] font-bold uppercase tracking-[0.12em] text-signal">
                    Level {enemyLevel} at difficulty {difficulty}
                  </p>
                </div>
              </div>

              <div className="border border-hairline bg-panel p-3">
                <p className="mb-2 border-b border-hairline pb-1.5 font-body text-[9px] font-bold uppercase tracking-[0.22em] text-readout-muted">
                  Difficulty
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((level) => {
                    const allowed = difficulties.includes(level);
                    const active = difficulty === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        disabled={!allowed}
                        onClick={() => setDifficulty(level)}
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
                        <span className="block font-body text-[9px] font-bold uppercase tracking-[0.08em] text-readout-muted">
                          {allowed
                            ? `×${rewardMultiplierForDifficulty(level).toFixed(2)}`
                            : "Locked"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 font-body text-[11px] leading-snug text-readout-muted">
                  World level {rankCap} is your cap at account rank{" "}
                  {account.rank}. Dropping lower makes the fight easier and pays
                  proportionally less — the dial goes both ways.
                </p>
              </div>

              {event.kind === "boss" ? (
                <div className="border border-hairline bg-panel p-3">
                  <p className="mb-2 border-b border-hairline pb-1.5 font-body text-[9px] font-bold uppercase tracking-[0.22em] text-readout-muted">
                    On the table
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {BOSS_REWARD_PREVIEW.map(([label, range]) => (
                      <span
                        key={label}
                        className="min-w-[7rem] flex-1 border border-hairline bg-inset px-2.5 py-1.5"
                      >
                        <span className="block font-body text-[9px] font-bold uppercase tracking-[0.1em] text-readout-muted">
                          {label}
                        </span>
                        <span className="block font-heading text-base text-readout-strong">
                          {range}
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 font-body text-[11px] leading-snug text-readout-muted">
                    Ranges, not promises — the roll happens on victory.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <TeamPicker ownedIds={roster} team={team} onChange={setTeam} />

              {notice ? (
                <p className="border-l-2 border-el-red bg-el-red/5 px-3 py-2 font-body text-xs text-el-red">
                  {notice}
                </p>
              ) : null}

              <div className="flex items-center gap-3 border border-edge-strong bg-panel p-3">
                <span>
                  <span className="block font-body text-[9px] font-bold uppercase tracking-[0.18em] text-readout-muted">
                    Cost
                  </span>
                  <span className="font-heading text-2xl text-readout-strong">
                    {event.staminaCost}
                  </span>
                  <span className="ml-1.5 font-body text-[10px] text-readout-muted">
                    of {currentStamina} stamina
                  </span>
                </span>
                <button
                  type="button"
                  disabled={!canEnter}
                  onClick={() => enter(event)}
                  className="ml-auto border border-signal bg-signal/12 px-5 py-3 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-signal transition-colors hover:bg-signal/20 disabled:border-hairline disabled:bg-transparent disabled:text-readout-muted"
                >
                  Enter battle
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="terminal-grid min-h-screen bg-void">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-6 md:px-8">
        <header className="border-l-2 border-signal pl-3">
          <span className="block font-body text-[10px] font-bold uppercase tracking-[0.34em] text-signal">
            Operations board
          </span>
          <h1 className="font-heading text-3xl leading-none tracking-[0.1em] text-readout md:text-4xl">
            Events
          </h1>
          <p className="mt-1 font-body text-[11px] text-readout-muted">
            Stamina {currentStamina} / {STAMINA_CAP} · account rank{" "}
            {account.rank} · world level {worldLevel}
          </p>
        </header>

        <div className="flex flex-col gap-2">
          {GAME_EVENTS.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              lockReason={eventLockReason(
                event,
                account.rank,
                account.clearedWalls,
              )}
              onSelect={() => {
                setDifficulty(Math.min(worldLevel, rankCap));
                setNotice(null);
                setView({ kind: "brief", event });
              }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

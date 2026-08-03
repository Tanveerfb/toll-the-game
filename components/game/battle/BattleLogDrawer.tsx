"use client";

import React from "react";
import Image from "next/image";
import { AnimatePresence, m } from "framer-motion";
import { ChevronDown, Skull, Sparkles, Wind, Zap } from "lucide-react";
import { getCharacterArt } from "@/lib/game/characterArt";
import type { SequencedBattleEvent } from "@/store/gameStore";

/** One turn's worth of events, in the order they resolved. */
interface TurnGroup {
  turn: number;
  events: SequencedBattleEvent[];
}

/**
 * Groups the flat event stream by turn, newest turn first (the interesting
 * end of a battle log is always the end). Events inside a turn stay in
 * resolution order — reversing them would scramble cause and effect.
 */
export function groupEventsByTurn(
  events: SequencedBattleEvent[],
): TurnGroup[] {
  const byTurn = new Map<number, SequencedBattleEvent[]>();
  for (const event of events) {
    const bucket = byTurn.get(event.turn);
    if (bucket) bucket.push(event);
    else byTurn.set(event.turn, [event]);
  }
  return [...byTurn.entries()]
    .map(([turn, turnEvents]) => ({ turn, events: turnEvents }))
    .sort((a, b) => b.turn - a.turn);
}

function TargetRow({
  name,
  damage,
  heal,
  evaded,
  crit,
  killed,
  survivedLethal,
}: {
  name: string;
  damage?: number;
  heal?: number;
  evaded?: boolean;
  crit?: boolean;
  killed?: boolean;
  survivedLethal?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-1.5 pl-4 font-body text-xs">
      <span className="text-zinc-600">→</span>
      <span className="min-w-0 flex-1 truncate text-zinc-400">{name}</span>
      {evaded ? (
        <span className="flex shrink-0 items-center gap-0.5 font-semibold uppercase tracking-widest text-sky-300">
          <Wind className="h-3 w-3" strokeWidth={2.6} />
          Dodged
        </span>
      ) : null}
      {damage !== undefined && damage > 0 ? (
        <span className="shrink-0 font-semibold text-rose-300 tabular-nums">
          −{damage.toLocaleString()}
        </span>
      ) : null}
      {heal !== undefined && heal > 0 ? (
        <span className="shrink-0 font-semibold text-emerald-300 tabular-nums">
          +{heal.toLocaleString()}
        </span>
      ) : null}
      {crit ? (
        <span
          title="Critical"
          className="flex shrink-0 items-center gap-0.5 border border-amber-400/70 bg-amber-400/15 px-1 font-bold uppercase tracking-widest text-amber-200"
        >
          <Zap className="h-2.5 w-2.5" strokeWidth={3} />
          Crit
        </span>
      ) : null}
      {survivedLethal ? (
        <span className="shrink-0 border border-emerald-400/60 bg-emerald-400/10 px-1 font-bold uppercase tracking-widest text-emerald-200">
          Survived
        </span>
      ) : null}
      {killed ? (
        <span className="flex shrink-0 items-center gap-0.5 font-bold uppercase tracking-widest text-red-400">
          <Skull className="h-3 w-3" strokeWidth={2.6} />
          Down
        </span>
      ) : null}
    </div>
  );
}

function ActionEntry({
  event,
}: {
  event: Extract<SequencedBattleEvent, { kind: "action" }>;
}): React.JSX.Element {
  const art = getCharacterArt(event.sourceCharacterId);
  const isPlayer = event.sourceTeam === "player";
  return (
    <div className="space-y-0.5 py-1.5">
      <div className="flex items-center gap-1.5">
        <span
          className={`relative h-5 w-5 shrink-0 overflow-hidden border ${isPlayer ? "border-emerald-500/60" : "border-rose-500/60"}`}
        >
          {art ? (
            <Image
              src={art}
              alt=""
              fill
              sizes="20px"
              className="object-cover object-top"
            />
          ) : null}
        </span>
        <span
          className={`min-w-0 shrink-0 truncate font-heading text-xs tracking-[0.06em] ${isPlayer ? "text-emerald-200" : "text-rose-200"}`}
        >
          {event.sourceName}
        </span>
        <span className="min-w-0 flex-1 truncate font-body text-xs text-zinc-200">
          {event.skillName}
        </span>
        {event.isUlt ? (
          <span className="shrink-0 border border-amber-300/70 bg-amber-300/15 px-1 font-body text-[9px] font-bold uppercase tracking-widest text-amber-200">
            Ult
          </span>
        ) : event.rank ? (
          <span className="shrink-0 font-body text-[9px] font-bold uppercase tracking-widest text-zinc-500">
            R{event.rank}
          </span>
        ) : null}
      </div>

      {event.targets.map((target, i) => (
        <TargetRow key={`${target.instanceId}-${i}`} {...target} />
      ))}

      {event.counters.map((counter, i) => (
        <div
          key={`counter-${i}`}
          className="flex items-baseline gap-1.5 pl-4 font-body text-xs"
        >
          <span className="text-amber-400/70">↩</span>
          <span className="min-w-0 flex-1 truncate text-amber-200/80">
            {counter.byName} counters
          </span>
          <span className="shrink-0 font-semibold text-rose-300 tabular-nums">
            −{counter.damage.toLocaleString()}
          </span>
          {counter.killedAttacker ? (
            <span className="flex shrink-0 items-center gap-0.5 font-bold uppercase tracking-widest text-red-400">
              <Skull className="h-3 w-3" strokeWidth={2.6} />
              Down
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TickEntry({
  event,
}: {
  event: Extract<SequencedBattleEvent, { kind: "tick" }>;
}): React.JSX.Element {
  return (
    <div className="space-y-0.5 py-1.5">
      <div className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-zinc-700 bg-zinc-900/60">
          <Sparkles className="h-3 w-3 text-zinc-400" strokeWidth={2.4} />
        </span>
        <span className="font-body text-xs uppercase tracking-[0.12em] text-zinc-400">
          {event.label}
        </span>
      </div>
      {event.targets.map((target, i) => {
        const delta = target.hpAfter - target.hpBefore;
        return (
          <div
            key={`${target.instanceId}-${i}`}
            className="flex items-baseline gap-1.5 pl-4 font-body text-xs"
          >
            <span className="text-zinc-600">→</span>
            <span className="min-w-0 flex-1 truncate text-zinc-400">
              {target.name}
            </span>
            <span
              className={`shrink-0 font-semibold tabular-nums ${delta < 0 ? "text-rose-300" : "text-emerald-300"}`}
            >
              {delta < 0 ? "−" : "+"}
              {Math.abs(delta).toLocaleString()}
            </span>
            {target.hpAfter <= 0 ? (
              <span className="flex shrink-0 items-center gap-0.5 font-bold uppercase tracking-widest text-red-400">
                <Skull className="h-3 w-3" strokeWidth={2.6} />
                Down
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Slide-over battle log, rendered from the typed `battleEvents` stream.
 *
 * The log used to be `string[]` filtered with `entry.startsWith("[Action] ")`
 * and printed one flat `<p>` per line — while the exact same actions were
 * already available as structured events (per-target damage, crit, evade,
 * kill, hpBefore/hpAfter) driving the cinematics. This reads that stream
 * instead: grouped by turn, newest first, collapsible.
 *
 * The raw string log stays available behind a toggle. It still carries things
 * the event stream does not model yet — notably which buffs/debuffs an action
 * applied — so it remains the source of truth for a full playtest read.
 */
export default function BattleLogDrawer({
  open,
  events,
  rawLog,
  onClose,
}: {
  open: boolean;
  events: SequencedBattleEvent[];
  rawLog: string[];
  onClose: () => void;
}): React.JSX.Element {
  const [showRaw, setShowRaw] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Record<number, boolean>>({});

  const groups = groupEventsByTurn(events);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <m.div
            key="log-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50"
          />
          <m.aside
            key="log-drawer"
            initial={{ x: 380 }}
            animate={{ x: 0 }}
            exit={{ x: 380 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed right-0 top-0 z-50 flex h-dvh w-[360px] max-w-[92vw] flex-col border-l border-zinc-700 bg-zinc-950/95 backdrop-blur-md"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
              <p className="font-heading text-lg tracking-[0.12em] text-zinc-100">
                BATTLE LOG
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRaw((prev) => !prev)}
                  aria-pressed={showRaw}
                  className={`min-h-11 cursor-pointer border px-2 py-0.5 font-body text-[10px] uppercase tracking-widest transition-colors ${showRaw ? "border-amber-300 bg-amber-300/10 text-amber-200" : "border-zinc-700 text-zinc-400"}`}
                >
                  {showRaw ? "Raw" : "Grouped"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 cursor-pointer border border-zinc-700 px-2 py-0.5 font-body text-[10px] uppercase tracking-widest text-zinc-300 hover:border-zinc-500"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              {showRaw ? (
                <div className="space-y-1 font-body text-xs text-zinc-300">
                  {rawLog.length > 0 ? (
                    [...rawLog]
                      .reverse()
                      .map((entry, idx) => (
                        <p
                          key={`${entry}-${idx}`}
                          className="border-b border-zinc-900 pb-1 last:border-b-0"
                        >
                          {entry.replace(/^\[Action\]\s*/, "")}
                        </p>
                      ))
                  ) : (
                    <p className="py-6 text-center uppercase tracking-widest text-zinc-500">
                      No battle events yet.
                    </p>
                  )}
                </div>
              ) : groups.length === 0 ? (
                <p className="py-6 text-center font-body text-xs uppercase tracking-widest text-zinc-500">
                  No battle events yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {groups.map(({ turn, events: turnEvents }) => {
                    const isCollapsed = collapsed[turn] === true;
                    return (
                      <section key={turn} className="border border-zinc-800">
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsed((prev) => ({
                              ...prev,
                              [turn]: !isCollapsed,
                            }))
                          }
                          aria-expanded={!isCollapsed}
                          className="flex min-h-11 w-full items-center justify-between gap-2 bg-zinc-900/60 px-2.5 py-1.5 font-body text-[10px] uppercase tracking-[0.16em] text-zinc-400 transition-colors hover:text-zinc-100"
                        >
                          <span>Turn {turn + 1}</span>
                          <span className="flex items-center gap-1.5 text-zinc-600">
                            {turnEvents.length}
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                            />
                          </span>
                        </button>
                        {!isCollapsed ? (
                          <div className="divide-y divide-zinc-900 px-2.5">
                            {turnEvents.map((event) =>
                              event.kind === "action" ? (
                                <ActionEntry key={event.id} event={event} />
                              ) : (
                                <TickEntry key={event.id} event={event} />
                              ),
                            )}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </m.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

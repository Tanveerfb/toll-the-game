"use client";

import React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, m } from "framer-motion";
import { ChevronDown, Shield, Skull, Sparkles, Wind, Zap } from "lucide-react";
import { getCharacterArt } from "@/lib/game/characterArt";
import type { SequencedBattleEvent } from "@/store/gameStore";

// Never resubscribes — it exists only so the server snapshot and the client
// snapshot differ (same pattern as DetailOverlay/UnitDetailPanel, and the
// same reason an effect isn't used: setState-in-effect).
const NO_SUBSCRIBE = () => () => {};

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
  tanked,
  crit,
  killed,
  survivedLethal,
}: {
  name: string;
  damage?: number;
  heal?: number;
  evaded?: boolean;
  tanked?: boolean;
  crit?: boolean;
  killed?: boolean;
  survivedLethal?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-1.5 pl-4 font-body text-xs">
      <span className="text-readout-muted">→</span>
      <span className="min-w-0 flex-1 truncate text-readout-dim">{name}</span>
      {evaded ? (
        <span className="flex shrink-0 items-center gap-0.5 font-semibold uppercase tracking-widest text-signal">
          <Wind className="h-3 w-3" strokeWidth={2.6} />
          Dodged
        </span>
      ) : null}
      {tanked ? (
        // Without this the row rendered a bare name: the damage badge is
        // gated on `> 0`, so a fully-absorbed hit said nothing at all and the
        // player was left to guess whether it had even resolved (ruling #71).
        <span className="flex shrink-0 items-center gap-0.5 font-semibold uppercase tracking-widest text-readout-muted">
          <Shield className="h-3 w-3" strokeWidth={2.6} />
          Tanked
        </span>
      ) : null}
      {damage !== undefined && damage > 0 ? (
        <span className="shrink-0 font-semibold text-role-attack tabular-nums">
          −{damage.toLocaleString()}
        </span>
      ) : null}
      {heal !== undefined && heal > 0 ? (
        <span className="shrink-0 font-semibold text-role-heal tabular-nums">
          +{heal.toLocaleString()}
        </span>
      ) : null}
      {crit ? (
        <span
          title="Critical"
          className="flex shrink-0 items-center gap-0.5 border border-edge-strong bg-readout-strong/10 px-1 font-bold uppercase tracking-widest text-readout-strong"
        >
          <Zap className="h-2.5 w-2.5" strokeWidth={3} />
          Crit
        </span>
      ) : null}
      {survivedLethal ? (
        <span className="shrink-0 border border-role-heal/60 bg-role-heal/10 px-1 font-bold uppercase tracking-widest text-role-heal">
          Survived
        </span>
      ) : null}
      {killed ? (
        <span className="flex shrink-0 items-center gap-0.5 font-bold uppercase tracking-widest text-el-red">
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
          className={`relative h-5 w-5 shrink-0 overflow-hidden border ${isPlayer ? "border-role-heal/60" : "border-role-attack/60"}`}
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
          className={`min-w-0 shrink-0 truncate font-heading text-xs tracking-[0.06em] ${isPlayer ? "text-role-heal" : "text-role-attack"}`}
        >
          {event.sourceName}
        </span>
        <span className="min-w-0 flex-1 truncate font-body text-xs text-readout">
          {event.skillName}
        </span>
        {event.isUlt ? (
          <span className="shrink-0 border border-el-light/70 bg-el-light/15 px-1 font-body text-[9px] font-bold uppercase tracking-widest text-el-light">
            Ult
          </span>
        ) : event.rank ? (
          <span className="shrink-0 font-body text-[9px] font-bold uppercase tracking-widest text-readout-muted">
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
          <span className="text-readout-muted">↩</span>
          <span className="min-w-0 flex-1 truncate text-readout-dim">
            {counter.byName} counters
          </span>
          <span className="shrink-0 font-semibold text-role-attack tabular-nums">
            −{counter.damage.toLocaleString()}
          </span>
          {counter.killedAttacker ? (
            <span className="flex shrink-0 items-center gap-0.5 font-bold uppercase tracking-widest text-el-red">
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
        <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-edge bg-inset">
          <Sparkles className="h-3 w-3 text-readout-dim" strokeWidth={2.4} />
        </span>
        <span className="font-body text-xs uppercase tracking-[0.12em] text-readout-dim">
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
            <span className="text-readout-muted">→</span>
            <span className="min-w-0 flex-1 truncate text-readout-dim">
              {target.name}
            </span>
            <span
              className={`shrink-0 font-semibold tabular-nums ${delta < 0 ? "text-role-attack" : "text-role-heal"}`}
            >
              {delta < 0 ? "−" : "+"}
              {Math.abs(delta).toLocaleString()}
            </span>
            {target.hpAfter <= 0 ? (
              <span className="flex shrink-0 items-center gap-0.5 font-bold uppercase tracking-widest text-el-red">
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
  const mounted = React.useSyncExternalStore(
    NO_SUBSCRIBE,
    () => true,
    () => false,
  );

  const groups = groupEventsByTurn(events);

  if (!mounted) return <></>;

  // Portalled to the body rather than left in the arena. `battle-shake-strong`
  // puts a transform on the arena wrapper during heavy hits, and an active
  // transform is a containing block — which scoped this drawer to the arena
  // for the ~0.4s the shake ran. It was survivable while the arena was
  // near-viewport-sized; layout B's rail means it no longer is.
  return createPortal(
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
            className="fixed inset-0 z-40 bg-void/70"
          />
          <m.aside
            key="log-drawer"
            initial={{ x: 380 }}
            animate={{ x: 0 }}
            exit={{ x: 380 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed right-0 top-0 z-50 flex h-dvh w-[360px] max-w-[92vw] flex-col border-l border-edge bg-panel/95 backdrop-blur-md"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-4 py-3">
              <p className="font-heading text-lg tracking-[0.12em] text-readout-strong">
                BATTLE LOG
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRaw((prev) => !prev)}
                  aria-pressed={showRaw}
                  className={`min-h-11 cursor-pointer border px-2 py-0.5 font-body text-[10px] uppercase tracking-widest transition-colors ${showRaw ? "border-signal bg-signal/10 text-signal" : "border-edge text-readout-dim"}`}
                >
                  {showRaw ? "Raw" : "Grouped"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 cursor-pointer border border-edge px-2 py-0.5 font-body text-[10px] uppercase tracking-widest text-readout hover:border-edge-strong"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              {showRaw ? (
                <div className="space-y-1 font-body text-xs text-readout">
                  {rawLog.length > 0 ? (
                    [...rawLog]
                      .reverse()
                      .map((entry, idx) => (
                        <p
                          key={`${entry}-${idx}`}
                          className="border-b border-hairline pb-1 last:border-b-0"
                        >
                          {entry.replace(/^\[Action\]\s*/, "")}
                        </p>
                      ))
                  ) : (
                    <p className="py-6 text-center uppercase tracking-widest text-readout-muted">
                      No battle events yet.
                    </p>
                  )}
                </div>
              ) : groups.length === 0 ? (
                <p className="py-6 text-center font-body text-xs uppercase tracking-widest text-readout-muted">
                  No battle events yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {groups.map(({ turn, events: turnEvents }) => {
                    const isCollapsed = collapsed[turn] === true;
                    return (
                      <section key={turn} className="border border-hairline">
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsed((prev) => ({
                              ...prev,
                              [turn]: !isCollapsed,
                            }))
                          }
                          aria-expanded={!isCollapsed}
                          className="flex min-h-11 w-full items-center justify-between gap-2 bg-inset px-2.5 py-1.5 font-body text-[10px] uppercase tracking-[0.16em] text-readout-dim transition-colors hover:text-readout-strong"
                        >
                          <span>Turn {turn + 1}</span>
                          <span className="flex items-center gap-1.5 text-readout-muted">
                            {turnEvents.length}
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                            />
                          </span>
                        </button>
                        {!isCollapsed ? (
                          <div className="divide-y divide-hairline px-2.5">
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
    </AnimatePresence>,
    document.body,
  );
}

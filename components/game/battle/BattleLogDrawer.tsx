"use client";

import React from "react";
import Image from "next/image";
import { ChevronDown, Shield, Skull, Sparkles, Wind, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { INK_TONE } from "@/components/ui/inkTone";
import { getCharacterArt } from "@/lib/game/characterArt";
import type { SequencedBattleEvent } from "@/store/gameStore";
import type { BattleEventEffectChange } from "@/types/battleEvent";
import { describeEventEffect } from "@/lib/game/effectDiff";

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
      <span className="text-muted-foreground">→</span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {evaded ? (
        <span className="flex shrink-0 items-center gap-0.5 bg-muted px-1 font-semibold uppercase tracking-label">
          <Wind className="h-3 w-3" strokeWidth={2.6} />
          Dodged
        </span>
      ) : null}
      {tanked ? (
        // Without this the row rendered a bare name: the damage badge is
        // gated on `> 0`, so a fully-absorbed hit said nothing at all and the
        // player was left to guess whether it had even resolved (ruling #71).
        <span className="flex shrink-0 items-center gap-0.5 font-semibold uppercase tracking-label text-muted-foreground">
          <Shield className="h-3 w-3" strokeWidth={2.6} />
          Tanked
        </span>
      ) : null}
      {damage !== undefined && damage > 0 ? (
        <span className={`shrink-0 font-bold tabular-nums ${INK_TONE.loss}`}>
          −{damage.toLocaleString()}
        </span>
      ) : null}
      {heal !== undefined && heal > 0 ? (
        <span className={`shrink-0 font-bold tabular-nums ${INK_TONE.gain}`}>
          +{heal.toLocaleString()}
        </span>
      ) : null}
      {crit ? (
        <span
          className="flex shrink-0 items-center gap-0.5 bg-el-light px-1 font-bold uppercase tracking-label"
        >
          <Zap className="h-2.5 w-2.5" strokeWidth={3} />
          Crit
        </span>
      ) : null}
      {survivedLethal ? (
        <span className={`shrink-0 font-bold uppercase tracking-label ${INK_TONE.gain}`}>
          Survived
        </span>
      ) : null}
      {killed ? (
        <span className="flex shrink-0 items-center gap-0.5 bg-destructive px-1 font-bold uppercase tracking-label">
          <Skull className="h-3 w-3" strokeWidth={2.6} />
          Down
        </span>
      ) : null}
    </div>
  );
}

/**
 * The statuses one action moved on one character.
 *
 * Its own row rather than a field on `TargetRow`, because the character is
 * routinely not a target — a self buff, a team-wide grant, an Extort link
 * dying on a bystander. Keyed rendering by instance keeps those visible
 * instead of dropping them, which was the whole of Open Issue #22.
 */
function EffectRow({
  change,
}: {
  change: BattleEventEffectChange;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-1.5 pl-4 font-body text-xs">
      <span className="shrink-0 text-muted-foreground">✦</span>
      <span className="shrink-0 truncate">{change.name}</span>
      <span className="flex min-w-0 flex-1 flex-wrap justify-end gap-1">
        {change.applied.map((effect, i) => (
          <span
            key={`a-${i}`}
            className={`shrink-0 border px-1 font-semibold ${
              effect.slot === "debuff"
                ? "border-border bg-role-attack/35"
                : "border-border bg-role-heal/35"
            }`}
          >
            {describeEventEffect(effect)}
          </span>
        ))}
        {change.removed.map((effect, i) => (
          // Losing a debuff and losing a buff read very differently to a
          // player, so the chip keeps its slot colour and only the border
          // says it went away.
          <span
            key={`r-${i}`}
            className="shrink-0 border border-dashed border-muted-foreground px-1 text-muted-foreground line-through"
          >
            {describeEventEffect(effect)}
          </span>
        ))}
      </span>
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
          // Whose action, as the portrait's frame: a hue is a frame or a
          // fill on paper, never the name's colour.
          className={`relative h-5 w-5 shrink-0 overflow-hidden border-2 ${isPlayer ? "border-role-heal" : "border-role-attack"}`}
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
          className="min-w-0 shrink-0 truncate font-heading text-xs tracking-title"
        >
          {event.sourceName}
        </span>
        <span className="min-w-0 flex-1 truncate font-body text-xs">
          {event.skillName}
        </span>
        {event.isUlt ? (
          // The ultimate's five-hue frame (#133), as on its card.
          <span className="frame-ultimate shrink-0 border-2 px-1 font-body text-label font-bold uppercase tracking-label">
            Ult
          </span>
        ) : event.rank ? (
          <span className="shrink-0 font-body text-label font-bold uppercase tracking-label text-muted-foreground">
            R{event.rank}
          </span>
        ) : null}
      </div>

      {event.targets.map((target, i) => (
        <TargetRow key={`${target.instanceId}-${i}`} {...target} />
      ))}

      {(event.effects ?? []).map((change) => (
        <EffectRow key={`fx-${change.instanceId}`} change={change} />
      ))}

      {event.counters.map((counter, i) => (
        <div
          key={`counter-${i}`}
          className="flex items-baseline gap-1.5 pl-4 font-body text-xs"
        >
          <span className="text-muted-foreground">↩</span>
          <span className="min-w-0 flex-1 truncate">
            {counter.byName} counters
          </span>
          <span className={`shrink-0 font-bold tabular-nums ${INK_TONE.loss}`}>
            −{counter.damage.toLocaleString()}
          </span>
          {counter.killedAttacker ? (
            <span className="flex shrink-0 items-center gap-0.5 bg-destructive px-1 font-bold uppercase tracking-label">
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
        <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-border bg-muted">
          <Sparkles className="h-3 w-3" strokeWidth={2.4} />
        </span>
        <span className="font-body text-xs uppercase tracking-label text-muted-foreground">
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
            <span className="text-muted-foreground">→</span>
            <span className="min-w-0 flex-1 truncate">
              {target.name}
            </span>
            <span
              className={`shrink-0 font-bold tabular-nums ${delta < 0 ? INK_TONE.loss : INK_TONE.gain}`}
            >
              {delta < 0 ? "−" : "+"}
              {Math.abs(delta).toLocaleString()}
            </span>
            {target.hpAfter <= 0 ? (
              <span className="flex shrink-0 items-center gap-0.5 bg-destructive px-1 font-bold uppercase tracking-label">
                <Skull className="h-3 w-3" strokeWidth={2.6} />
                Down
              </span>
            ) : null}
          </div>
        );
      })}
      {(event.effects ?? []).map((change) => (
        <EffectRow key={`fx-${change.instanceId}`} change={change} />
      ))}
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
 * Status changes are on the stream too since 2026-09-01 (Open Issue #22),
 * captured as a before/after diff in `lib/game/effectDiff.ts` rather than
 * emitted per push site.
 *
 * The raw string log stays available behind a toggle: it still carries the
 * engine's own narration — resisted/immune lines, passive commentary, drains —
 * which is prose, not state, and has no structured shape to render.
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

  // The shadcn Sheet, from the right, on paper (#154). It was a hand-built
  // portal and slide; the Sheet portals itself, which is what kept it out of
  // the arena's `battle-shake-strong` transform, and adds the focus trap.
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="gap-0 overflow-hidden data-[side=right]:w-[360px] data-[side=right]:max-w-[92vw] data-[side=right]:sm:max-w-[360px]"
      >
            <SheetHeader className="shrink-0 flex-row items-center justify-between gap-2 border-b-2 border-border py-2">
              <SheetTitle>BATTLE LOG</SheetTitle>
              <SheetDescription className="sr-only">
                Every action and status change, newest turn first
              </SheetDescription>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setShowRaw((prev) => !prev)}
                aria-pressed={showRaw}
                className={showRaw ? "bg-primary hover:bg-primary/90" : ""}
              >
                {showRaw ? "Raw" : "Grouped"}
              </Button>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              {showRaw ? (
                <div className="space-y-1 font-body text-xs">
                  {rawLog.length > 0 ? (
                    [...rawLog]
                      .reverse()
                      .map((entry, idx) => (
                        <p
                          key={`${entry}-${idx}`}
                          className="border-b border-rule pb-1 last:border-b-0"
                        >
                          {entry.replace(/^\[Action\]\s*/, "")}
                        </p>
                      ))
                  ) : (
                    <p className="py-6 text-center uppercase tracking-label text-muted-foreground">
                      No battle events yet.
                    </p>
                  )}
                </div>
              ) : groups.length === 0 ? (
                <p className="py-6 text-center font-body text-xs uppercase tracking-label text-muted-foreground">
                  No battle events yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {groups.map(({ turn, events: turnEvents }) => {
                    const isCollapsed = collapsed[turn] === true;
                    return (
                      <section key={turn} className="border-2 border-border">
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsed((prev) => ({
                              ...prev,
                              [turn]: !isCollapsed,
                            }))
                          }
                          aria-expanded={!isCollapsed}
                          className="flex min-h-11 w-full items-center justify-between gap-2 bg-muted px-2.5 py-1.5 font-body text-label font-bold uppercase tracking-label transition-colors hover:bg-accent"
                        >
                          <span>Turn {turn + 1}</span>
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            {turnEvents.length}
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                            />
                          </span>
                        </button>
                        {!isCollapsed ? (
                          <div className="divide-y divide-rule px-2.5">
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
      </SheetContent>
    </Sheet>
  );
}

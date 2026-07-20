"use client";

import React from "react";
import { useGameStore, SequencedBattleEvent } from "@/store/gameStore";
import type { Color } from "@/types/color";

/**
 * Replays structured battle events as a timed cinematic: attacker lunge,
 * impact shake/flash, damage floaters, ult cut-ins. The engine state is
 * already final while this plays — HP bars render `hpOverrides` (exact
 * per-event snapshots from the engine) until playback ends, then fall back
 * to store truth. Skip cancels everything and snaps to the final state.
 */

export interface SequencerGhost {
  key: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  characterId: string;
  color: Color;
  isUlt: boolean;
}

export interface SequencerCutIn {
  key: number;
  characterId: string;
  name: string;
  skillName: string;
}

export interface SequencerFloater {
  key: number;
  x: number;
  y: number;
  text: string;
  kind: "damage" | "crit" | "heal" | "evade" | "counter" | "info";
}

export interface SequencerFlash {
  key: number;
  color: Color;
  strong: boolean;
}

// Expanding impact ring at the hit point (juice on damage).
export interface SequencerBurst {
  key: number;
  x: number;
  y: number;
  color: Color;
  /** Source character id — resolves a per-character VFX flavor (tint/shape)
   *  when one is registered (lib/game/characterVfx.ts); falls back to `color`. */
  characterId?: string;
  strong: boolean;
}

// Element-colored streak across all targets of an AoE hit.
export interface SequencerSweep {
  key: number;
  x: number;
  y: number;
  width: number;
  color: Color;
  characterId?: string;
}

export interface SequencerView {
  active: boolean;
  hpOverrides: Record<string, number>;
  shaking: Record<string, boolean>;
  evading: Record<string, boolean>;
  flashes: Record<string, SequencerFlash>;
  ghost: SequencerGhost | null;
  cutIn: SequencerCutIn | null;
  floaters: SequencerFloater[];
  bursts: SequencerBurst[];
  sweep: SequencerSweep | null;
}

const IDLE_VIEW: SequencerView = {
  active: false,
  hpOverrides: {},
  shaking: {},
  evading: {},
  flashes: {},
  ghost: null,
  cutIn: null,
  floaters: [],
  bursts: [],
  sweep: null,
};

// Base timings in ms — every sleep divides by the battle speed toggle.
// Slowed back down from the earlier "snappier" pass (2026-07-20): Tanveer
// found even 1x too fast to track attacker -> target -> result. The 2x
// toggle still exists for players who want the quicker feel.
const FLIGHT_MS = 340;
const IMPACT_HOLD_MS = 480;
const EVENT_GAP_MS = 120;
const SUPPORT_MS = 480;
const CUT_IN_MS = 950;
const COUNTER_MS = 380;
const FLOATER_LIFE_MS = 950;
const BURST_LIFE_MS = 520;
const SWEEP_LIFE_MS = 420;
// AoE: gap between each target's hit as the sweep steps left -> right.
const AOE_STAGGER_MS = 220;
// Beat between the leading sweep cue and the first target's impact.
const AOE_LEAD_MS = 160;
// Tick events (DoT/HoT/boss drain) are secondary to the main action beat —
// shorter hold so a chain of them doesn't drag, but still a real animation.
const TICK_HOLD_MS = 320;

export function useBattleSequencer(
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const battleEvents = useGameStore((s) => s.battleEvents);
  const [view, setView] = React.useState<SequencerView>(IDLE_VIEW);

  const queueRef = React.useRef<SequencedBattleEvent[]>([]);
  const processedRef = React.useRef(0);
  const runningRef = React.useRef(false);
  const generationRef = React.useRef(0);
  const keyRef = React.useRef(0);

  const nextKey = () => {
    keyRef.current += 1;
    return keyRef.current;
  };

  const anchorFor = React.useCallback(
    (instanceId: string): { x: number; y: number } | null => {
      const container = containerRef.current;
      if (!container) return null;
      const el = document.querySelector<HTMLElement>(
        `[data-battle-instance="${instanceId}"]`,
      );
      if (!el) return null;
      const cRect = container.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left - cRect.left + rect.width / 2,
        y: rect.top - cRect.top + rect.height / 2,
      };
    },
    [containerRef],
  );

  const sleep = React.useCallback((baseMs: number) => {
    const speed = useGameStore.getState().battleSpeed || 1;
    return new Promise<void>((resolve) =>
      window.setTimeout(resolve, baseMs / speed),
    );
  }, []);

  const addFloater = React.useCallback(
    (
      instanceId: string,
      text: string,
      kind: SequencerFloater["kind"],
      yShift = 0,
    ) => {
      const anchor = anchorFor(instanceId);
      if (!anchor) return;
      const floater: SequencerFloater = {
        key: nextKey(),
        x: anchor.x,
        y: anchor.y - 16 + yShift,
        text,
        kind,
      };
      setView((v) => ({ ...v, floaters: [...v.floaters, floater] }));
      window.setTimeout(() => {
        setView((v) => ({
          ...v,
          floaters: v.floaters.filter((f) => f.key !== floater.key),
        }));
      }, FLOATER_LIFE_MS / (useGameStore.getState().battleSpeed || 1));
    },
    [anchorFor],
  );

  const addBurst = React.useCallback(
    (instanceId: string, color: Color, strong: boolean, characterId?: string) => {
      const anchor = anchorFor(instanceId);
      if (!anchor) return;
      const burst: SequencerBurst = {
        key: nextKey(),
        x: anchor.x,
        y: anchor.y,
        color,
        characterId,
        strong,
      };
      setView((v) => ({ ...v, bursts: [...v.bursts, burst] }));
      window.setTimeout(() => {
        setView((v) => ({
          ...v,
          bursts: v.bursts.filter((b) => b.key !== burst.key),
        }));
      }, BURST_LIFE_MS / (useGameStore.getState().battleSpeed || 1));
    },
    [anchorFor],
  );

  const addSweep = React.useCallback(
    (instanceIds: string[], color: Color, characterId?: string) => {
      const anchors = instanceIds
        .map((id) => anchorFor(id))
        .filter((a): a is { x: number; y: number } => a !== null);
      if (anchors.length < 2) return;
      const xs = anchors.map((a) => a.x);
      const ys = anchors.map((a) => a.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const sweep: SequencerSweep = {
        key: nextKey(),
        x: minX - 45,
        y: ys.reduce((s, v) => s + v, 0) / ys.length,
        width: maxX - minX + 90,
        color,
        characterId,
      };
      setView((v) => ({ ...v, sweep }));
      window.setTimeout(() => {
        setView((v) => (v.sweep?.key === sweep.key ? { ...v, sweep: null } : v));
      }, SWEEP_LIFE_MS / (useGameStore.getState().battleSpeed || 1));
    },
    [anchorFor],
  );

  const flashUnit = React.useCallback(
    (instanceId: string, color: Color, strong: boolean, shake: boolean) => {
      const flash: SequencerFlash = { key: nextKey(), color, strong };
      setView((v) => ({
        ...v,
        flashes: { ...v.flashes, [instanceId]: flash },
        shaking: shake ? { ...v.shaking, [instanceId]: true } : v.shaking,
      }));
      window.setTimeout(() => {
        setView((v) => {
          const flashes = { ...v.flashes };
          if (flashes[instanceId]?.key === flash.key) delete flashes[instanceId];
          const shaking = { ...v.shaking };
          delete shaking[instanceId];
          return { ...v, flashes, shaking };
        });
      }, 380 / (useGameStore.getState().battleSpeed || 1));
    },
    [],
  );

  const playEvent = React.useCallback(
    async (ev: SequencedBattleEvent, gen: number) => {
      const alive = () => gen === generationRef.current;

      // System tick (DoT/Corrosion/HoT/boss drain/stat-spike self-heal): no
      // attacker, no lunge — just a per-target flash+floater so the bar
      // never snaps to the post-tick value ahead of any animation.
      if (ev.kind === "tick") {
        for (const t of ev.targets) {
          const delta = t.hpAfter - t.hpBefore;
          setView((v) => ({
            ...v,
            hpOverrides: { ...v.hpOverrides, [t.instanceId]: t.hpAfter },
          }));
          const isHeal = delta > 0;
          flashUnit(t.instanceId, isHeal ? "green" : "red", false, !isHeal);
          if (delta !== 0) {
            addFloater(
              t.instanceId,
              `${isHeal ? "+" : ""}${delta}`,
              isHeal ? "heal" : "damage",
            );
          }
        }
        await sleep(TICK_HOLD_MS);
        if (!alive()) return;
        await sleep(EVENT_GAP_MS);
        return;
      }

      const isOffense =
        ev.targets.some((t) => t.damage !== undefined || t.evaded) ||
        ev.skillType === "attack" ||
        ev.skillType === "ultimate" ||
        ev.skillType === "debuff" ||
        ev.skillType === "disable";

      // Ult cut-in: character art banner before the hit lands
      if (ev.isUlt) {
        setView((v) => ({
          ...v,
          cutIn: {
            key: nextKey(),
            characterId: ev.sourceCharacterId,
            name: ev.sourceName,
            skillName: ev.skillName,
          },
        }));
        await sleep(CUT_IN_MS);
        if (!alive()) return;
        setView((v) => ({ ...v, cutIn: null }));
      }

      if (isOffense && ev.targets.length > 0) {
        // Lunge: ghost portrait flies from attacker to the first target
        const from = anchorFor(ev.sourceInstanceId);
        const to = anchorFor(ev.targets[0].instanceId);
        if (from && to) {
          setView((v) => ({
            ...v,
            ghost: {
              key: nextKey(),
              fromX: from.x,
              fromY: from.y,
              toX: to.x,
              toY: to.y,
              characterId: ev.sourceCharacterId,
              color: ev.sourceColor,
              isUlt: ev.isUlt,
            },
          }));
          await sleep(FLIGHT_MS);
          if (!alive()) return;
          setView((v) => ({ ...v, ghost: null }));
        }

        // AoE reads as a sequence, not a single simultaneous hit: order
        // targets left -> right by their live on-field position and step
        // through them one at a time, so the player can track each result.
        const orderedTargets = [...ev.targets].sort((a, b) => {
          const ax = anchorFor(a.instanceId)?.x ?? Number.POSITIVE_INFINITY;
          const bx = anchorFor(b.instanceId)?.x ?? Number.POSITIVE_INFINITY;
          return ax - bx;
        });
        const isAoe = orderedTargets.length > 1;

        if (isAoe) {
          addSweep(
            orderedTargets.filter((t) => !t.evaded).map((t) => t.instanceId),
            ev.sourceColor,
            ev.sourceCharacterId,
          );
          await sleep(AOE_LEAD_MS);
          if (!alive()) return;
        }

        for (let i = 0; i < orderedTargets.length; i++) {
          const t = orderedTargets[i];
          if (t.evaded) {
            setView((v) => ({ ...v, evading: { ...v.evading, [t.instanceId]: true } }));
            addFloater(t.instanceId, "EVADE", "evade");
            window.setTimeout(() => {
              setView((v) => {
                const evading = { ...v.evading };
                delete evading[t.instanceId];
                return { ...v, evading };
              });
            }, 420 / (useGameStore.getState().battleSpeed || 1));
          } else if (t.damage !== undefined) {
            const strong = Boolean(t.crit || t.killed || ev.isUlt);
            if (t.hpAfter !== undefined) {
              setView((v) => ({
                ...v,
                hpOverrides: { ...v.hpOverrides, [t.instanceId]: t.hpAfter! },
              }));
            }
            flashUnit(t.instanceId, ev.sourceColor, strong, true);
            addBurst(t.instanceId, ev.sourceColor, strong, ev.sourceCharacterId);
            addFloater(
              t.instanceId,
              `${t.crit ? "CRIT " : ""}-${t.damage}`,
              t.crit ? "crit" : "damage",
            );
            if (t.survivedLethal) {
              addFloater(t.instanceId, "SURVIVED!", "info", 26);
            }
          }
          // Stagger between AoE targets so each hit reads individually; a
          // single-target hit just falls straight into the full hold below.
          if (isAoe && i < orderedTargets.length - 1) {
            await sleep(AOE_STAGGER_MS);
            if (!alive()) return;
          }
        }
        await sleep(IMPACT_HOLD_MS);
        if (!alive()) return;

        // Counters strike back after the main impacts
        for (const counter of ev.counters) {
          setView((v) => ({
            ...v,
            hpOverrides: {
              ...v.hpOverrides,
              [counter.onInstanceId]: counter.attackerHpAfter,
            },
          }));
          flashUnit(counter.onInstanceId, ev.sourceColor, counter.killedAttacker, true);
          addFloater(counter.onInstanceId, `-${counter.damage} COUNTER`, "counter");
          await sleep(COUNTER_MS);
          if (!alive()) return;
        }
      } else {
        // Support skills: green/gold pulse on each target, no lunge
        ev.targets.forEach((t) => {
          if (t.hpAfter !== undefined) {
            setView((v) => ({
              ...v,
              hpOverrides: { ...v.hpOverrides, [t.instanceId]: t.hpAfter! },
            }));
          }
          flashUnit(t.instanceId, "green", false, false);
          if (t.heal !== undefined && t.heal > 0) {
            addFloater(t.instanceId, `+${t.heal}`, "heal");
          }
        });
        await sleep(SUPPORT_MS);
        if (!alive()) return;
      }

      await sleep(EVENT_GAP_MS);
    },
    [addBurst, addFloater, addSweep, anchorFor, flashUnit, sleep],
  );

  const runQueue = React.useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    const gen = generationRef.current;
    setView((v) => ({ ...v, active: true }));

    while (queueRef.current.length > 0) {
      if (gen !== generationRef.current) return;
      const ev = queueRef.current.shift()!;
      await playEvent(ev, gen);
    }

    if (gen !== generationRef.current) return;
    runningRef.current = false;
    setView(IDLE_VIEW);
  }, [playEvent]);

  // useLayoutEffect (not useEffect): the engine has already written the FINAL
  // team state to the store, so a plain effect would let the browser paint the
  // final frame (dead units, empty bars) before we seed the pre-action HP.
  // Running before paint means the seeded overrides land in the same commit —
  // no flash of the outcome ahead of the animation.
  React.useLayoutEffect(() => {
    // Battle reset rewinds the event stream — drop everything
    if (battleEvents.length < processedRef.current) {
      processedRef.current = battleEvents.length;
      queueRef.current = [];
      generationRef.current += 1;
      runningRef.current = false;
      setView(IDLE_VIEW);
      return;
    }
    if (battleEvents.length === processedRef.current) return;

    const fresh = battleEvents.slice(processedRef.current);
    processedRef.current = battleEvents.length;

    // Seed pre-batch HP from the engine's exact snapshots so bars start
    // where the units were BEFORE these actions (store already holds the
    // final values)
    if (!runningRef.current) {
      const seeded: Record<string, number> = {};
      fresh.forEach((ev) => {
        ev.targets.forEach((t) => {
          if (t.hpBefore !== undefined && seeded[t.instanceId] === undefined) {
            seeded[t.instanceId] = t.hpBefore;
          }
        });
      });
      setView((v) => ({ ...v, hpOverrides: { ...seeded, ...v.hpOverrides } }));
    }

    queueRef.current.push(...fresh);
    void runQueue();
  }, [battleEvents, runQueue]);

  // Unmount: invalidate the running generation so stale timers no-op
  React.useEffect(
    () => () => {
      generationRef.current += 1;
    },
    [],
  );

  const skip = React.useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    runningRef.current = false;
    setView(IDLE_VIEW);
  }, []);

  return { view, skip };
}

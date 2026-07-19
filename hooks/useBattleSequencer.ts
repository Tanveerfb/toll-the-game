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
  strong: boolean;
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
};

// Base timings in ms — every sleep divides by the battle speed toggle.
// Tightened for snappier pacing (2026-07-20 anim pass).
const FLIGHT_MS = 210;
const IMPACT_HOLD_MS = 260;
const EVENT_GAP_MS = 55;
const SUPPORT_MS = 400;
const CUT_IN_MS = 900;
const COUNTER_MS = 300;
const FLOATER_LIFE_MS = 850;
const BURST_LIFE_MS = 480;

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
    (instanceId: string, color: Color, strong: boolean) => {
      const anchor = anchorFor(instanceId);
      if (!anchor) return;
      const burst: SequencerBurst = {
        key: nextKey(),
        x: anchor.x,
        y: anchor.y,
        color,
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

        // Impact: all targets at once (AoE hits together)
        setView((v) => {
          const hpOverrides = { ...v.hpOverrides };
          const evading = { ...v.evading };
          ev.targets.forEach((t) => {
            if (t.evaded) {
              evading[t.instanceId] = true;
            } else if (t.hpAfter !== undefined) {
              hpOverrides[t.instanceId] = t.hpAfter;
            }
          });
          return { ...v, hpOverrides, evading };
        });
        ev.targets.forEach((t) => {
          if (t.evaded) {
            addFloater(t.instanceId, "EVADE", "evade");
            window.setTimeout(() => {
              setView((v) => {
                const evading = { ...v.evading };
                delete evading[t.instanceId];
                return { ...v, evading };
              });
            }, 420 / (useGameStore.getState().battleSpeed || 1));
            return;
          }
          if (t.damage !== undefined) {
            const strong = Boolean(t.crit || t.killed || ev.isUlt);
            flashUnit(t.instanceId, ev.sourceColor, strong, true);
            addBurst(t.instanceId, ev.sourceColor, strong);
            addFloater(
              t.instanceId,
              `${t.crit ? "CRIT " : ""}-${t.damage}`,
              t.crit ? "crit" : "damage",
            );
            if (t.survivedLethal) {
              addFloater(t.instanceId, "SURVIVED!", "info", 26);
            }
          }
        });
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
    [addBurst, addFloater, anchorFor, flashUnit, sleep],
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

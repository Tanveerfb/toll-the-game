"use client";

import React from "react";
import { useGameStore, SequencedBattleEvent } from "@/store/gameStore";
import type { Color } from "@/types/color";
import { getRevealTier } from "@/lib/game/revealTier";

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

// Element-colored streak across all targets of an AoE hit. R3/ultimate also
// use this for a caster -> target "beam" even on single-target hits
// (source instance included in the anchor list) — `strong` renders it as
// the thicker/brighter beam rather than the thin AoE streak.
export interface SequencerSweep {
  key: number;
  x: number;
  y: number;
  width: number;
  color: Color;
  characterId?: string;
  strong?: boolean;
}

// Whole-arena flash, reserved for R2 (brightness pulse), R3 (brief flash)
// and ultimate (full white flash) — distinct from the per-tile SequencerFlash.
export interface SequencerScreenFlash {
  key: number;
  kind: "pulse" | "brief" | "white";
  color: Color;
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
  /** Whole-arena shake, reserved for R3/ultimate (target tiles already shake
   *  on their own for every hit at R2+). */
  screenShake: "light" | "heavy" | null;
  screenFlash: SequencerScreenFlash | null;
  /** Ultimate-only cutscene dim: surrounding UI recedes while the reveal plays. */
  dim: boolean;
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
  screenShake: null,
  screenFlash: null,
  dim: false,
};

// Reveal tiers add a couple of heavier beats (screen shake, wind-up hold) on
// top of the existing per-hit animation — skip those specifically under
// prefers-reduced-motion, matching the CSS-level opt-out already in place for
// the per-tile .battle-shake/.battle-shake-strong classes.
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

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
// Reveal-tier escalation (R3 wind-up, screen flash/shake, ultimate cutscene).
const WIND_UP_MS = 260;
const SCREEN_FLASH_LIFE_MS = 360;
const SCREEN_SHAKE_LIFE_MS = 420;
// Ultimate cutscene: dim in before the cut-in banner, hold through the beam
// + shake + flash, restore right after — matches the existing CUT_IN_MS beat.
const ULT_RESTORE_MS = 260;

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
    (
      instanceIds: string[],
      color: Color,
      characterId?: string,
      strong?: boolean,
    ) => {
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
        strong,
      };
      setView((v) => ({ ...v, sweep }));
      window.setTimeout(() => {
        setView((v) => (v.sweep?.key === sweep.key ? { ...v, sweep: null } : v));
      }, SWEEP_LIFE_MS / (useGameStore.getState().battleSpeed || 1));
    },
    [anchorFor],
  );

  const triggerScreenShake = React.useCallback((strength: "light" | "heavy") => {
    if (prefersReducedMotion()) return;
    setView((v) => ({ ...v, screenShake: strength }));
    window.setTimeout(() => {
      setView((v) => ({ ...v, screenShake: null }));
    }, SCREEN_SHAKE_LIFE_MS / (useGameStore.getState().battleSpeed || 1));
  }, []);

  const triggerScreenFlash = React.useCallback(
    (kind: "pulse" | "brief" | "white", color: Color) => {
      // The brightness pulse (R2) is soft enough to keep even under reduced
      // motion; the heavier brief/white flashes (R3/ultimate) are skipped.
      if (kind !== "pulse" && prefersReducedMotion()) return;
      const flash: SequencerScreenFlash = { key: nextKey(), kind, color };
      setView((v) => ({ ...v, screenFlash: flash }));
      window.setTimeout(() => {
        setView((v) =>
          v.screenFlash?.key === flash.key ? { ...v, screenFlash: null } : v,
        );
      }, SCREEN_FLASH_LIFE_MS / (useGameStore.getState().battleSpeed || 1));
    },
    [],
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

      // Reveal escalation tier (spec §2) — a pure mapping from the played
      // card's rank/ultimate flag to how much fanfare this hit gets. Element
      // color tints every effect below via ev.sourceColor as before.
      const tier = getRevealTier({
        rank: (ev.rank ?? 1) as 1 | 2 | 3,
        isUltimate: ev.isUlt,
        color: ev.sourceColor,
      });

      // Ultimate cutscene: screen dims first, held through the slam-in banner
      // and the whole reveal, restored once the impact/shake/flash settle.
      if (tier.cutscene) {
        setView((v) => ({ ...v, dim: true }));
      }

      // Big-hit focus (spec §1): R3/ultimate reveals give the center stage
      // transient visual focus while surrounding UI outside this hook's own
      // tree (the hand, team bar) recedes/dims — published on the shared
      // store since Deck isn't a child of BattleArena.
      if (tier.windUp) {
        useGameStore.getState().setBigHitFocus(true);
      }

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
        // Caster wind-up (R3/ultimate): a brief caster-side glow-hold before
        // the attack flies out. Skipped under prefers-reduced-motion.
        if (tier.windUp && !prefersReducedMotion()) {
          flashUnit(ev.sourceInstanceId, ev.sourceColor, false, false);
          await sleep(WIND_UP_MS);
          if (!alive()) return;
        }

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

        // R3/ultimate get a caster -> target beam even on a single target
        // (not just the AoE streak) — spec's "beam sweep"/"mega beam".
        if (isAoe || tier.beamSweep) {
          const hitTargetIds = orderedTargets
            .filter((t) => !t.evaded)
            .map((t) => t.instanceId);
          const beamIds =
            tier.beamSweep && !isAoe
              ? [ev.sourceInstanceId, ...hitTargetIds]
              : hitTargetIds;
          addSweep(beamIds, ev.sourceColor, ev.sourceCharacterId, tier.beamSweep);
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
            const strong = Boolean(
              t.crit || t.killed || ev.isUlt || tier.burstStrong,
            );
            // Target-tile shake starts at R2 (spec: R1/basic stay silent) —
            // a crit/kill still earns a shake regardless of tier.
            const shakeTile = tier.shake !== "none" || Boolean(t.crit || t.killed);
            if (t.hpAfter !== undefined) {
              setView((v) => ({
                ...v,
                hpOverrides: { ...v.hpOverrides, [t.instanceId]: t.hpAfter! },
              }));
            }
            flashUnit(t.instanceId, ev.sourceColor, strong, shakeTile);
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

        // Stage-wide escalation: R2 gets a soft brightness pulse, R3 a brief
        // flash + screen shake, ultimate the full heavy shake + white flash.
        if (tier.flash !== "none") {
          triggerScreenFlash(tier.flash, ev.sourceColor);
        }
        if (tier.shake === "heavy") {
          triggerScreenShake("heavy");
          await sleep(SCREEN_SHAKE_LIFE_MS);
          if (!alive()) return;
        }

        // Counters strike back after the main impacts — automatic secondary
        // hits, forced to the "basic" reveal tier (cheap, no fanfare, fires
        // constantly) regardless of the triggering action's own tier.
        const counterTier = getRevealTier({
          rank: 1,
          isUltimate: false,
          isBasic: true,
          color: ev.sourceColor,
        });
        for (const counter of ev.counters) {
          setView((v) => ({
            ...v,
            hpOverrides: {
              ...v.hpOverrides,
              [counter.onInstanceId]: counter.attackerHpAfter,
            },
          }));
          const counterShake =
            counterTier.shake !== "none" || counter.killedAttacker;
          flashUnit(
            counter.onInstanceId,
            ev.sourceColor,
            counter.killedAttacker,
            counterShake,
          );
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

      // Restore from the ultimate cutscene dim once the reveal has settled —
      // unconditional so a targetless/support-only ultimate (if one ever
      // exists) can't leave the screen stuck dimmed. R3 has no dim to clear
      // but still needs its big-hit focus turned back off.
      if (tier.cutscene) {
        await sleep(ULT_RESTORE_MS);
        if (!alive()) return;
        setView((v) => ({ ...v, dim: false }));
      }
      if (tier.windUp) {
        useGameStore.getState().setBigHitFocus(false);
      }

      await sleep(EVENT_GAP_MS);
    },
    [
      addBurst,
      addFloater,
      addSweep,
      anchorFor,
      flashUnit,
      sleep,
      triggerScreenFlash,
      triggerScreenShake,
    ],
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
      useGameStore.getState().setBigHitFocus(false);
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

  // Unmount: invalidate the running generation so stale timers no-op, and
  // clear the shared big-hit-focus flag so it can't outlive this screen.
  React.useEffect(
    () => () => {
      generationRef.current += 1;
      useGameStore.getState().setBigHitFocus(false);
    },
    [],
  );

  const skip = React.useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    runningRef.current = false;
    setView(IDLE_VIEW);
    // Skipping mid-reveal must not leave the shared big-hit-focus flag stuck
    // on, since it's read by components outside this hook's own tree.
    useGameStore.getState().setBigHitFocus(false);
  }, []);

  return { view, skip };
}

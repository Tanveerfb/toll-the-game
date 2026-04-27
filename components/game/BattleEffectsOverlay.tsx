"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";

type EffectKind = "damage" | "heal" | "status" | "system" | "phase";

interface VisualEffect {
  id: number;
  kind: EffectKind;
  text: string;
  anchorInstanceId?: string;
  anchorX?: number;
  anchorY?: number;
}

function resolveInstanceIdByName(
  name: string,
  units: Array<{ instanceId: string; name: string }>,
): string | undefined {
  const normalized = name.trim().toLowerCase();
  const found = units.find((u) => u.name.trim().toLowerCase() === normalized);
  return found?.instanceId;
}

function classifyLogEntry(
  entry: string,
  units: Array<{ instanceId: string; name: string }>,
): Omit<VisualEffect, "id"> {
  const damageMatch = entry.match(/^(.+?)\s+takes\s+(\d+)\s+damage/i);
  if (damageMatch) {
    return {
      kind: "damage",
      text: `-${damageMatch[2]}`,
      anchorInstanceId: resolveInstanceIdByName(damageMatch[1], units),
    };
  }

  const healMatch = entry.match(/^(.+?)\s+heals\s+(\d+)\s+HP/i);
  if (healMatch) {
    return {
      kind: "heal",
      text: `+${healMatch[2]}`,
      anchorInstanceId: resolveInstanceIdByName(healMatch[1], units),
    };
  }

  const statusByName = entry.match(/^(.+?)\s+(is|was)\s+/i);
  if (statusByName) {
    return {
      kind: "status",
      text: entry,
      anchorInstanceId: resolveInstanceIdByName(statusByName[1], units),
    };
  }

  if (
    /(stunned|ignited|taunted|cleansed|debuff|buff|momentum|defeated|activates|consumed)/i.test(
      entry,
    )
  ) {
    return { kind: "status", text: entry };
  }

  return { kind: "system", text: entry };
}

function formatPhaseLabel(phase: string): string {
  return phase
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export default function BattleEffectsOverlay({
  battleLog,
  battlePhase,
  units,
}: {
  battleLog: string[];
  battlePhase: string;
  units: Array<{ instanceId: string; name: string }>;
}): React.JSX.Element {
  const [effects, setEffects] = React.useState<VisualEffect[]>([]);
  const [phasePulse, setPhasePulse] = React.useState(false);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);

  const previousLogLengthRef = React.useRef(0);
  const previousPhaseRef = React.useRef(battlePhase);
  const idRef = React.useRef(0);

  const computeAnchor = React.useCallback((instanceId: string) => {
    if (!overlayRef.current) return undefined;

    const overlayRect = overlayRef.current.getBoundingClientRect();
    const target = document.querySelector<HTMLElement>(
      `[data-battle-instance="${instanceId}"]`,
    );
    if (!target) return undefined;

    const rect = target.getBoundingClientRect();
    return {
      x: rect.left - overlayRect.left + rect.width / 2,
      y: rect.top - overlayRect.top + rect.height * 0.35,
    };
  }, []);

  React.useEffect(() => {
    const previousLength = previousLogLengthRef.current;

    if (battleLog.length > previousLength) {
      const newEntries = battleLog.slice(previousLength);
      const created = newEntries.slice(-4).map((entry) => {
        idRef.current += 1;
        const classified = classifyLogEntry(entry, units);
        const anchor = classified.anchorInstanceId
          ? computeAnchor(classified.anchorInstanceId)
          : undefined;

        return {
          id: idRef.current,
          ...classified,
          anchorX: anchor?.x,
          anchorY: anchor?.y,
        };
      });

      setEffects((prev) => [...prev, ...created].slice(-12));

      created.forEach((effect) => {
        window.setTimeout(
          () => {
            setEffects((prev) => prev.filter((x) => x.id !== effect.id));
          },
          effect.kind === "system" ? 2200 : 1500,
        );
      });
    }

    previousLogLengthRef.current = battleLog.length;
  }, [battleLog, computeAnchor, units]);

  React.useEffect(() => {
    if (previousPhaseRef.current === battlePhase) return;

    idRef.current += 1;
    const phaseEffect: VisualEffect = {
      id: idRef.current,
      kind: "phase",
      text: formatPhaseLabel(battlePhase),
    };

    setPhasePulse(true);
    setEffects((prev) => [...prev, phaseEffect].slice(-12));

    const pulseTimer = window.setTimeout(() => setPhasePulse(false), 280);
    const removeTimer = window.setTimeout(() => {
      setEffects((prev) => prev.filter((x) => x.id !== phaseEffect.id));
    }, 1200);
    previousPhaseRef.current = battlePhase;

    return () => {
      window.clearTimeout(pulseTimer);
      window.clearTimeout(removeTimer);
    };
  }, [battlePhase]);

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
    >
      <AnimatePresence>
        {phasePulse ? (
          <motion.div
            key="phase-pulse"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 bg-linear-to-b from-amber-300/30 via-transparent to-transparent"
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {effects
          .filter((x) => x.kind === "damage" || x.kind === "heal")
          .map((effect) => (
            <motion.div
              key={effect.id}
              initial={{ y: 10, opacity: 0, scale: 0.92 }}
              animate={{ y: -24, opacity: 1, scale: 1 }}
              exit={{ y: -34, opacity: 0 }}
              transition={{ duration: 0.45 }}
              className={`absolute rounded border px-3 py-1 font-heading text-2xl tracking-[0.06em] shadow-2xl md:text-3xl ${
                effect.kind === "damage"
                  ? "border-red-300/70 bg-red-950/70 text-red-200"
                  : "border-emerald-300/70 bg-emerald-950/70 text-emerald-200"
              }`}
              style={{
                left: effect.anchorX ?? "50%",
                top: effect.anchorY ?? 96,
                transform: "translate(-50%, -50%)",
              }}
            >
              {effect.text}
            </motion.div>
          ))}
      </AnimatePresence>

      <div className="absolute right-4 top-24 flex w-[min(92vw,26rem)] flex-col gap-2 md:right-8">
        <AnimatePresence>
          {effects
            .filter(
              (x) =>
                x.kind === "status" ||
                x.kind === "system" ||
                x.kind === "phase",
            )
            .map((effect) => (
              <motion.div
                key={effect.id}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 22, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={`rounded border px-3 py-2 font-body text-xs uppercase tracking-[0.12em] shadow-lg ${
                  effect.kind === "status"
                    ? "border-sky-300/60 bg-sky-900/65 text-sky-100"
                    : effect.kind === "phase"
                      ? "border-amber-300/70 bg-amber-900/65 text-amber-100"
                      : "border-zinc-500/70 bg-zinc-900/70 text-zinc-200"
                }`}
              >
                {effect.kind === "phase"
                  ? `Phase: ${effect.text}`
                  : effect.text}
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

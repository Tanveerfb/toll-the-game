"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";

/**
 * The beat between two waves.
 *
 * A stage's waves share one HP pool, and the player has to see what the last fight
 * cost before choosing to walk into the next one — otherwise attrition is a rule
 * they're told about rather than one they feel. This screen is the whole reason the
 * wave model reads as a *run*.
 *
 * There is no heal here and no team edit: those would undo the attrition. The only
 * decision is whether to press on, and the only other exit is abandoning the
 * stage, which costs the stamina already spent.
 */
export default function WaveBreak({
  cleared,
  total,
  bars,
  onContinue,
  onQuit,
}: {
  /** Waves won so far. */
  cleared: number;
  total: number;
  /** Party state going into the next wave; a fallen unit is `hp: 0`. */
  bars: { id: string; hp: number; max: number }[];
  onContinue: () => void;
  onQuit: () => void;
}): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4">
      <p className="text-center font-body text-[11px] font-bold tracking-[0.22em] text-readout-muted uppercase">
        Wave {cleared} of {total} cleared
      </p>
      <h2 className="pt-1 text-center font-heading text-3xl tracking-[0.06em] text-el-light">
        {cleared >= total ? "Stage clear" : `Wave ${cleared + 1} incoming`}
      </h2>
      <p className="pt-1.5 text-center text-xs leading-relaxed text-readout-dim">
        No healing between waves. Whoever is standing is who fights next.
      </p>

      <ul className="mt-5 flex flex-col gap-2">
        {bars.map((bar) => {
          const character = getCharacterById(bar.id);
          const art = getCharacterArt(bar.id);
          const percent = bar.max > 0 ? Math.round((bar.hp / bar.max) * 100) : 0;
          const down = bar.hp <= 0;
          return (
            <li
              key={bar.id}
              className={`chamfer flex items-center gap-2.5 border bg-panel p-2 ${
                down ? "border-edge opacity-60" : "border-edge"
              }`}
            >
              <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden border border-edge-strong bg-inset text-xs text-readout-dim">
                {art ? (
                  <Image
                    src={art}
                    alt=""
                    fill
                    sizes="40px"
                    className={`object-cover object-top ${down ? "grayscale" : ""}`}
                  />
                ) : (
                  (character?.name ?? bar.id).charAt(0)
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold text-readout-strong">
                    {character?.name ?? bar.id}
                  </span>
                  <span
                    className={`shrink-0 font-body text-[11px] font-bold tabular-nums ${
                      down ? "text-el-red" : "text-readout-dim"
                    }`}
                  >
                    {down ? "DOWN" : `${bar.hp} / ${bar.max}`}
                  </span>
                </span>
                <span className="mt-1 block h-[3px] border border-hairline bg-inset">
                  <span
                    className={`block h-full ${
                      percent <= 33 ? "bg-el-red" : "bg-el-green"
                    }`}
                    style={{ width: `${Math.max(0, percent)}%` }}
                  />
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-col gap-2">
        <Button
          size="xl"
          className="chamfer font-heading tracking-[0.09em]"
          onClick={onContinue}
        >
          {cleared >= total ? "CONTINUE ▸" : `ENTER WAVE ${cleared + 1} ▸`}
        </Button>
        <Button variant="ghost" className="chamfer" onClick={onQuit}>
          Abandon stage
        </Button>
      </div>
    </div>
  );
}

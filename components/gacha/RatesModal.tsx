"use client";

import Image from "next/image";
import React from "react";
import DetailOverlay from "@/components/game/DetailOverlay";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { getCharacterArt } from "@/lib/game/characterArt";

/**
 * Banner odds. Previously reachable only through a 10px underlined link under
 * the draw buttons; it's a real control on the banner screen now.
 */
export default function RatesModal({
  featured,
  rate,
  missNote,
  onClose,
}: {
  featured: string[];
  /** Combined chance that a pull lands on ANY featured unit. */
  rate: number;
  /** What the remaining share pays out, when there is one. */
  missNote?: string;
  onClose: () => void;
}): React.JSX.Element {
  const perUnitPercent = ((rate / Math.max(featured.length, 1)) * 100).toFixed(
    3,
  );
  const missPercent = ((1 - rate) * 100).toFixed(2);

  return (
    <DetailOverlay
      title="Rates & pool"
      subtitle={`${(rate * 100).toFixed(2)}% for a featured unit`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1.5">
        {featured.map((id) => {
          const character = getCharacterById(id);
          const art = getCharacterArt(id);
          return (
            <div
              key={id}
              className="flex items-center gap-2.5 border border-hairline bg-panel px-2.5 py-1.5"
            >
              <span className="relative h-8 w-8 shrink-0 overflow-hidden border border-edge bg-inset">
                {art ? (
                  <Image
                    src={art}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-cover object-top"
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate font-body text-sm text-readout">
                {character?.name ?? id}
              </span>
              <span className="shrink-0 font-body text-xs font-bold tabular-nums text-readout-strong">
                {perUnitPercent}%
              </span>
            </div>
          );
        })}
      </div>

      {rate < 1 ? (
        <div className="mt-3 border-t border-hairline pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-readout-muted">
              Everything else
            </span>
            <span className="font-body text-xs font-bold tabular-nums text-readout-dim">
              {missPercent}%
            </span>
          </div>
          <p className="mt-1 font-body text-[11px] leading-snug text-readout-muted">
            {missNote ??
              "Split evenly across coin, levelling manuals and local-specialty materials."}
          </p>
        </div>
      ) : null}
    </DetailOverlay>
  );
}

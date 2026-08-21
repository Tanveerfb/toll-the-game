"use client";

import Image from "next/image";
import React from "react";
import DetailOverlay from "@/components/game/DetailOverlay";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { getCharacterArt } from "@/lib/game/characterArt";
import { usePlayerStore } from "@/store/playerStore";
import { ELEMENT_SWATCH } from "@/lib/game/elementSwatch";

/**
 * The final-milestone reward: pick any featured unit.
 *
 * Shows what you already own and at what ult rank, because that's the whole
 * decision — a pick is either a new character or a rank on one you have, and
 * the old grid showed neither.
 */
export default function MilestonePicker({
  characterIds,
  onPick,
  onClose,
}: {
  characterIds: string[];
  onPick: (characterId: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const roster = usePlayerStore((s) => s.roster);
  const characters = usePlayerStore((s) => s.characters);
  const [selected, setSelected] = React.useState<string | null>(null);

  const chosen = selected ? getCharacterById(selected) : null;

  return (
    <DetailOverlay
      title="Choose your reward"
      subtitle="Milestone reached — any featured unit"
      size="wide"
      onClose={onClose}
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {characterIds.map((id) => {
          const character = getCharacterById(id);
          const art = getCharacterArt(id);
          const owned = roster.includes(id);
          const ultLevel = characters[id]?.ultLevel ?? 1;
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              aria-pressed={active}
              className={`flex flex-col overflow-hidden border bg-inset text-left transition-colors ${
                active
                  ? "border-signal shadow-[inset_0_0_0_1px_var(--color-signal)]"
                  : "border-hairline hover:border-edge-strong"
              }`}
            >
              <span className="relative block aspect-square overflow-hidden bg-void">
                {art ? (
                  <Image
                    src={art}
                    alt={character?.name ?? id}
                    fill
                    sizes="160px"
                    className="object-cover object-top"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-heading text-2xl text-readout-dim">
                    {(character?.name ?? id).charAt(0)}
                  </span>
                )}
                {character ? (
                  <span
                    className={`absolute left-0 top-0 h-2 w-2 ${ELEMENT_SWATCH[character.color]}`}
                  />
                ) : null}
              </span>
              <span className="px-1.5 py-1">
                <span className="block truncate font-heading text-sm leading-tight tracking-[0.04em] text-readout-strong">
                  {character?.name ?? id}
                </span>
                <span
                  className={`block font-body text-[9px] font-bold uppercase tracking-[0.12em] ${owned ? "text-signal" : "text-el-light"}`}
                >
                  {owned ? `Owned · Ult ${ultLevel}` : "New unit"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 border-t border-hairline pt-3">
        <p className="min-w-0 flex-1 font-body text-[11px] leading-snug text-readout-muted">
          Taking this only wraps the lap once every other reward on it has been
          claimed too.
        </p>
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onPick(selected)}
          className="flex min-h-11 shrink-0 items-center border border-el-light bg-el-light/12 px-5 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-el-light transition-colors hover:bg-el-light/20 disabled:border-hairline disabled:bg-transparent disabled:text-readout-muted"
        >
          {chosen ? `Claim ${chosen.name}` : "Pick a unit"}
        </button>
      </div>
    </DetailOverlay>
  );
}

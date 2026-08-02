"use client";

import Image from "next/image";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { getCharacterArt } from "@/lib/game/characterArt";
import ModalShell from "@/components/gacha/ModalShell";

interface MilestonePickerProps {
  characterIds: string[];
  onPick: (characterId: string) => void;
  onClose: () => void;
}

export default function MilestonePicker({ characterIds, onPick, onClose }: MilestonePickerProps) {
  return (
    <ModalShell onClose={onClose} maxWidth="lg" backdropClassName="bg-black/80" borderClassName="border-amber-400/60">
      <h2 className="font-heading text-xl text-amber-200">Choose your reward</h2>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {characterIds.map((id) => {
          const character = getCharacterById(id);
          const art = getCharacterArt(id);
          return (
            <button
              key={id}
              onClick={() => onPick(id)}
              className="flex flex-col items-center gap-1 border border-zinc-700 bg-zinc-900 p-1.5 hover:border-amber-400"
            >
              {art ? (
                <Image src={art} alt={character?.name ?? id} width={80} height={80} className="h-16 w-16 object-cover" />
              ) : (
                <div className="h-16 w-16 bg-zinc-800" />
              )}
              <span className="font-body text-[10px] text-zinc-200">{character?.name ?? id}</span>
            </button>
          );
        })}
      </div>
    </ModalShell>
  );
}

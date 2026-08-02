"use client";

import { getCharacterById } from "@/lib/game/characterCatalog";
import ModalShell from "@/components/gacha/ModalShell";

interface RatesModalProps {
  featured: string[];
  rate: number;
  onClose: () => void;
}

export default function RatesModal({ featured, rate, onClose }: RatesModalProps) {
  const perUnitPercent = ((rate / featured.length) * 100).toFixed(3);

  return (
    <ModalShell onClose={onClose} maxWidth="md" backdropClassName="bg-black/70" borderClassName="border-zinc-700">
      <h2 className="font-heading text-xl text-zinc-100">Rates</h2>
      <p className="mt-1 font-body text-xs text-zinc-500">
        Overall featured rate: {(rate * 100).toFixed(2)}%
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {featured.map((id) => {
          const character = getCharacterById(id);
          return (
            <li key={id} className="flex items-center justify-between border-b border-zinc-800 pb-1.5 font-body text-sm">
              <span className="text-zinc-200">{character?.name ?? id}</span>
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-300">
                  Rate Up
                </span>
                {perUnitPercent}%
              </span>
            </li>
          );
        })}
      </ul>
      <button
        onClick={onClose}
        className="mt-4 w-full rounded border border-zinc-700 py-2 font-body text-xs uppercase tracking-widest text-zinc-300"
      >
        Close
      </button>
    </ModalShell>
  );
}

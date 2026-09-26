"use client";

import Image from "next/image";
import React from "react";
import MountedDialog from "@/components/ui/MountedDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    <MountedDialog
      title="Choose your reward"
      description="Milestone reached — any featured unit"
      onClose={onClose}
      className="sm:max-w-2xl"
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
              // Picked is the action yellow, as everywhere else.
              className={cn(
                "flex flex-col overflow-hidden border-2 bg-muted text-left transition-colors",
                active ? "border-border ink-slab-primary" : "border-rule hover:border-border",
              )}
            >
              <span className="relative block aspect-square overflow-hidden border-b-2 border-border bg-card">
                {art ? (
                  <Image
                    src={art}
                    alt={character?.name ?? id}
                    fill
                    sizes="160px"
                    className="object-cover object-top"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-heading text-2xl text-muted-foreground">
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
                <span className="block truncate font-heading text-sm leading-tight tracking-title">
                  {character?.name ?? id}
                </span>
                {/* A new unit is the reward gold, an owned one plain: fills,
                    not coloured text, on paper. */}
                <span
                  className={cn(
                    "inline-block font-body text-label font-bold uppercase tracking-label",
                    owned ? "text-muted-foreground" : "bg-el-light/55 px-1",
                  )}
                >
                  {owned ? `Owned · Ult ${ultLevel}` : "New unit"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 border-t-2 border-border pt-3">
        <p className="min-w-0 flex-1 font-body text-caption leading-snug text-muted-foreground">
          Taking this only wraps the lap once every other reward on it has been
          claimed too.
        </p>
        <Button
          variant="claim"
          size="sm"
          disabled={!selected}
          onClick={() => selected && onPick(selected)}
          className="shrink-0"
        >
          {chosen ? `Claim ${chosen.name}` : "Pick a unit"}
        </Button>
      </div>
    </MountedDialog>
  );
}

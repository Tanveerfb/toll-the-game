// components/game/WorldBossTeamSelect.tsx
"use client";

import React from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getPlayableCharacters, type CharacterData } from "@/lib/game/characterCatalog";
import type { TeamPick } from "@/hooks/BattleProvider";

const MAX_TEAM_SIZE = 4;

/** Same slot-picker UX as TeamSelect's player side, restricted to
 *  roster-owned characters — TeamSelect itself stays a full-catalog dev
 *  sandbox and is intentionally not reused/parameterized for this. */
export default function WorldBossTeamSelect({
  ownedIds,
  onChange,
  team,
}: {
  ownedIds: string[];
  team: CharacterData[];
  onChange: (team: CharacterData[]) => void;
}): React.JSX.Element {
  const [rosterOpen, setRosterOpen] = React.useState(false);
  const owned = React.useMemo(
    () => getPlayableCharacters().filter((c) => ownedIds.includes(c.id)),
    [ownedIds],
  );

  const toggle = (character: CharacterData) => {
    if (team.some((c) => c.id === character.id)) {
      onChange(team.filter((c) => c.id !== character.id));
    } else if (team.length < MAX_TEAM_SIZE) {
      onChange([...team, character]);
    }
  };

  return (
    <>
      <Card className="rounded-none border-2 border-sky-400/70 bg-black/50 ring-0">
        <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg tracking-[0.12em] text-sky-200">
              YOUR TEAM
            </CardTitle>
            <span className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
              {team.length}/{MAX_TEAM_SIZE}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-2 p-3">
          {Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => {
            const character = team[index];
            if (!character) {
              return (
                <button
                  key={`empty-${index}`}
                  type="button"
                  onClick={() => setRosterOpen(true)}
                  className="flex h-24 cursor-pointer flex-col items-center justify-center border-2 border-dashed border-zinc-700 text-3xl leading-none text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-400"
                >
                  +
                </button>
              );
            }
            const art = getCharacterArt(character.id);
            return (
              <button
                key={`${character.id}-${index}`}
                type="button"
                onClick={() => setRosterOpen(true)}
                className="group relative flex h-24 cursor-pointer flex-col items-center justify-end overflow-hidden border-2 border-zinc-600 bg-zinc-900/70"
              >
                {art ? (
                  <Image src={art} alt={character.name} width={256} height={256} className="absolute inset-0 h-full w-full object-cover object-top opacity-90" />
                ) : null}
                <span className="relative z-10 w-full bg-black/60 px-1 py-0.5 text-center font-heading text-xs tracking-[0.06em] text-zinc-100">
                  {character.name}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {rosterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm">
          <Card className="flex max-h-full w-full max-w-4xl flex-col rounded-none border-2 border-sky-400/70 bg-zinc-950/95 ring-0">
            <CardHeader className="border-b border-zinc-800 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-heading text-2xl tracking-[0.12em] text-sky-200">
                    YOUR ROSTER
                  </CardTitle>
                  <CardDescription className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
                    Tap to add or remove • {team.length}/{MAX_TEAM_SIZE} picked
                  </CardDescription>
                </div>
                <Button onClick={() => setRosterOpen(false)} className="h-10 rounded-none border-2 border-amber-300 px-6 font-heading text-base tracking-[0.14em]">
                  DONE
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4">
              {owned.length === 0 ? (
                <p className="col-span-full py-8 text-center font-body text-sm text-zinc-500">
                  No owned characters yet.
                </p>
              ) : null}
              {owned.map((character) => {
                const pickIndex = team.findIndex((c) => c.id === character.id);
                const isPicked = pickIndex !== -1;
                const disabled = !isPicked && team.length >= MAX_TEAM_SIZE;
                const art = getCharacterArt(character.id);
                return (
                  <button
                    key={character.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(character)}
                    className={`group relative flex h-40 flex-col justify-end overflow-hidden border-2 text-left transition-all ${
                      isPicked
                        ? "border-sky-400/70 ring-2 ring-sky-400/60"
                        : disabled
                          ? "cursor-not-allowed border-zinc-800 opacity-40"
                          : "border-zinc-700 hover:border-zinc-400"
                    } bg-zinc-900/70`}
                  >
                    {art ? (
                      <Image src={art} alt={character.name} width={256} height={256} className="absolute inset-0 h-full w-full object-cover object-top opacity-90" />
                    ) : null}
                    {isPicked ? (
                      <span className="absolute right-1 top-1 z-10 border border-sky-400/70 bg-black/70 px-1.5 py-0.5 font-heading text-xs text-sky-200">
                        ✓ {pickIndex + 1}
                      </span>
                    ) : null}
                    <span className="relative z-10 w-full bg-black/70 px-2 py-1">
                      <span className="block truncate font-heading text-base tracking-[0.06em] text-zinc-100">
                        {character.name}
                      </span>
                      <span className="mt-0.5 flex gap-1">
                        <Badge variant="secondary" className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest">ATK {character.atk}</Badge>
                        <Badge variant="secondary" className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest">DEF {character.def}</Badge>
                        <Badge variant="secondary" className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest">HP {character.hp}</Badge>
                      </span>
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}

/** Converts the picked team into the TeamPick[] shape startCustomBattle expects. */
export function toWorldBossTeamPicks(team: CharacterData[]): TeamPick[] {
  return team.map((c) => ({ id: c.id }));
}

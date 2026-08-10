// components/game/OwnedTeamSelect.tsx
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
 *  sandbox and is intentionally not reused/parameterized for this.
 *
 *  `anchors` are units the mode fixes in place: they occupy the leading slots,
 *  can't be removed, and — importantly — bypass the owned-roster restriction,
 *  since story canon leads must be playable by an account that hasn't pulled
 *  them. With enough anchors to fill the team (a fully canon chapter) the
 *  roster overlay never opens and this degrades to a read-only team readout. */
export default function OwnedTeamSelect({
  ownedIds,
  onChange,
  team,
  anchors = [],
  openSlots: openSlotsProp,
  title = "YOUR TEAM",
  lockedNote = "CANON",
}: {
  ownedIds: string[];
  team: CharacterData[];
  onChange: (team: CharacterData[]) => void;
  anchors?: CharacterData[];
  /** Slots the player may fill. Defaults to whatever the anchors leave over;
   *  pass 0 to lock the team entirely even when anchors don't fill it (a
   *  canon story chapter is one unit, but none of the other three are the
   *  player's to fill). */
  openSlots?: number;
  title?: string;
  lockedNote?: string;
}): React.JSX.Element {
  const [rosterOpen, setRosterOpen] = React.useState(false);
  const openSlots = Math.max(
    0,
    Math.min(openSlotsProp ?? MAX_TEAM_SIZE - anchors.length, MAX_TEAM_SIZE - anchors.length),
  );
  const anchoredIds = React.useMemo(() => new Set(anchors.map((c) => c.id)), [anchors]);

  const owned = React.useMemo(
    () => getPlayableCharacters().filter((c) => ownedIds.includes(c.id) && !anchoredIds.has(c.id)),
    [ownedIds, anchoredIds],
  );

  const toggle = (character: CharacterData) => {
    if (team.some((c) => c.id === character.id)) {
      onChange(team.filter((c) => c.id !== character.id));
    } else if (team.length < openSlots) {
      onChange([...team, character]);
    }
  };

  const openRoster = () => {
    if (openSlots > 0) setRosterOpen(true);
  };

  return (
    <>
      <Card className="rounded-none chamfer-lg border border-signal bg-panel ring-0">
        <CardHeader className="border-b border-hairline px-4 py-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg tracking-[0.12em] text-signal">
              {title}
            </CardTitle>
            <span className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-readout-muted">
              {openSlots === 0
                ? `${anchors.length} locked`
                : `${anchors.length + team.length}/${MAX_TEAM_SIZE}`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-2 p-3">
          {anchors.map((character, index) => {
            const art = getCharacterArt(character.id);
            return (
              <div
                key={`anchor-${character.id}-${index}`}
                className="relative flex h-24 flex-col items-center justify-end overflow-hidden border border-role-ultimate bg-inset"
              >
                {art ? (
                  <Image src={art} alt={character.name} width={256} height={256} className="absolute inset-0 h-full w-full object-cover object-top opacity-90" />
                ) : null}
                <span className="absolute left-1 top-1 z-10 bg-role-ultimate px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-widest text-void">
                  {lockedNote}
                </span>
                <span className="relative z-10 w-full bg-void/75 px-1 py-0.5 text-center font-heading text-xs tracking-[0.06em] text-readout-strong">
                  {character.name}
                </span>
              </div>
            );
          })}

          {Array.from({ length: openSlots }).map((_, index) => {
            const character = team[index];
            if (!character) {
              return (
                <button
                  key={`empty-${index}`}
                  type="button"
                  onClick={openRoster}
                  className="flex h-24 cursor-pointer flex-col items-center justify-center border border-dashed border-edge text-3xl leading-none text-readout-muted transition-colors hover:border-signal hover:text-signal"
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
                onClick={openRoster}
                className="group relative flex h-24 cursor-pointer flex-col items-center justify-end overflow-hidden border border-edge bg-inset"
              >
                {art ? (
                  <Image src={art} alt={character.name} width={256} height={256} className="absolute inset-0 h-full w-full object-cover object-top opacity-90" />
                ) : null}
                <span className="relative z-10 w-full bg-void/75 px-1 py-0.5 text-center font-heading text-xs tracking-[0.06em] text-readout-strong">
                  {character.name}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {rosterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm">
          <Card className="flex max-h-full w-full max-w-4xl flex-col rounded-none chamfer-lg border border-edge-strong bg-panel ring-0">
            <CardHeader className="border-b border-hairline px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-heading text-2xl tracking-[0.12em] text-signal">
                    YOUR ROSTER
                  </CardTitle>
                  <CardDescription className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-readout-muted">
                    Tap to add or remove • {team.length}/{openSlots} picked
                  </CardDescription>
                </div>
                <Button onClick={() => setRosterOpen(false)} className="chamfer h-11 rounded-none border border-signal bg-signal px-6 font-heading text-base tracking-[0.14em] text-void">
                  DONE
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4">
              {owned.length === 0 ? (
                <p className="col-span-full py-8 text-center font-body text-sm text-readout-muted">
                  No owned characters yet.
                </p>
              ) : null}
              {owned.map((character) => {
                const pickIndex = team.findIndex((c) => c.id === character.id);
                const isPicked = pickIndex !== -1;
                const disabled = !isPicked && team.length >= openSlots;
                const art = getCharacterArt(character.id);
                return (
                  <button
                    key={character.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(character)}
                    className={`group relative flex h-40 flex-col justify-end overflow-hidden border-2 text-left transition-all ${
                      isPicked
                        ? "border-signal ring-1 ring-signal"
                        : disabled
                          ? "cursor-not-allowed border-hairline opacity-40"
                          : "border-edge hover:border-edge-strong"
                    } bg-inset`}
                  >
                    {art ? (
                      <Image src={art} alt={character.name} width={256} height={256} className="absolute inset-0 h-full w-full object-cover object-top opacity-90" />
                    ) : null}
                    {isPicked ? (
                      <span className="absolute right-1 top-1 z-10 border border-signal bg-void/80 px-1.5 py-0.5 font-heading text-xs text-signal">
                        ✓ {pickIndex + 1}
                      </span>
                    ) : null}
                    <span className="relative z-10 w-full bg-void/80 px-2 py-1">
                      <span className="block truncate font-heading text-base tracking-[0.06em] text-readout-strong">
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

/** Converts a picked team into the TeamPick[] shape startCustomBattle expects. */
export function toTeamPicks(team: CharacterData[]): TeamPick[] {
  return team.map((c) => ({ id: c.id }));
}

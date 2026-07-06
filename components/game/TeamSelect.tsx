"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TeamPick } from "@/hooks/BattleProvider";
import {
  getAllCharacters,
  type CharacterData,
} from "@/lib/game/characterCatalog";

const MAX_TEAM_SIZE = 4;

type Side = "player" | "enemy";

interface SlotPick {
  character: CharacterData;
  isSub: boolean;
}

function colorSwatchClass(color: string): string {
  switch (color) {
    case "light":
      return "bg-zinc-100";
    case "red":
      return "bg-red-500";
    case "blue":
      return "bg-sky-500";
    case "green":
      return "bg-emerald-500";
    case "dark":
      return "bg-violet-500";
    default:
      return "bg-zinc-300";
  }
}

function TeamSlots({
  side,
  team,
  onRemove,
  onToggleSub,
}: {
  side: Side;
  team: SlotPick[];
  onRemove: (side: Side, index: number) => void;
  onToggleSub: (side: Side, index: number) => void;
}): React.JSX.Element {
  const subCount = team.filter((p) => p.isSub).length;

  return (
    <Card
      className={`rounded-none border-2 ${side === "player" ? "border-sky-400/70" : "border-rose-400/70"} bg-black/50 ring-0`}
    >
      <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <CardTitle
            className={`font-heading text-lg tracking-[0.12em] ${side === "player" ? "text-sky-200" : "text-rose-200"}`}
          >
            {side === "player" ? "PLAYER TEAM" : "ENEMY TEAM"}
          </CardTitle>
          <span className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
            {team.filter((p) => !p.isSub).length} field
            {subCount > 0 ? ` + ${subCount} sub` : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-4 gap-2 p-3">
        {Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => {
          const pick = team[index];
          if (!pick) {
            return (
              <div
                key={`empty-${index}`}
                className="flex h-24 items-center justify-center border-2 border-dashed border-zinc-700 font-heading text-2xl text-zinc-700"
              >
                {index + 1}
              </div>
            );
          }
          return (
            <div
              key={`${pick.character.id}-${index}`}
              className={`flex h-24 flex-col border-2 ${pick.isSub ? "border-amber-400/70 bg-amber-950/20" : "border-zinc-600 bg-zinc-900/70"}`}
            >
              <button
                type="button"
                onClick={() => onRemove(side, index)}
                className="group flex flex-1 flex-col items-center justify-center gap-1"
                title="Remove from team"
              >
                <span
                  className={`h-3 w-3 border border-border ${colorSwatchClass(pick.character.color)}`}
                />
                <span className="px-1 font-heading text-sm tracking-[0.06em] text-zinc-100 group-hover:hidden">
                  {pick.character.name}
                </span>
                <span className="hidden px-1 font-body text-[10px] uppercase tracking-widest text-red-300 group-hover:block">
                  Remove
                </span>
              </button>
              <button
                type="button"
                onClick={() => onToggleSub(side, index)}
                disabled={!pick.isSub && subCount >= 1}
                className={`border-t px-1 py-0.5 font-body text-[9px] uppercase tracking-widest transition-colors ${
                  pick.isSub
                    ? "border-amber-400/60 bg-amber-400/15 text-amber-200"
                    : subCount >= 1
                      ? "border-zinc-800 text-zinc-700"
                      : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
                }`}
                title="A sub's passive stays active, but it only takes the field when a teammate falls"
              >
                {pick.isSub ? "SUB ★" : "Set Sub"}
              </button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function TeamSelect({
  onStart,
}: {
  onStart: (playerPicks: TeamPick[], enemyPicks: TeamPick[]) => void;
}): React.JSX.Element {
  const roster = React.useMemo(() => getAllCharacters(), []);
  const [playerTeam, setPlayerTeam] = React.useState<SlotPick[]>([]);
  const [enemyTeam, setEnemyTeam] = React.useState<SlotPick[]>([]);

  const setTeam = (side: Side) =>
    side === "player" ? setPlayerTeam : setEnemyTeam;

  const addTo = (side: Side, character: CharacterData) => {
    setTeam(side)((team) =>
      team.length < MAX_TEAM_SIZE &&
      !team.some((p) => p.character.id === character.id)
        ? [...team, { character, isSub: false }]
        : team,
    );
  };

  const removeAt = (side: Side, index: number) => {
    setTeam(side)((team) => team.filter((_, i) => i !== index));
  };

  const toggleSub = (side: Side, index: number) => {
    setTeam(side)((team) =>
      team.map((pick, i) =>
        i === index ? { ...pick, isSub: !pick.isSub } : pick,
      ),
    );
  };

  // A team needs at least one FIELD unit; a lone sub can't fight
  const validTeam = (team: SlotPick[]) =>
    team.some((p) => !p.isSub) && team.length > 0;
  const canStart = validTeam(playerTeam) && validTeam(enemyTeam);

  const toPicks = (team: SlotPick[]): TeamPick[] =>
    team.map((p) => ({ id: p.character.id, isSub: p.isSub || undefined }));

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-4xl tracking-[0.14em] text-zinc-100 md:text-5xl">
            TEAM SELECT
          </h1>
          <p className="mt-1 font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
            Sandbox — build both teams. Mark one unit per team as SUB: its
            passive works from the bench, and it enters when a teammate falls.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            disabled={playerTeam.length === 0 && enemyTeam.length === 0}
            onClick={() => {
              setPlayerTeam([]);
              setEnemyTeam([]);
            }}
            className="rounded-none border border-zinc-700 font-heading tracking-[0.12em] text-zinc-300"
          >
            CLEAR
          </Button>
          <Button
            size="lg"
            disabled={!canStart}
            onClick={() => onStart(toPicks(playerTeam), toPicks(enemyTeam))}
            className="h-11 rounded-none border-2 border-amber-300 bg-[linear-gradient(90deg,#b45309_0%,#d97706_38%,#f59e0b_70%,#facc15_100%)] px-8 font-heading text-lg tracking-[0.14em] text-zinc-950"
          >
            START BATTLE
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TeamSlots
          side="player"
          team={playerTeam}
          onRemove={removeAt}
          onToggleSub={toggleSub}
        />
        <TeamSlots
          side="enemy"
          team={enemyTeam}
          onRemove={removeAt}
          onToggleSub={toggleSub}
        />
      </div>

      <Card className="rounded-none border-2 border-zinc-700 bg-black/50 ring-0">
        <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg tracking-[0.12em] text-zinc-100">
              ROSTER
            </CardTitle>
            <CardDescription className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
              A character can appear once per side
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {roster.map((character) => {
            const onPlayer = playerTeam.some(
              (p) => p.character.id === character.id,
            );
            const onEnemy = enemyTeam.some(
              (p) => p.character.id === character.id,
            );
            return (
              <div
                key={character.id}
                className="flex items-center justify-between gap-2 border border-zinc-700 bg-zinc-900/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 shrink-0 border border-border ${colorSwatchClass(character.color)}`}
                    />
                    <span className="truncate font-heading text-lg tracking-[0.06em] text-zinc-100">
                      {character.name}
                    </span>
                  </div>
                  <div className="mt-0.5 flex gap-1">
                    <Badge
                      variant="secondary"
                      className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest"
                    >
                      ATK {character.atk}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest"
                    >
                      DEF {character.def}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="rounded-none px-1 py-0 font-body text-[9px] uppercase tracking-widest"
                    >
                      HP {character.hp}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={onPlayer || playerTeam.length >= MAX_TEAM_SIZE}
                    onClick={() => addTo("player", character)}
                    className="rounded-none border-sky-400/60 bg-transparent text-[10px] uppercase tracking-widest text-sky-200"
                  >
                    {onPlayer ? "✓" : "+ P"}
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={onEnemy || enemyTeam.length >= MAX_TEAM_SIZE}
                    onClick={() => addTo("enemy", character)}
                    className="rounded-none border-rose-400/60 bg-transparent text-[10px] uppercase tracking-widest text-rose-200"
                  >
                    {onEnemy ? "✓" : "+ E"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

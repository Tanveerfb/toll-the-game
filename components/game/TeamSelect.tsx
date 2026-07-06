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
import {
  getAllCharacters,
  type CharacterData,
} from "@/lib/game/characterCatalog";

const MAX_TEAM_SIZE = 4;

type Side = "player" | "enemy";

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
}: {
  side: Side;
  team: CharacterData[];
  onRemove: (side: Side, index: number) => void;
}): React.JSX.Element {
  const accent =
    side === "player"
      ? "border-sky-400/70 text-sky-200"
      : "border-rose-400/70 text-rose-200";

  return (
    <Card className={`rounded-none border-2 ${accent} bg-black/50 ring-0`}>
      <CardHeader className="border-b border-zinc-800 px-4 py-3">
        <CardTitle
          className={`font-heading text-xl tracking-[0.12em] ${side === "player" ? "text-sky-200" : "text-rose-200"}`}
        >
          {side === "player" ? "PLAYER TEAM" : "ENEMY TEAM"} ({team.length}/
          {MAX_TEAM_SIZE})
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        {Array.from({ length: MAX_TEAM_SIZE }).map((_, index) => {
          const member = team[index];
          if (!member) {
            return (
              <div
                key={`empty-${index}`}
                className="flex h-20 items-center justify-center border-2 border-dashed border-zinc-700 font-heading text-2xl text-zinc-700"
              >
                {index + 1}
              </div>
            );
          }
          return (
            <button
              key={`${member.id}-${index}`}
              type="button"
              onClick={() => onRemove(side, index)}
              className="group flex h-20 flex-col items-center justify-center gap-1 border-2 border-zinc-600 bg-zinc-900/70 transition-colors hover:border-red-400/80"
              title="Remove from team"
            >
              <span
                className={`h-3 w-3 border border-border ${colorSwatchClass(member.color)}`}
              />
              <span className="px-1 font-heading text-sm tracking-[0.06em] text-zinc-100 group-hover:hidden">
                {member.name}
              </span>
              <span className="hidden px-1 font-body text-[10px] uppercase tracking-widest text-red-300 group-hover:block">
                Remove
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function TeamSelect({
  onStart,
}: {
  onStart: (playerIds: string[], enemyIds: string[]) => void;
}): React.JSX.Element {
  const roster = React.useMemo(() => getAllCharacters(), []);
  const [playerTeam, setPlayerTeam] = React.useState<CharacterData[]>([]);
  const [enemyTeam, setEnemyTeam] = React.useState<CharacterData[]>([]);

  const addTo = (side: Side, character: CharacterData) => {
    if (side === "player") {
      setPlayerTeam((team) =>
        team.length < MAX_TEAM_SIZE && !team.some((c) => c.id === character.id)
          ? [...team, character]
          : team,
      );
    } else {
      setEnemyTeam((team) =>
        team.length < MAX_TEAM_SIZE && !team.some((c) => c.id === character.id)
          ? [...team, character]
          : team,
      );
    }
  };

  const removeAt = (side: Side, index: number) => {
    if (side === "player") {
      setPlayerTeam((team) => team.filter((_, i) => i !== index));
    } else {
      setEnemyTeam((team) => team.filter((_, i) => i !== index));
    }
  };

  const canStart = playerTeam.length > 0 && enemyTeam.length > 0;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 md:px-8">
      <div>
        <h1 className="font-heading text-4xl tracking-[0.14em] text-zinc-100 md:text-5xl">
          TEAM SELECT
        </h1>
        <p className="mt-1 font-body text-sm uppercase tracking-[0.14em] text-zinc-400">
          Sandbox — build both teams, then start the battle
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TeamSlots side="player" team={playerTeam} onRemove={removeAt} />
        <TeamSlots side="enemy" team={enemyTeam} onRemove={removeAt} />
      </div>

      <Card className="rounded-none border-2 border-zinc-700 bg-black/50 ring-0">
        <CardHeader className="border-b border-zinc-800 px-4 py-3">
          <CardTitle className="font-heading text-xl tracking-[0.12em] text-zinc-100">
            ROSTER
          </CardTitle>
          <CardDescription className="font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
            A character can appear once per side
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {roster.map((character) => {
            const onPlayer = playerTeam.some((c) => c.id === character.id);
            const onEnemy = enemyTeam.some((c) => c.id === character.id);
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
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={onPlayer || playerTeam.length >= MAX_TEAM_SIZE}
                    onClick={() => addTo("player", character)}
                    className="rounded-none border-sky-400/60 bg-transparent text-[10px] uppercase tracking-widest text-sky-200"
                  >
                    {onPlayer ? "On Team" : "+ Player"}
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={onEnemy || enemyTeam.length >= MAX_TEAM_SIZE}
                    onClick={() => addTo("enemy", character)}
                    className="rounded-none border-rose-400/60 bg-transparent text-[10px] uppercase tracking-widest text-rose-200"
                  >
                    {onEnemy ? "On Team" : "+ Enemy"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
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
          onClick={() =>
            onStart(
              playerTeam.map((c) => c.id),
              enemyTeam.map((c) => c.id),
            )
          }
          className="h-12 rounded-none border-2 border-amber-300 bg-[linear-gradient(90deg,#b45309_0%,#d97706_38%,#f59e0b_70%,#facc15_100%)] px-8 font-heading text-xl tracking-[0.14em] text-zinc-950"
        >
          START BATTLE
        </Button>
      </div>
    </section>
  );
}

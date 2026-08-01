"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlayerStore } from "@/store/playerStore";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";

const MATERIAL_IDS = [
  "sea_monster_eye",
  "corroded_seaweed",
  "training_manual",
  "training_manual_advanced",
  "training_manual_premium",
] as const;

/** Dev-only testing tool — same NODE_ENV gate as BattleArena's "SAVE BATTLE
 *  LOG" button. Lets currency/materials/level/ascension/stamina be set
 *  directly instead of grinding, and simulates a stamina spend so the
 *  regen/guard math is exercised without a real fight.
 *
 *  Hooks are called unconditionally on every render (rules-of-hooks); the
 *  NODE_ENV check happens after them and just gates what gets returned, so
 *  this never renders anything in a production build. */
export default function DevGrantPanel(): React.JSX.Element | null {
  const { currencies, characters, roster, addCharacterToRoster, grantMaterials, grantCurrency, spendStaminaAction, setPlayerState } =
    usePlayerStore();
  const [selectedCharId, setSelectedCharId] = React.useState(roster[0] ?? "duke");
  const [levelInput, setLevelInput] = React.useState("1");
  const [ascensionInput, setAscensionInput] = React.useState("0");

  if (process.env.NODE_ENV === "production") return null;

  const setCharacterProgress = () => {
    setPlayerState({
      characters: {
        ...characters,
        [selectedCharId]: {
          level: Number(levelInput) || 1,
          ascension: Number(ascensionInput) || 0,
          xp: 0,
        },
      },
    });
  };

  return (
    <Card className="rounded-none border-2 border-sky-400 bg-black/50 ring-0">
      <CardHeader className="border-b border-zinc-800 px-4 py-2.5">
        <CardTitle className="font-heading text-lg tracking-[0.12em] text-sky-200">
          DEV GRANT PANEL
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => grantCurrency({ gems: 1000 })}>+1000 Gems</Button>
          <Button variant="outline" onClick={() => grantCurrency({ coin: 50000 })}>+50000 Coin</Button>
          {MATERIAL_IDS.map((id) => (
            <Button key={id} variant="outline" onClick={() => grantMaterials({ [id]: 10 })}>
              +10 {id}
            </Button>
          ))}
          <Button variant="outline" onClick={() => spendStaminaAction(40)}>Simulate a run (-40 stamina)</Button>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-3">
          <label className="flex flex-col gap-1">
            <span className="font-body text-[10px] uppercase tracking-widest text-zinc-500">Character</span>
            <select
              value={selectedCharId}
              onChange={(e) => setSelectedCharId(e.target.value)}
              className="border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
            >
              {getPlayableCharacters().map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-body text-[10px] uppercase tracking-widest text-zinc-500">Level</span>
            <Input value={levelInput} onChange={(e) => setLevelInput(e.target.value)} className="w-16" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-body text-[10px] uppercase tracking-widest text-zinc-500">Ascension</span>
            <Input value={ascensionInput} onChange={(e) => setAscensionInput(e.target.value)} className="w-16" />
          </label>
          <Button variant="outline" onClick={setCharacterProgress}>Set</Button>
          <Button
            variant="outline"
            disabled={roster.includes(selectedCharId)}
            onClick={() => addCharacterToRoster(selectedCharId)}
          >
            Add to roster
          </Button>
        </div>

        <p className="font-body text-xs text-zinc-500">
          Gems {currencies.gems} • Coin {currencies.coin} • Roster: {roster.join(", ")}
        </p>
      </CardContent>
    </Card>
  );
}

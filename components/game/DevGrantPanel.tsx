"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { panelVariants } from "@/components/ui/Panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  LIMITED_MILESTONE_FINAL,
  LIMITED_MILESTONE_FIRST,
  PERMANENT_MILESTONE_FINAL,
} from "@/lib/gacha/milestone";
import { usePlayerStore } from "@/store/playerStore";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";
import DuelToggle from "@/components/ui/DuelToggle";

const MATERIAL_IDS = [
  "sea_monster_eye",
  "corroded_seaweed",
  "training_manual",
  "training_manual_advanced",
  "training_manual_premium",
  "riverstone_fragment",
  "scorched_ember",
  "bramble_thorn",
  "prism_dust",
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
          ultLevel: characters[selectedCharId]?.ultLevel ?? 1,
        },
      },
    });
  };

  return (
    // Paper with a dashed ink edge: the one panel on the page that is not
    // part of the game, and says so without a colour of its own.
    <section className={cn(panelVariants({ surface: "paper", density: "none" }), "border-dashed")}>
      <div className="border-b-2 border-border px-4 py-2.5">
        <h2 className="font-heading text-lg tracking-label">Dev grant panel</h2>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {/* Moved off TopNav 2026-09-01 (Tanveer) — developer tooling was
            holding permanent width in a 390px bar. The setting is global; only
            its control lives here. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-rule pb-3">
          <span className="font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
            Enemy AI
          </span>
          <DuelToggle />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => grantCurrency({ gems: 1000 })}>+1000 Gems</Button>
          <Button variant="outline" onClick={() => grantCurrency({ coin: 50000 })}>+50000 Coin</Button>
          {MATERIAL_IDS.map((id) => (
            <Button key={id} variant="outline" onClick={() => grantMaterials({ [id]: 10 })}>
              +10 {id}
            </Button>
          ))}
          <Button variant="outline" onClick={() => grantCurrency({ permanentTicket: 100 })}>+100 Tickets</Button>
          <Button
            variant="outline"
            onClick={() =>
              setPlayerState({
                pity: { ...usePlayerStore.getState().pity, limited: { ...usePlayerStore.getState().pity.limited, bar: LIMITED_MILESTONE_FIRST } },
              })
            }
          >
            Force Limited bar to first milestone
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setPlayerState({
                pity: { ...usePlayerStore.getState().pity, limited: { ...usePlayerStore.getState().pity.limited, bar: LIMITED_MILESTONE_FINAL } },
              })
            }
          >
            Force Limited bar to final milestone
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setPlayerState({ pity: { ...usePlayerStore.getState().pity, permanent: { ...usePlayerStore.getState().pity.permanent, bar: PERMANENT_MILESTONE_FINAL } } })
            }
          >
            Force Permanent bar to milestone
          </Button>
          <Button variant="outline" onClick={() => spendStaminaAction(40)}>Simulate a run (-40 stamina)</Button>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-rule pt-3">
          <div className="flex flex-col gap-1">
            <span className="font-body text-label uppercase tracking-label text-muted-foreground">Character</span>
            {/* The shadcn select (ruling #154), not a native one. */}
            <Select value={selectedCharId} onValueChange={setSelectedCharId}>
              <SelectTrigger aria-label="Character" className="min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getPlayableCharacters().map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-body text-label uppercase tracking-label text-muted-foreground">Level</span>
            <Input value={levelInput} onChange={(e) => setLevelInput(e.target.value)} className="w-16" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-body text-label uppercase tracking-label text-muted-foreground">Ascension</span>
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

        <p className="font-body text-xs text-muted-foreground">
          Gems {currencies.gems} • Coin {currencies.coin} • Roster: {roster.join(", ")}
        </p>
      </div>
    </section>
  );
}

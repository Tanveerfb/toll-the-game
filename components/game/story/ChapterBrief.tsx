"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import OwnedTeamSelect from "@/components/game/OwnedTeamSelect";
import { getCharacterById, type CharacterData } from "@/lib/game/characterCatalog";
import { materialLabel } from "@/lib/game/materials";
import { STAMINA_CAP } from "@/lib/game/stamina";
import { storyAttemptCost } from "@/lib/game/storyRewards";
import { storyAnchors, storyOpenSlots } from "@/lib/game/storyTeam";
import type { StoryChapter } from "@/types/story";

const TEAM_MODE_NOTE: Record<StoryChapter["teamMode"], string> = {
  canon: "Canon battle — the story fixes this team",
  anchored: "Canon leads are fixed; fill the rest from your roster",
  free: "Bring any team from your roster",
};

/** "300–800 Coin" / "2 Training Manual" — the brief advertises what a run pays
 *  before the player spends stamina on it. */
function rangeLabel(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

function useRewardLines(chapter: StoryChapter, cleared: boolean): string[] {
  return React.useMemo(() => {
    const lines: string[] = [];
    if (!cleared) {
      const { gems, coin, permanentTicket, materials } = chapter.rewards.firstClear;
      if (gems) lines.push(`${gems} Gems`);
      if (coin) lines.push(`${coin} Coin`);
      if (permanentTicket) lines.push(`${permanentTicket} Permanent Ticket`);
      for (const [id, qty] of Object.entries(materials ?? {})) {
        if (qty) lines.push(`${qty} ${materialLabel(id)}`);
      }
      return lines;
    }
    const { coin, materials } = chapter.rewards.repeat;
    if (coin) lines.push(`${rangeLabel(coin.min, coin.max)} Coin`);
    for (const [id, range] of Object.entries(materials ?? {})) {
      lines.push(`${rangeLabel(range.min, range.max)} ${materialLabel(id)}`);
    }
    return lines;
  }, [chapter, cleared]);
}

export default function ChapterBrief({
  chapter,
  chapterNumber,
  cleared,
  ownedIds,
  currentStamina,
  onStart,
  onBack,
}: {
  chapter: StoryChapter;
  chapterNumber: number;
  cleared: boolean;
  ownedIds: string[];
  currentStamina: number;
  /** `picks` are player-chosen character ids; anchors are resolved downstream
   *  by `resolveStoryTeam` so this component never assembles a battle team. */
  onStart: (picks: string[], skipScenes: boolean) => void;
  onBack: () => void;
}): React.JSX.Element {
  const [picked, setPicked] = React.useState<CharacterData[]>([]);

  const anchors = React.useMemo(
    () =>
      storyAnchors(chapter)
        .map((pick) => getCharacterById(pick.id))
        .filter((c): c is CharacterData => Boolean(c)),
    [chapter],
  );
  const openSlots = storyOpenSlots(chapter);
  const cost = storyAttemptCost(chapter.rewards, cleared);
  const affordable = currentStamina >= cost;
  const rewardLines = useRewardLines(chapter, cleared);

  const enemies = chapter.battle.enemyTeam
    .map((pick) => getCharacterById(pick.id)?.name ?? pick.id)
    .join(" · ");

  const start = (skipScenes: boolean) => {
    if (!affordable) return;
    onStart(picked.map((c) => c.id), skipScenes);
  };

  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl space-y-4 px-4 py-8 md:px-8">
      <Card className="rounded-none border-2 border-zinc-700 bg-black/55 ring-0">
        <CardHeader className="border-b border-zinc-700 px-6 py-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-body text-xs uppercase tracking-[0.16em] text-amber-300">
                Chapter {chapterNumber}
                {cleared ? " · Cleared" : ""}
              </p>
              <CardTitle className="mt-1 font-heading text-3xl tracking-[0.12em] text-zinc-100 md:text-4xl">
                {chapter.title}
              </CardTitle>
              <p className="mt-2 font-body text-xs uppercase tracking-[0.14em] text-zinc-400">
                {TEAM_MODE_NOTE[chapter.teamMode]}
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={onBack}
              className="rounded-none border border-zinc-700 font-heading tracking-[0.12em] text-zinc-300"
            >
              ◂ BACK
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-4 md:p-6">
          <div className="flex items-center justify-between border border-zinc-800 px-4 py-3">
            <span className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
              Opposition
            </span>
            <span className="font-heading text-sm tracking-[0.06em] text-rose-200">{enemies}</span>
          </div>

          <div className="border border-zinc-800 px-4 py-3">
            <p className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
              {cleared ? "Drops per clear" : "First clear bonus"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rewardLines.length === 0 ? (
                <span className="font-body text-sm text-zinc-500">Nothing</span>
              ) : (
                rewardLines.map((line) => (
                  <Badge
                    key={line}
                    className="rounded-none border border-amber-300/60 bg-amber-300/10 font-body text-[10px] uppercase tracking-widest text-amber-200"
                  >
                    {line}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border border-zinc-800 px-4 py-3">
            <span className="font-body text-xs uppercase tracking-[0.14em] text-zinc-500">
              Stamina
            </span>
            <span className="font-heading text-sm text-zinc-100">
              {cost === 0 ? "FREE — first clear" : `−${cost}`}
              <span className="ml-2 text-zinc-500">
                ({currentStamina} / {STAMINA_CAP})
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      <OwnedTeamSelect
        ownedIds={ownedIds}
        team={picked}
        onChange={setPicked}
        anchors={anchors}
        openSlots={openSlots}
        title={openSlots === 0 ? "STORY TEAM" : "YOUR TEAM"}
      />

      {!affordable ? (
        <p className="font-body text-sm text-red-400">
          Not enough stamina — wait for it to regenerate.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          disabled={!affordable}
          onClick={() => start(false)}
          className="h-12 flex-1 rounded-none border-2 border-amber-300 bg-[linear-gradient(90deg,#b45309_0%,#d97706_38%,#f59e0b_70%,#facc15_100%)] font-heading text-lg tracking-[0.14em] text-zinc-950"
        >
          {cleared ? "REPLAY" : "BEGIN"}
          {cost > 0 ? ` (${cost} STAMINA)` : ""}
        </Button>
        {/* Farming a cleared chapter through eight VN panels every run would
            make the loop unusable — skipping is offered only once the player
            has actually seen the scenes. */}
        {cleared ? (
          <Button
            size="lg"
            variant="ghost"
            disabled={!affordable}
            onClick={() => start(true)}
            className="h-12 rounded-none border-2 border-zinc-700 px-6 font-heading text-base tracking-[0.14em] text-zinc-300"
          >
            SKIP STORY
          </Button>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { panelVariants } from "@/components/ui/Panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import LevelTab from "@/components/game/growth/LevelTab";
import AscendTab from "@/components/game/growth/AscendTab";
import UltimateTab from "@/components/game/growth/UltimateTab";
import { usePlayerStore, progressFromMap } from "@/store/playerStore";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { maxLevelForAscension } from "@/lib/game/ascension";
import { MAX_ULT_LEVEL } from "@/lib/gacha/dupes";

type TabId = "level" | "ascend" | "ultimate";

/**
 * Growth, as three tabs.
 *
 * Rebuilt 2026-09-17 from `docs/design/mockups/growth-modal.html`, which he
 * reviewed and chose from. It was one long scroll holding three sections that
 * each solved the same problem — *spend a stack of things to raise a number* —
 * a different way, and the worst of the three was on the biggest number:
 * levelling spent **one manual per tap**, so reaching Lv 20 took 190 presses.
 *
 * Every tab now has the same four slots in the same order — **where you are ·
 * what it costs · what you get · one button** — and the button states the
 * blocker rather than the verb. `CostChip` and `StatDelta` are shared, so a
 * fourth growth axis does not mean a fourth implementation of a bill.
 *
 * The tab strip carries each axis's current value, so the modal answers
 * *where am I* before you open anything.
 *
 * **The shadcn `Tabs` since 2026-09-26** (ruling #154, `line` because they sit
 * in the paper dialog). This was the game's one hand-built tab set.
 */
function GrowthTabs({
  characterId,
}: {
  characterId: string;
}): React.JSX.Element | null {
  const characters = usePlayerStore((s) => s.characters);
  const [tab, setTab] = React.useState<TabId>("level");

  const character = getCharacterById(characterId);
  if (!character) return null;

  const progress = progressFromMap(characters, characterId);
  const tabs: Array<{ id: TabId; label: string; value: string; show: boolean }> = [
    {
      id: "level",
      label: "Level",
      value: `${progress.level} / ${maxLevelForAscension(progress.ascension)}`,
      show: true,
    },
    { id: "ascend", label: "Ascend", value: `A${progress.ascension}`, show: true },
    {
      id: "ultimate",
      label: "Ultimate",
      value: `UL${progress.ultLevel}`,
      // A kit with no ultimate gets no tab, rather than a tab that renders
      // nothing — the old panel returned null from inside the section and left
      // a heading with a gap under it.
      show: Boolean(character.ultimate),
    },
  ];
  const shown = tabs.filter((t) => t.show);

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
      <TabsList variant="line" aria-label="Growth">
        {shown.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="flex-col gap-0 py-1">
            <span className="font-body text-label font-bold uppercase tracking-label">
              {t.label}
            </span>
            <span className="font-heading text-base leading-none tracking-title">
              {t.value}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="level" className="pt-1">
        <LevelTab character={character} />
      </TabsContent>
      <TabsContent value="ascend" className="pt-1">
        <AscendTab character={character} />
      </TabsContent>
      {character.ultimate ? (
        <TabsContent value="ultimate" className="pt-1">
          <UltimateTab character={character} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

/**
 * Growth entry point on the archive detail page.
 *
 * Was an always-expanded card that ate most of the sidebar and rendered for
 * EVERY character — unowned ones and story-only NPCs included, offering to
 * level things the player has no claim to. Now it's a single button that only
 * appears for a character the player owns, opening the tabs in the shadcn
 * `Dialog` (the shared `DetailOverlay` until 2026-09-26).
 *
 * Ownership is read after `hasHydrated` so the server render and the first
 * client render agree (the roster lives in localStorage).
 */
export default function CharacterProgressionPanel({
  characterId,
  storyOnly = false,
}: {
  characterId: string;
  /** NPC/enemy/boss kits have no progression at all — render nothing. */
  storyOnly?: boolean;
}): React.JSX.Element | null {
  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const roster = usePlayerStore((s) => s.roster);
  const characters = usePlayerStore((s) => s.characters);
  const [open, setOpen] = React.useState(false);

  if (storyOnly) return null;
  if (!hasHydrated) return null;

  if (!roster.includes(characterId)) {
    return (
      <p
        className={cn(
          panelVariants({ surface: "paper", density: "tight" }),
          "text-center font-body text-label font-bold uppercase tracking-label text-muted-foreground",
        )}
      >
        Not owned — summon to level up
      </p>
    );
  }

  const progress = progressFromMap(characters, characterId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="w-full">
          {/* The button states where the character stands, so the modal is
              worth opening rather than being the only way to find out. */}
          Growth · Lv {progress.level} · A{progress.ascension} · UL
          {progress.ultLevel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Growth</DialogTitle>
          <DialogDescription className="text-caption font-bold uppercase tracking-eyebrow">
            Max ult level {MAX_ULT_LEVEL}
          </DialogDescription>
        </DialogHeader>
        <GrowthTabs characterId={characterId} />
      </DialogContent>
    </Dialog>
  );
}

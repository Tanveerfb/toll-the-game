"use client";

import React from "react";

import DetailOverlay from "@/components/game/DetailOverlay";
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
    <div>
      <div
        role="tablist"
        aria-label="Growth"
        className="grid border-b border-hairline"
        style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
      >
        {shown.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`flex min-h-11 flex-col items-center justify-center border-r border-hairline px-2 py-1 transition-colors last:border-r-0 ${
                active
                  ? "bg-panel text-signal shadow-[inset_0_-2px_0_var(--color-signal)]"
                  : "bg-inset text-readout-muted hover:text-readout-dim"
              }`}
            >
              <span className="font-body text-[10px] font-bold uppercase tracking-label">
                {t.label}
              </span>
              <span
                className={`font-heading text-[15px] leading-none tracking-title ${
                  active ? "text-readout-strong" : "text-readout-dim"
                }`}
              >
                {t.value}
              </span>
            </button>
          );
        })}
      </div>

      <div className="pt-3">
        {tab === "level" ? <LevelTab character={character} /> : null}
        {tab === "ascend" ? <AscendTab character={character} /> : null}
        {tab === "ultimate" ? <UltimateTab character={character} /> : null}
      </div>
    </div>
  );
}

/**
 * Growth entry point on the archive detail page.
 *
 * Was an always-expanded card that ate most of the sidebar and rendered for
 * EVERY character — unowned ones and story-only NPCs included, offering to
 * level things the player has no claim to. Now it's a single button that only
 * appears for a character the player owns, opening the tabs in the shared
 * DetailOverlay modal.
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
      <p className="chamfer border border-edge bg-panel px-3 py-2 text-center font-body text-[10px] font-bold uppercase tracking-label text-readout-muted">
        Not owned — summon to level up
      </p>
    );
  }

  const progress = progressFromMap(characters, characterId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="chamfer flex w-full min-h-11 items-center justify-center gap-2 border border-role-heal/60 bg-role-heal/8 font-body text-[11px] font-bold uppercase tracking-label text-role-heal transition-colors hover:bg-role-heal/16"
      >
        {/* The button states where the character stands, so the modal is worth
            opening rather than being the only way to find out. */}
        Growth · Lv {progress.level} · A{progress.ascension} · UL
        {progress.ultLevel}
      </button>
      {open ? (
        <DetailOverlay
          title="Growth"
          subtitle={`Max ult level ${MAX_ULT_LEVEL}`}
          onClose={() => setOpen(false)}
        >
          <GrowthTabs characterId={characterId} />
        </DetailOverlay>
      ) : null}
    </>
  );
}

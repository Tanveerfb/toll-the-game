"use client";

import { Button } from "@/components/ui/button";
import React from "react";
import EmptyState from "@/components/ui/EmptyState";
import RosterToolbar, {
  FilterChip,
  FilterGroup,
} from "@/components/game/RosterToolbar";
import RosterTile from "@/components/game/RosterTile";
import { useRosterFilters } from "@/hooks/useRosterFilters";
import { archiveHref } from "@/lib/game/characterCatalog";
import { EL_CODE, EL_HUE } from "@/lib/game/elementStyle";
import type { RosterColor, RosterFilterItem } from "@/lib/game/rosterFilter";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";

export interface CharacterBrowserItem {
  id: string;
  /** The archive URL's public handle - see `archiveHref`. */
  cardNumber: number;
  /** The title above the name (ruling #141). */
  heading?: string;
  name: string;
  color: RosterColor;
  atk: number;
  def: number;
  hp: number;
  tags?: string[];
  mechanics?: string[];
}

interface CharacterBrowserProps {
  characters: CharacterBrowserItem[];
  /**
   * Whether these characters can be owned at all.
   *
   * `false` for the NPC index: story-only kits are never acquirable, so
   * Locked badges, the grayscale treatment, the level/ascension pip and the
   * owned-only filter are all answering a question that doesn't apply to them.
   */
  ownership?: boolean;
}

type BrowserRow = CharacterBrowserItem & RosterFilterItem;

export default function CharacterBrowser({
  characters,
  ownership = true,
}: CharacterBrowserProps): React.JSX.Element {
  const roster = usePlayerStore((s) => s.roster);
  const characterProgress = usePlayerStore((s) => s.characters);
  const hasHydratedStore = usePlayerStore((s) => s.hasHydrated);
  // The archive took over the roster listing from `/profile`, so by default it
  // shows what you own. Unowned units are one click away, not gone.
  const showUnownedSetting = useSettingsStore((s) => s.showUnownedCharacters);
  const setShowUnowned = useSettingsStore((s) => s.setShowUnownedCharacters);
  const ownedIds = React.useMemo(() => new Set(roster), [roster]);

  // The NPC index lists story-only kits, which **cannot be acquired**. Running
  // them through the ownership treatment marked every one Locked and greyed
  // them out — a permanent lock on something that was never a lock, and the
  // owned-only default hid the entire page behind a toggle (Tanveer,
  // 2026-08-13).
  //
  // Collapsing the two flags here rather than branching at every use keeps the
  // rest of the component honest: with ownership off, nothing is unowned, so
  // no filter runs, no toggle renders and no tile dims.
  const showUnowned = ownership ? showUnownedSetting : true;
  const hasHydrated = ownership ? hasHydratedStore : false;

  // The Level sort reads this: owned units only, so an unowned unit (or any
  // unit before the store rehydrates) has none and sorts last.
  const rows = React.useMemo<BrowserRow[]>(
    () =>
      characters.map((c) => ({
        ...c,
        level:
          hasHydrated && ownedIds.has(c.id)
            ? (characterProgress[c.id]?.level ?? 1)
            : undefined,
      })),
    [characters, hasHydrated, ownedIds, characterProgress],
  );

  const filters = useRosterFilters(rows);

  // Ownership can only be judged once the store has rehydrated; before that
  // everything shows, same reason the tiles hold back their state label
  // rather than flashing "Locked" on a unit you own.
  const filtered = filters.filtered.filter(
    (c) => showUnowned || !hasHydrated || ownedIds.has(c.id),
  );

  const hiddenByOwnership =
    hasHydrated && !showUnowned
      ? characters.filter((c) => !ownedIds.has(c.id)).length
      : 0;

  return (
    <section className="space-y-3">
      <RosterToolbar
        filters={filters}
        sortFields={ownership ? ["level", "atk", "def", "hp"] : ["atk", "def", "hp"]}
        extraCount={ownership && showUnowned ? 1 : 0}
        // Owned-only is the default view, so the control that changes it
        // says what it would reveal rather than what it currently is.
        // Absent entirely where nothing can be owned.
        extraGroups={
          ownership ? (
            <FilterGroup label="Show">
              <FilterChip
                active={showUnowned}
                onClick={() => setShowUnowned(!showUnowned)}
              >
                {showUnowned ? "Owned only" : "Locked units"}
              </FilterChip>
            </FilterGroup>
          ) : null
        }
      />

      {/* Unit grid */}
      {filtered.length === 0 ? (
        <EmptyState
          framed
          className="py-10"
          // Without this, an empty grid on a fresh account reads as a bug
          // rather than as "you own one character and it's filtered out".
          action={
            hiddenByOwnership > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowUnowned(true)}
              >
                Show locked units
              </Button>
            ) : null
          }
        >
          No units match this query.
        </EmptyState>
      ) : (
        // Room above each row for a head to break out of its frame, and below
        // for the level plate that overlaps the bottom edge.
        <div className="grid grid-cols-3 gap-x-2.5 gap-y-8 pt-8 pb-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {filtered.map((character) => {
            const owned = hasHydrated && ownedIds.has(character.id);
            const progress = characterProgress[character.id];
            // Pre-hydration we don't know what's owned, so the tile shows no
            // plate at all rather than flashing "Locked" on an owned unit.
            const status = !hasHydrated
              ? null
              : owned
                ? { owned: true as const, level: progress?.level ?? 1, ultLevel: progress?.ultLevel ?? 1 }
                : { owned: false as const };
            return (
              <RosterTile
                key={character.id}
                id={character.id}
                name={character.name}
                href={archiveHref(character)}
                hue={EL_HUE[character.color]}
                code={EL_CODE[character.color]}
                status={status}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

"use client";

import React from "react";
import PanelSheet from "@/components/gacha/PanelSheet";
import UnitTileFace from "@/components/game/UnitTileFace";
import { getCharacterById } from "@/lib/game/characterCatalog";
import { elementCode, elementHue } from "@/lib/game/elementStyle";

/**
 * The banner's pool, as the archive's tiles.
 *
 * It was twelve 44px portraits in a wrapping grid with each name behind a
 * `Hint` (twelve taps to read one banner), then a table (2026-09-01), and is now
 * the archive's own tile, so a unit looks the same here as everywhere it is
 * chosen (his call, 2026-10-03: a unit's tile and its portrait are one image).
 * An owned unit shows its level plate and ult stars in full colour; one you
 * have yet to pull is dimmed and reads "Not yet".
 *
 * The tile carries no name (as in the archive), so the name is printed under
 * it: here the name is the point.
 */

export interface FeaturedRow {
  id: string;
  owned: boolean;
  level: number;
  ultLevel: number;
}

export default function FeaturedSheet({
  rows,
  hasHydrated,
  trigger,
}: {
  rows: FeaturedRow[];
  /** Ownership is unknown until the player store rehydrates. */
  hasHydrated: boolean;
  /** The panel that opens this sheet. */
  trigger: React.ReactNode;
}): React.JSX.Element {
  const ownedCount = rows.filter((row) => row.owned).length;

  return (
    <PanelSheet
      trigger={trigger}
      title="Featured units"
      description={
        hasHydrated
          ? `${ownedCount} of ${rows.length} owned`
          : `${rows.length} units`
      }
    >
      {/* Room above each row for a head to break out of its frame and below
          for the plate that overlaps the bottom edge; the sheet's own scroller
          takes a long pool (ruling #107). */}
      <ul className="grid grid-cols-3 gap-x-4 gap-y-6 px-2 pt-6 pb-2 sm:grid-cols-4">
        {rows.map((row) => {
          const character = getCharacterById(row.id);
          const name = character?.name ?? row.id;
          const status = !hasHydrated
            ? null
            : row.owned
              ? { owned: true as const, level: row.level, ultLevel: row.ultLevel }
              : { owned: false as const };
          return (
            <li key={row.id} className="flex flex-col gap-3">
              <UnitTileFace
                id={row.id}
                name={name}
                hue={character ? elementHue(character.color) : elementHue("light")}
                code={character ? elementCode(character.color) : ""}
                status={status}
                plate={status && !status.owned ? "Not yet" : undefined}
                dimmed={status !== null && !status.owned}
              />
              <span className="truncate text-center font-heading text-sm leading-tight tracking-title">
                {name}
              </span>
            </li>
          );
        })}
      </ul>
    </PanelSheet>
  );
}

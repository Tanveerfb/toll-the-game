"use client";

import Image from "next/image";
import React from "react";
import MountedDialog from "@/components/ui/MountedDialog";
import { getCharacterArt } from "@/lib/game/characterArt";
import { getCharacterById } from "@/lib/game/characterCatalog";
import type { Color } from "@/types/color";

/**
 * The banner's pool, as a table.
 *
 * It was twelve 44px portraits in a wrapping grid, with the name and ownership
 * behind a `Hint` on each tile — one tap per unit, twelve taps to answer "what
 * is in this banner and how much of it do I have". A browser audit at 393px on
 * 2026-09-01 is what surfaced it; Tanveer's call was to lift the whole section
 * into a modal and make it a table, so the answer is one tap and then reading.
 *
 * A table rather than a bigger grid because ownership is the column a player
 * actually scans, and a column of the same three words is scannable in a way
 * that twelve differently-dimmed portraits are not.
 *
 * Element hues match `CharacterBrowser` deliberately — same units, same
 * code. On paper the code is a fill with ink on it (ruling #154), and
 * "Owned" is the action yellow, the game's "yours" everywhere else.
 */
const EL_HUE: Record<Color, string> = {
  light: "var(--color-el-light)",
  red: "var(--color-el-red)",
  blue: "var(--color-el-blue)",
  green: "var(--color-el-green)",
  dark: "var(--color-el-dark)",
};
const EL_CODE: Record<Color, string> = {
  light: "LGT",
  red: "RED",
  blue: "BLU",
  green: "GRN",
  dark: "DRK",
};

export interface FeaturedRow {
  id: string;
  owned: boolean;
  ultLevel: number;
}

export default function FeaturedModal({
  rows,
  hasHydrated,
  onClose,
}: {
  rows: FeaturedRow[];
  /** Ownership is unknown until the player store rehydrates. */
  hasHydrated: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const ownedCount = rows.filter((row) => row.owned).length;

  return (
    <MountedDialog
      title="Featured units"
      description={
        hasHydrated
          ? `${ownedCount} of ${rows.length} owned`
          : `${rows.length} units`
      }
      onClose={onClose}
    >
      {/* Its own scroller, so a long name never widens the page (mobile-first,
          ruling #107). */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-border">
              <th
                scope="col"
                className="py-1.5 pr-2 text-left font-body text-label font-bold uppercase tracking-label text-muted-foreground"
                colSpan={2}
              >
                Unit
              </th>
              <th
                scope="col"
                className="py-1.5 text-right font-body text-label font-bold uppercase tracking-label text-muted-foreground"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const character = getCharacterById(row.id);
              const art = getCharacterArt(row.id);
              const color = character?.color;
              return (
                <tr key={row.id} className="border-b border-rule">
                  <td className="w-9 py-1.5 pr-2">
                    <span
                      className={`relative block h-9 w-9 overflow-hidden border bg-muted ${
                        row.owned && hasHydrated
                          ? "border-border"
                          : "border-rule opacity-45"
                      }`}
                    >
                      {art ? (
                        <Image
                          src={art}
                          alt=""
                          fill
                          sizes="36px"
                          className="object-cover object-top"
                        />
                      ) : null}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-body text-sm">
                        {character?.name ?? row.id}
                      </span>
                      {color ? (
                        <span
                          className="shrink-0 border border-border px-1 font-body text-label font-bold tracking-label text-card-foreground"
                          style={{ backgroundColor: EL_HUE[color] }}
                        >
                          {EL_CODE[color]}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-1.5 text-right">
                    {!hasHydrated ? (
                      <span className="font-body text-caption text-muted-foreground">
                        —
                      </span>
                    ) : row.owned ? (
                      <span className="bg-primary px-1 font-body text-caption font-bold uppercase tracking-label text-primary-foreground">
                        Owned
                        {row.ultLevel > 1 ? (
                          <span className="ml-1 tabular-nums">
                            · Ult {row.ultLevel}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="font-body text-caption font-bold uppercase tracking-label text-muted-foreground">
                        Not owned
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MountedDialog>
  );
}

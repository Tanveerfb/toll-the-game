import React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getCharacterArt, getTileArt } from "@/lib/game/characterArt";

/**
 * The archive's roster tile: the "Ink burst" frame break (his pick,
 * 2026-10-03, docs/design/mockups/archive-tile-v3.html, after Dokkan's roster).
 *
 * - The frame and its ground are the unit's element colour (`hue`).
 * - A unit with new-pipeline art (`getTileArt`) is a cut-out standing on an
 *   element burst, and its head BREAKS OUT of the frame's top edge. Older
 *   units show their portrait flat inside the frame; he said not to force the
 *   old art into it.
 * - Detail layer: the element code on the corner, the level on a plate across
 *   the bottom edge, and one star per ultimate level on the right edge (his
 *   call: ult level, not ascension - "ascension is irrelevant as the char level
 *   is shown already").
 * - No name and no rarity on the tile, as in Dokkan; search still finds by
 *   name, and the name is in the link's accessible label.
 */
export interface RosterTileProps {
  id: string;
  name: string;
  href: string;
  hue: string;
  code: string;
  /** null hides the plate: before hydration, or on a page with no ownership. */
  status: { owned: true; level: number; ultLevel: number } | { owned: false } | null;
}

/** The window's inset from the frame's outer edge. */
const WINDOW_INSET = "inset-1.5";

export default function RosterTile({ id, name, href, hue, code, status }: RosterTileProps): React.JSX.Element {
  const tile = getTileArt(id);
  const portrait = getCharacterArt(id);
  const locked = status !== null && !status.owned;
  const dim = locked ? "grayscale brightness-50" : "";
  const label = !status
    ? name
    : status.owned
      ? `${name}, level ${status.level}, ultimate level ${status.ultLevel}`
      : `${name}, not yet recruited`;

  return (
    <Link
      href={href}
      aria-label={label}
      className="group relative block aspect-square outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
      style={{ "--el": hue } as React.CSSProperties}
    >
      {/* Frame: an element bevel with an ink line inside it. */}
      <span aria-hidden className="tile-bevel absolute inset-0 border-2 border-border bg-(color:--el)" />
      <span aria-hidden className="tile-bevel-inner absolute inset-[3px] border-2 border-border" />

      {/* Window */}
      <span className={cn("tile-bevel-inner absolute overflow-hidden bg-card-foreground", WINDOW_INSET)}>
        {tile ? (
          <>
            <span aria-hidden className={cn("tile-burst absolute inset-0", dim)} />
            <Image
              src={tile.src}
              alt=""
              width={480}
              height={Math.round(480 * tile.ratio)}
              className={cn("absolute bottom-0 left-0 h-auto w-full", dim)}
            />
          </>
        ) : portrait ? (
          <Image
            src={portrait}
            alt=""
            width={320}
            height={320}
            className={cn("h-full w-full object-cover object-top", dim)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-heading text-4xl text-ground-dim">
            {name.charAt(0)}
          </span>
        )}
      </span>

      {/* The break-out: the same cut-out again, unclipped by the window, with
          only the band ABOVE the window showing (the bottom 1/ratio of its
          height is the window's part, clipped away). */}
      {tile ? (
        <span aria-hidden className={cn("pointer-events-none absolute z-10", WINDOW_INSET, "top-auto")}>
          <Image
            src={tile.src}
            alt=""
            width={480}
            height={Math.round(480 * tile.ratio)}
            className={cn("absolute bottom-0 left-0 h-auto w-full", dim)}
            style={{ clipPath: `inset(-20% -10% ${(100 / tile.ratio).toFixed(2)}% -10%)` }}
          />
        </span>
      ) : null}

      {/* Element code, tipped over the top-right corner. */}
      <span className="ink-skew absolute -right-2 -top-2.5 z-20 rotate-3 border-2 border-border bg-(color:--el) px-1.5 pt-0.5 font-heading text-sm leading-none tracking-title text-card-foreground ink-slab-sm">
        {code}
      </span>

      {status ? (
        <span className="ink-skew absolute -bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap border-2 border-(color:--el) bg-card-foreground px-2 pt-0.5 font-heading text-sm leading-none tracking-title text-(--el)">
          {status.owned ? `Lv ${status.level}` : "Locked"}
        </span>
      ) : null}

      {status?.owned ? (
        <span
          aria-hidden
          className="absolute -right-1.5 bottom-2 z-20 flex flex-col-reverse gap-px drop-shadow-[0_0_1px_var(--card-foreground)]"
        >
          {Array.from({ length: status.ultLevel }, (_, i) => (
            <span key={i} className="tile-star size-3 bg-(color:--el)" />
          ))}
        </span>
      ) : null}
    </Link>
  );
}

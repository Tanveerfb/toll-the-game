import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getCharacterArt, getTileArt } from "@/lib/game/characterArt";

/**
 * The "Ink burst" tile's face (ruling #172, his pick 2026-10-03,
 * docs/design/mockups/archive-tile-v3.html, after Dokkan's roster) - the frame,
 * window, burst, break-out cut-out, element code, plate and stars - with no
 * behaviour of its own. The archive wraps it in a `Link` (`RosterTile`) and the
 * team picker wraps it in a `button`, so a unit looks the same wherever it is
 * chosen (his call, 2026-10-03: a unit's tile and its portrait are one image).
 *
 * - The frame and its ground are the unit's element colour (`hue`).
 * - A unit with new-pipeline art (`getTileArt`) is a cut-out standing on an
 *   element burst, and its head BREAKS OUT of the frame's top edge. Older
 *   units show their portrait flat inside the frame; he said not to force the
 *   old art into it.
 * - Detail layer: the element code on the corner, a plate across the bottom
 *   edge, and one star per ultimate level on the right edge (his call: ult
 *   level, not ascension - "ascension is irrelevant as the char level is shown
 *   already").
 * - No name and no rarity on the tile, as in Dokkan; the wrapper carries the
 *   accessible name.
 *
 * The face is all `span`s, so it is valid inside a link or a button. The break-
 * out and the corner badges overhang the box: give the surrounding layout room.
 */

/** Classes every wrapper (link or button) of a face carries. */
export const unitTileWrapperClass =
  "group block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px disabled:active:translate-y-0";

export interface UnitTileFaceProps {
  id: string;
  name: string;
  hue: string;
  code: string;
  /** The archive's plate and stars: level + ult level, or "Locked". null hides
   *  both - before hydration, or on a screen with no ownership. */
  status?: { owned: true; level: number; ultLevel: number } | { owned: false } | null;
  /** Replaces the status plate's text ("Lv 12", "Sub"); shows a plate even
   *  when `status` is null. */
  plate?: string;
  /** `highlight` fills the plate in the action yellow, for a plate that says
   *  something happened to this unit ("New!" in the summon results) rather than
   *  what it is. Default: the element's own colours. */
  plateTone?: "element" | "highlight";
  /** Greyed and darkened: a locked unit, or the bench slot. */
  dimmed?: boolean;
  /** Ringed in the action yellow: the unit is in the team. */
  picked?: boolean;
  /** The unit's slot in the team, 1-based, on the corner opposite the code. */
  pickNumber?: number;
  /** A dashed frame with a "+", for a team slot nobody holds. Ignores the art. */
  empty?: boolean;
}

/** The window's inset from the frame's outer edge. */
const WINDOW_INSET = "inset-1.5";

export default function UnitTileFace({
  id,
  name,
  hue,
  code,
  status = null,
  plate,
  plateTone = "element",
  dimmed = false,
  picked = false,
  pickNumber,
  empty = false,
}: UnitTileFaceProps): React.JSX.Element {
  const tile = empty ? null : getTileArt(id);
  const portrait = empty ? null : getCharacterArt(id);
  const dim = dimmed || (status !== null && !status.owned) ? "grayscale brightness-50" : "";
  const plateText = plate ?? (status ? (status.owned ? `Lv ${status.level}` : "Locked") : null);

  return (
    <span className="relative block aspect-square" style={{ "--el": hue } as React.CSSProperties}>
      {empty ? (
        <>
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-muted-foreground font-heading text-3xl leading-none text-muted-foreground group-hover:border-border group-hover:text-card-foreground"
          >
            +
          </span>
          {plateText ? (
            <span className="absolute -bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap border-2 border-muted-foreground bg-card px-2 pt-0.5 font-heading text-sm leading-none tracking-title text-muted-foreground">
              {plateText}
            </span>
          ) : null}
        </>
      ) : (
        <>
          {/* Picked: the same bevel, a step larger, in the action yellow
              behind the frame (an outline would be cut by the clip-path). */}
          {picked ? <span aria-hidden className="tile-bevel absolute -inset-[3px] bg-primary" /> : null}

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

          {/* Team slot, on the opposite corner. */}
          {pickNumber !== undefined ? (
            <span className="absolute -left-1.5 -top-2.5 z-20 border-2 border-border bg-primary px-1.5 py-0.5 font-body text-label font-bold leading-none tabular-nums text-primary-foreground">
              {pickNumber}
            </span>
          ) : null}

          {plateText ? (
            <span
              className={cn(
                "ink-skew absolute -bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap border-2 px-2 pt-0.5 font-heading text-sm leading-none tracking-title",
                plateTone === "highlight"
                  ? "border-border bg-primary text-primary-foreground"
                  : "border-(color:--el) bg-card-foreground text-(--el)",
              )}
            >
              {plateText}
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
        </>
      )}
    </span>
  );
}

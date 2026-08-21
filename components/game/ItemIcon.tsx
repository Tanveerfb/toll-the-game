import React from "react";
import Image from "next/image";

import { getCharacterArt } from "@/lib/game/characterArt";
import { getCoinFrameArt, getMaterialArt } from "@/lib/game/materialArt";
import { characterIdFromCoin, isCharacterCoin, materialLabel } from "@/lib/game/materials";

/**
 * The one place a material, a currency or a character coin turns into a picture.
 *
 * `lib/game/materialArt.ts` shipped with the icons on 2026-08-20 and had **zero
 * callers** — the art existed on disk, the registry resolved it, and every
 * inventory surface still rendered the text label. This component is the wiring,
 * and it is deliberately a single component rather than an `<Image>` per screen:
 * icons land one at a time, so the fallback has to be handled once, not eight
 * times.
 *
 * Three cases, in the order they are tried:
 *
 *  1. **A character coin** — no icon of its own and never will have one, since
 *     there is one coin per playable character. Drawn as the character's portrait
 *     clipped to a circle with the element-coloured frame over it, which is what
 *     `getCoinFrameArt` exists for (five frames cover every coin there will be).
 *  2. **A registered material** — the icon from `public/items/`.
 *  3. **Neither** — `fallback`, or nothing. A caller that passes a lucide icon
 *     keeps exactly the look it had before the art landed, which is why this can
 *     be dropped into a screen without waiting for the icon set to be complete.
 */

export default function ItemIcon({
  id,
  size = 24,
  className,
  fallback,
  alt,
}: {
  /** A material id, a currency id (`gems`, `coin`, `stamina`, …) or a coin id. */
  id: string;
  /** Rendered box, in px. Square. */
  size?: number;
  className?: string;
  /** Drawn when no art resolves — usually the lucide icon the screen used to
   *  carry. Sized by the caller. */
  fallback?: React.ReactNode;
  /** Defaults to the material's own label; pass `""` for a decorative icon that
   *  sits next to its own name already. */
  alt?: string;
}): React.JSX.Element | null {
  const label = alt ?? materialLabel(id);
  const box = { width: size, height: size };

  if (isCharacterCoin(id)) {
    const characterId = characterIdFromCoin(id);
    const portrait = characterId ? getCharacterArt(characterId) : null;
    // `{color}_{id}_coin` — the colour is the first segment by construction
    // (`characterCoinId`), so the frame comes free with the id.
    const frame = getCoinFrameArt(id.split("_")[0]);
    if (frame) {
      return (
        <span
          className={`relative inline-block shrink-0 ${className ?? ""}`}
          style={box}
        >
          {portrait ? (
            // Inset so the portrait sits inside the ring rather than under its
            // edge, and top-anchored because these are 1024² character cards —
            // centring one crops the face out.
            <span className="absolute inset-[14%] overflow-hidden rounded-full">
              <Image
                src={portrait}
                alt=""
                fill
                sizes={`${size}px`}
                className="object-cover object-top"
              />
            </span>
          ) : null}
          <Image
            src={frame}
            alt={label}
            fill
            sizes={`${size}px`}
            className="object-contain"
          />
        </span>
      );
    }
  }

  const art = getMaterialArt(id);
  if (art) {
    return (
      <Image
        src={art}
        alt={label}
        width={size}
        height={size}
        className={`shrink-0 ${className ?? ""}`}
        style={box}
      />
    );
  }

  return fallback ? <>{fallback}</> : null;
}

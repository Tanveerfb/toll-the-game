"use client";

import React from "react";
import Image from "next/image";
import { getCharacterArt } from "@/lib/game/characterArt";

/**
 * The account's display picture: a chosen character portrait, or the first
 * letter of the display name when none is set.
 *
 * There is no image upload — the app has no storage bucket, and one exists to
 * be provisioned before "upload a photo" is a real option. Picking from the
 * roster is the version that works today, and it's the one every game in this
 * genre ships anyway.
 */
export default function PlayerAvatar({
  characterId,
  fallback,
  size,
  className = "",
}: {
  characterId: string | null;
  /** Shown when no portrait is chosen — normally the display name. */
  fallback: string;
  size: number;
  className?: string;
}): React.JSX.Element {
  const art = characterId ? getCharacterArt(characterId) : null;
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-edge-strong bg-panel ${className}`}
      style={{ width: size, height: size }}
    >
      {art ? (
        <Image
          src={art}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover object-top"
        />
      ) : (
        <span
          className="font-heading text-readout-strong"
          style={{ fontSize: Math.round(size * 0.48) }}
        >
          {(fallback.trim().charAt(0) || "G").toUpperCase()}
        </span>
      )}
    </span>
  );
}

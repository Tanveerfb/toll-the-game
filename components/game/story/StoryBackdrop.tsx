"use client";

import * as React from "react";
import { getStoryBackground } from "@/lib/game/storyBackgrounds";

/**
 * The layer a scene plays over.
 *
 * Renders the plate once one exists and a tinted gradient until then — see
 * `lib/game/storyBackgrounds.ts` for why the fallback is a first-class state
 * rather than a placeholder to be replaced later.
 *
 * Always sits behind everything (`-z-0` inside a `relative` parent) and is
 * `aria-hidden`: the words carry the scene, the picture sets the place.
 */
export default function StoryBackdrop({
  slug,
  /** Dim the whole layer — used behind a text-heavy narration beat so the
   *  letterboxed prose keeps its contrast. */
  dim = false,
}: {
  slug?: string;
  dim?: boolean;
}): React.JSX.Element {
  const background = getStoryBackground(slug);
  const [from, to] = background.tint;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {background.image ? (
        /* A full-bleed decorative plate, sized by CSS rather than by the layout;
           next/image would add a wrapper and a layout pass for no benefit, and the
           plate is a local asset with known dimensions. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={background.image} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="h-full w-full"
          style={{ backgroundImage: `linear-gradient(180deg, ${from}, ${to})` }}
        />
      )}
      {/* The 44px terminal ground, faint, so a fallback backdrop still belongs to
          the same art direction as the rest of the game. */}
      <div className="terminal-grid absolute inset-0 opacity-40" />
      <div
        className={`absolute inset-0 bg-void transition-opacity duration-500 ${
          dim ? "opacity-60" : "opacity-25"
        }`}
      />
    </div>
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The page shell every screen renders into.
 *
 * Measured 2026-09-17: **eight spellings of three shapes** across the app.
 * Two of those eight were the *same CSS in a different word order* —
 * `terminal-grid screen-below-nav relative flex flex-col` and
 * `terminal-grid relative flex screen-below-nav flex-col` — which nothing
 * catches and nothing ever will by eye. The rest differed in ways that were
 * not decisions either: a `min-` prefix here, a `px-4` there.
 *
 * Three variants, because three page shapes actually exist:
 *
 * - **`scroll`** (the default) — one vertical scroll, tab bar cleared. Boards,
 *   lists, briefs, documents.
 * - **`center`** — a single panel centred in the viewport. Results,
 *   confirmations, empty states.
 * - **`fixed`** — full height, no page scroll. The battle screen's shape.
 *   Kept so battle can adopt this without inventing a fourth variant; it is
 *   the reason `screen-below-nav` (exact height) exists alongside
 *   `min-screen-below-nav` (floor).
 *
 * **Width is chosen by what the content is, not per screen** — see the
 * `--container-*` tokens in `styles/globals.css`. A screen that wants a width
 * outside `read` / `app` / `panel` is a screen deciding it is special, which
 * is the drift this component exists to stop.
 *
 * The 16px side gutter at 390px is this component's job, not each panel's
 * (ruling #107), so `px-4` lives here once and nowhere else.
 *
 * Precedent: `components/game/story/StoryStage.tsx` has done exactly this for
 * story since story mode v2, with `variant="page" | "stage"`. This generalises
 * that rather than inventing it.
 */
const screenVariants = cva("terminal-grid bg-void", {
  variants: {
    variant: {
      scroll: "min-screen-below-nav",
      center: "flex min-screen-below-nav items-center justify-center",
      /**
       * `screen-below-nav` is an exact height, not a floor, so the page
       * itself never scrolls and any overflow scrolls inside a child.
       */
      fixed:
        "screen-below-nav relative flex flex-col overflow-hidden text-readout",
    },
  },
  defaultVariants: { variant: "scroll" },
});

/** Maps a content kind to its `--container-*` token. */
const widthClass = {
  /** Prose and documents — kit pages, news posts, patch notes. */
  read: "max-w-read",
  /** Boards and lists — events, archive, story, gacha. */
  app: "max-w-app",
  /** One focused panel — results, confirmations. */
  panel: "max-w-panel",
  /** Opts out of the inner section entirely: the child owns the full area. */
  none: null,
} as const;

export type ScreenWidth = keyof typeof widthClass;

export interface ScreenProps
  extends React.ComponentProps<"main">,
    VariantProps<typeof screenVariants> {
  /**
   * What kind of content this is. Anything but `none` wraps the children in a
   * centred, gutter-padded column at that width.
   *
   * `none` is for a screen whose child already fills the viewport — the battle
   * arena, a full-bleed stage backdrop.
   */
  width?: ScreenWidth;
  /** Extra classes for the inner column. Ignored when `width="none"`. */
  contentClassName?: string;
}

export function Screen({
  variant,
  width = "app",
  className,
  contentClassName,
  children,
  ...props
}: ScreenProps): React.JSX.Element {
  const inner = widthClass[width];
  return (
    <main className={cn(screenVariants({ variant }), className)} {...props}>
      {inner === null ? (
        children
      ) : (
        <section
          className={cn(
            // `w-full` before the cap so the column fills a 390px phone and
            // only narrows once the viewport passes the token.
            "mx-auto flex w-full flex-col gap-3 px-4 py-6 md:px-8",
            inner,
            contentClassName,
          )}
        >
          {children}
        </section>
      )}
    </main>
  );
}

export { screenVariants };

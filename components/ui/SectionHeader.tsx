import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The eyebrow-plus-title block that opens nearly every screen and panel.
 *
 * Audit finding L6, 2026-09-17: retyped everywhere, and it is where roughly
 * half of the app's 364 letter-spacing usages lived before the three
 * `--tracking-*` tokens landed. The pattern is always the same two lines — a
 * small uppercase label above a heading-font title — and the only real
 * variation is how loud it is.
 *
 * Three sizes, matching the three places it appears:
 *
 * - **`page`** — a screen's own `<h1>`, on the ground. Shōnen Ink's loud
 *   treatment (ruling #154): the title is a skewed paper label on a yellow
 *   slab, the eyebrow action yellow. A header is exactly where the motif says
 *   the loudness goes.
 * - **`section`** — a section of a page, on the ground: the same skewed paper
 *   label as `page`, one step smaller, as an `<h2>` (the kit document's
 *   "Skills" and "Passive", 2026-09-26).
 * - **`panel`** — the title inside a results or confirmation panel.
 * - **`block`** — the muted, underlined strip above a group of rows.
 *
 * **`panel` and `block` take their colour from the surface they sit on**
 * (`currentColor`), because they live inside panels, and panels migrate to
 * paper screen by screen. A fixed colour would be right on one side of that
 * migration and unreadable on the other.
 */
export type SectionHeaderSize = "page" | "section" | "panel" | "block";

const eyebrowClass: Record<SectionHeaderSize, string> = {
  page: "block font-body text-label font-bold uppercase tracking-eyebrow text-primary",
  section: "block font-body text-label font-bold uppercase tracking-eyebrow text-primary",
  panel: "font-body text-label font-bold uppercase tracking-eyebrow opacity-70",
  block: "font-body text-label font-bold uppercase tracking-eyebrow opacity-60",
};

const titleClass: Record<SectionHeaderSize, string> = {
  page: "ink-skew mt-1.5 inline-block bg-card px-2.5 pt-1 font-heading text-3xl leading-none tracking-label text-card-foreground ink-slab-primary md:text-4xl",
  section:
    "ink-skew mt-1 inline-block bg-card px-2 pt-1 font-heading text-xl leading-none tracking-title text-card-foreground ink-slab-primary",
  panel: "font-heading text-2xl tracking-title",
  /** `block` has no separate title line — the eyebrow IS the label. */
  block: "",
};

export interface SectionHeaderProps
  extends Omit<React.ComponentProps<"div">, "title"> {
  /** The small uppercase line. Optional: a title may stand alone. */
  eyebrow?: React.ReactNode;
  /** The heading. Omitted on `block`, where the eyebrow is the whole header. */
  title?: React.ReactNode;
  size?: SectionHeaderSize;
  /**
   * A line under the eyebrow, for the `block` size sitting above rows. It is
   * the hairline the reward and difficulty panels already draw by hand.
   */
  rule?: boolean;
  /**
   * `highlight` sets the eyebrow on an `el-light` fill — for a block that has
   * to read as separate from the one below it, the way a one-off first-clear
   * bundle must not blend into the farmable table beneath it. A fill with ink
   * on it, not gold text, because an element hue is never text on paper.
   */
  tone?: "default" | "highlight";
  /** Anything below the title — a stat line, a subtitle. */
  children?: React.ReactNode;
}

export function SectionHeader({
  eyebrow,
  title,
  size = "page",
  rule = false,
  tone = "default",
  className,
  children,
  ...props
}: SectionHeaderProps): React.JSX.Element {
  const heading = size === "page" ? "h1" : size === "section" ? "h2" : "p";
  return (
    <div
      className={cn(
        rule && "mb-2 border-b border-current/25 pb-1.5",
        className,
      )}
      {...props}
    >
      {eyebrow ? (
        <span
          className={cn(
            eyebrowClass[size],
            tone === "highlight" &&
              "bg-el-light px-1 text-card-foreground opacity-100",
          )}
        >
          {eyebrow}
        </span>
      ) : null}
      {title && titleClass[size]
        ? React.createElement(heading, { className: titleClass[size] }, title)
        : null}
      {children}
    </div>
  );
}

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
 * - **`page`** — a screen's own `<h1>`, with the signal rule down its left.
 * - **`panel`** — the title inside a results or confirmation panel.
 * - **`block`** — the muted, underlined strip above a group of rows.
 */
export type SectionHeaderSize = "page" | "panel" | "block";

const eyebrowClass: Record<SectionHeaderSize, string> = {
  page: "block font-body text-[10px] font-bold uppercase tracking-eyebrow text-signal",
  panel:
    "font-body text-[10px] font-bold uppercase tracking-eyebrow text-signal",
  block:
    "font-body text-[9px] font-bold uppercase tracking-eyebrow text-readout-muted",
};

const titleClass: Record<SectionHeaderSize, string> = {
  page: "font-heading text-3xl leading-none tracking-label text-readout md:text-4xl",
  panel: "font-heading text-2xl tracking-title text-readout-strong",
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
   * `highlight` recolours the eyebrow to `el-light` — for a block that has to
   * read as separate from the one below it, the way a one-off first-clear
   * bundle must not blend into the farmable table beneath it.
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
  const heading = size === "page" ? "h1" : "p";
  return (
    <div
      className={cn(
        // The left rule is what makes a page header read as the page's own,
        // rather than as the first panel in the list below it.
        size === "page" && "border-l-2 border-signal pl-3",
        rule && "mb-2 border-b border-hairline pb-1.5",
        className,
      )}
      {...props}
    >
      {eyebrow ? (
        <span
          className={cn(
            eyebrowClass[size],
            tone === "highlight" && "text-el-light",
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

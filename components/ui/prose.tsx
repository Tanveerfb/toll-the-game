import type { ReactNode } from "react";

/**
 * Document typography, shared by the MDX news posts and the archive character
 * pages.
 *
 * These styles used to live only in `mdx-components.tsx`. The archive page
 * rendered the same kind of information — headings, tables, bullet lists —
 * through nested bordered `<Card>`s instead, so `/news` read like a document
 * and `/archive/[id]` read like a stack of boxes. Both now consume this, which
 * is what makes them actually match rather than approximately match.
 *
 * Plain exported classnames + small components rather than a CSS file: MDX
 * needs component overrides, the archive page needs the same look on ordinary
 * JSX, and Tailwind needs the literal class strings to survive its scan.
 *
 * **Surface-agnostic** (Shōnen Ink, ruling #154, 2026-09-26). No colour is set
 * here: text takes its surface's colour, secondary text is that colour at
 * reduced opacity, and rules are drawn in `currentColor`. The archive's kit
 * document is a paper sheet and the news posts still sit on the dark ground,
 * and both read correctly from the same classes.
 */
export const PROSE = {
  /** Section heading — a heavy rule on the left, in the heading's own colour. */
  h2: "mt-6 mb-2.5 border-l-4 border-current pl-2.5 font-heading text-lg leading-none tracking-title",
  /** Sub-heading inside a section. */
  h3: "mt-4 mb-1.5 font-body text-caption font-bold uppercase tracking-eyebrow opacity-70",
  p: "font-body text-sm leading-relaxed",
  ul: "list-disc space-y-1.5 pl-5 font-body text-sm leading-relaxed",
  table: "mt-1.5 w-full border-collapse font-body text-sm",
  th: "border-b-2 border-current/40 px-2 py-1 text-left text-label font-bold uppercase tracking-label",
  td: "border-b border-current/15 px-2 py-1.5 align-top",
  /** Muted note under a heading — source, scope, caveat. */
  note: "font-body text-caption font-bold uppercase tracking-label opacity-70",
} as const;

/**
 * A document section: a ruled heading with an optional right-aligned note,
 * then content. Replaces the archive page's bordered `Section` card.
 */
export function ProseSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <section>
      <div className="mt-6 mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-l-4 border-current pl-2.5">
        <h2 className="font-heading text-lg leading-none tracking-title">
          {title}
        </h2>
        {note ? <span className={PROSE.note}>{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** Horizontally scrollable table wrapper — rank tables get wide on mobile. */
export function ProseTable({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="overflow-x-auto">
      <table className={PROSE.table}>{children}</table>
    </div>
  );
}

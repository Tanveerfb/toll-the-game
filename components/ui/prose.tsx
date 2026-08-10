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
 */
export const PROSE = {
  /** Section heading — signal rule on the left, small caps. */
  h2: "mt-6 mb-2.5 border-l-2 border-signal pl-2.5 font-body text-[13px] font-bold uppercase tracking-[0.2em] text-signal",
  /** Sub-heading inside a section. */
  h3: "mt-4 mb-1.5 font-body text-[11px] font-bold uppercase tracking-[0.22em] text-readout-dim",
  p: "font-body text-sm leading-relaxed text-readout",
  ul: "list-disc space-y-1.5 pl-5 font-body text-sm leading-relaxed text-readout",
  table: "mt-1.5 w-full border-collapse font-body text-[13px]",
  th: "border-b border-edge px-2 py-1 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-readout-muted",
  td: "border-b border-hairline px-2 py-1.5 align-top text-readout",
  /** Muted note under a heading — source, scope, caveat. */
  note: "font-body text-[11px] font-bold uppercase tracking-[0.18em] text-readout-muted",
} as const;

/**
 * A document section: a signal-ruled heading with an optional right-aligned
 * note, then content. Replaces the archive page's bordered `Section` card.
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
      <div className="mt-6 mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-l-2 border-signal pl-2.5">
        <h2 className="font-body text-[13px] font-bold uppercase tracking-[0.2em] text-signal">
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

import Link from "next/link";
import type { ReactNode } from "react";
import type { NewsFeedEntry, NewsKind } from "@/lib/news/feed";

interface NewsPostLayoutProps {
  title: string;
  date: string;
  /** The frontmatter summary, set as a standfirst above the body. */
  summary?: string;
  kind: NewsKind;
  readingMinutes: number;
  /** The post one step further back in the merged stream, if any. */
  older?: NewsFeedEntry | null;
  /** The post one step forward. Null on the newest post. */
  newer?: NewsFeedEntry | null;
  children: ReactNode;
}

const KIND_LABEL: Record<NewsKind, string> = {
  update: "Update",
  notice: "Notice",
};
const KIND_TONE: Record<NewsKind, string> = {
  update: "border-el-blue/45 text-el-blue",
  notice: "border-role-ultimate/45 text-role-ultimate",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-08-09" → "9 Aug 2026", formatted from the string parts. Passing this
 *  through `Date` would parse as UTC midnight and format in local time, which
 *  renders the 1st as the 31st for anyone west of Greenwich. */
function formatDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return date;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

function StepLink({
  entry,
  direction,
}: {
  entry: NewsFeedEntry;
  direction: "older" | "newer";
}): ReactNode {
  return (
    <Link
      href={entry.href}
      className={`chamfer group block border border-edge bg-panel px-3 py-2.5 transition-colors hover:border-edge-strong ${
        direction === "newer" ? "text-right" : ""
      }`}
    >
      <span className="block font-body text-[10px] font-bold uppercase tracking-[0.2em] text-readout-muted">
        {direction === "older" ? "← Older" : "Newer →"}
      </span>
      <span className="mt-0.5 block font-heading text-lg tracking-[0.04em] text-readout-strong transition-colors group-hover:text-signal">
        {entry.title}
      </span>
    </Link>
  );
}

export default function NewsPostLayout({
  title,
  date,
  summary,
  kind,
  readingMinutes,
  older,
  newer,
  children,
}: NewsPostLayoutProps) {
  return (
    <main className="terminal-grid min-h-screen bg-void">
      <div className="mx-auto w-full max-w-2xl px-6 py-8">
        <Link
          href="/news"
          className="chamfer inline-block border border-edge px-3 py-2 font-body text-[11px] font-bold uppercase tracking-[0.2em] text-readout-dim transition-colors hover:border-edge-strong hover:text-signal"
        >
          ← News
        </Link>

        <header className="mt-4 border-l-2 border-signal pl-3">
          <span
            className={`inline-block border px-1.5 py-px font-body text-[9px] font-bold uppercase tracking-[0.16em] ${KIND_TONE[kind]}`}
          >
            {KIND_LABEL[kind]}
          </span>
          <h1 className="mt-1.5 font-heading text-4xl leading-none tracking-[0.06em] text-readout-strong">
            {title}
          </h1>
          <p className="mt-1.5 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-readout-muted">
            {formatDate(date)}
            <span className="mx-2 text-edge-strong">·</span>
            {readingMinutes} min read
          </p>
        </header>

        {/* The summary already exists in frontmatter and was only ever shown on
            the feed. Set at reading size here, the post opens by saying what
            it's about instead of starting mid-argument. */}
        {summary ? (
          <p className="mt-4 border-b border-hairline pb-4 font-body text-[17px] leading-relaxed text-readout">
            {summary}
          </p>
        ) : null}

        <div className="mt-2">{children}</div>

        {older || newer ? (
          <nav
            aria-label="Nearby posts"
            className="mt-8 grid gap-2.5 border-t border-hairline pt-4 sm:grid-cols-2"
          >
            {older ? <StepLink entry={older} direction="older" /> : <span />}
            {newer ? <StepLink entry={newer} direction="newer" /> : null}
          </nav>
        ) : null}
      </div>
    </main>
  );
}

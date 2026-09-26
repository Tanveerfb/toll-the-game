import Link from "next/link";
import type { ReactNode } from "react";
import NewsKindBadge from "@/components/news/NewsKindBadge";
import { buttonVariants } from "@/components/ui/button";
import { panelVariants } from "@/components/ui/Panel";
import { Screen } from "@/components/ui/Screen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { NewsFeedEntry, NewsKind } from "@/lib/news/feed";
import { cn } from "@/lib/utils";

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
      className={cn(
        panelVariants({ surface: "paper", density: "tight", press: true }),
        "block",
        direction === "newer" && "text-right",
      )}
    >
      <span className="block font-body text-label font-bold uppercase tracking-eyebrow text-muted-foreground">
        {direction === "older" ? "← Older" : "Newer →"}
      </span>
      <span className="mt-0.5 block font-heading text-lg tracking-title">
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
    // Same migration as the index: `--container-read` is 42rem, exactly the
    // `max-w-2xl` this already used, so the width does not move - what goes is
    // a hand-typed shell and the app's only `px-6` gutter.
    // `gap-0`: a post sets its own vertical rhythm with `mt-*` on each block,
    // so Screen's default `gap-3` would compound with it rather than replace
    // it. The index takes the default, because it has no rhythm of its own.
    <Screen width="read" contentClassName="gap-0">
      <Link
        href="/news"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start")}
      >
        ← News
      </Link>

      <header className="mt-4 flex flex-col items-start gap-2">
        <NewsKindBadge kind={kind} />
        <SectionHeader title={title}>
          <p className="mt-2 font-body text-caption font-bold uppercase tracking-label text-ground-dim">
            {formatDate(date)}
            <span className="mx-2">·</span>
            {readingMinutes} min read
          </p>
        </SectionHeader>
      </header>

      {/* The post is read on one paper sheet, like the archive's kit
          document (ruling #154); `prose.tsx` takes the sheet's ink. */}
      <article
        className={cn(
          panelVariants({ surface: "paper", density: "none", lift: "slab" }),
          "mt-5 px-4 pb-5 pt-4 md:px-6",
        )}
      >
        {/* The summary already exists in frontmatter and was only ever shown
            on the feed. Set at reading size here, the post opens by saying
            what it's about instead of starting mid-argument. */}
        {summary ? (
          <p className="border-b border-rule pb-4 font-body text-lg leading-relaxed">
            {summary}
          </p>
        ) : null}

        <div className="mt-2">{children}</div>
      </article>

      {older || newer ? (
        <nav
          aria-label="Nearby posts"
          className="mt-8 grid grid-cols-1 gap-2.5 border-t-2 border-ground-line pt-4 sm:grid-cols-2"
        >
          {older ? <StepLink entry={older} direction="older" /> : <span />}
          {newer ? <StepLink entry={newer} direction="newer" /> : null}
        </nav>
      ) : null}
    </Screen>
  );
}

import { sortByDateDesc } from "@/lib/news/sortByDateDesc";
import type { NewsPostSummary } from "@/lib/news/posts";
import { pageWindow, paginate, type Page } from "@/lib/pagination";

/**
 * Feed shaping for /news — merging and month grouping, kept pure so the
 * arithmetic is unit-testable and the component stays presentational.
 * Pagination itself lives in `lib/pagination.ts`, shared with the story
 * chapter select; this module only re-exports it so news callers keep one
 * import.
 *
 * The page used to be two tabs over two lists. `content/news/notices/` holds
 * nothing but `_placeholder.mdx` (which exists only so Turbopack's dynamic
 * import resolves), so half that control did nothing but reveal an empty list.
 * One stream with a kind tag replaces it: a notice appears inline the day it's
 * written, and the filter row only shows up once both kinds actually exist.
 */

export type NewsKind = "update" | "notice";

export interface NewsFeedEntry extends NewsPostSummary {
  kind: NewsKind;
  /** Route for this entry — the two kinds live under different segments. */
  href: string;
}

export interface NewsMonthGroup {
  /** "2026-08" — stable key, also what the ordering relies on. */
  key: string;
  /** "August 2026" — display label. */
  label: string;
  items: NewsFeedEntry[];
}

/** 15 entries fills a screen twice over without making the month rules
 *  meaningless. Below this the pagination controls don't render at all. */
export const NEWS_PAGE_SIZE = 15;

// Dates are plain "YYYY-MM-DD" strings, never Date objects: `new Date("2026-08-01")`
// parses as UTC midnight and then formats in local time, which renders a 1st
// as the 31st for anyone west of Greenwich.
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-08" → "August 2026". Returns the raw key if it isn't a month. */
export function monthLabel(key: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return key;
  const name = MONTH_NAMES[Number(match[2]) - 1];
  return name ? `${name} ${match[1]}` : key;
}

/** The day-of-month, unpadded — it sets large in the row's left gutter. */
export function dayOfMonth(date: string): string {
  const day = date.slice(8, 10);
  return day.replace(/^0/, "") || date;
}

/** Merges both kinds into one newest-first stream. */
export function buildFeed(
  updates: NewsPostSummary[],
  notices: NewsPostSummary[],
): NewsFeedEntry[] {
  const tag = (posts: NewsPostSummary[], kind: NewsKind): NewsFeedEntry[] =>
    posts.map((post) => ({
      ...post,
      kind,
      href: `/news/${kind === "update" ? "updates" : "notices"}/${post.slug}`,
    }));
  return sortByDateDesc([...tag(updates, "update"), ...tag(notices, "notice")]);
}

/** Consecutive runs sharing a year-month. Input must already be sorted. */
export function groupByMonth(entries: NewsFeedEntry[]): NewsMonthGroup[] {
  const groups: NewsMonthGroup[] = [];
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(entry);
    else groups.push({ key, label: monthLabel(key), items: [entry] });
  }
  return groups;
}

/**
 * Rough reading time in whole minutes, floored at 1.
 *
 * Counts words in the MDX body: the `export const metadata = { … }` block is
 * dropped (it's frontmatter, not prose) along with JSX tags and markdown
 * punctuation, so a post isn't credited for its own syntax. 200 wpm is the
 * usual figure for screen reading of ordinary prose.
 */
export function estimateReadingMinutes(source: string): number {
  const prose = source
    .replace(/export const metadata\s*=\s*\{[\s\S]*?\n\};/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>|[\]()~-]/g, " ");
  const words = prose.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export type NewsPage = Page<NewsFeedEntry>;

/** Thin wrapper over the shared helper, only so callers keep the news default
 *  page size without repeating it. */
export function paginateFeed(
  entries: NewsFeedEntry[],
  page: number,
  pageSize: number = NEWS_PAGE_SIZE,
): NewsPage {
  return paginate(entries, page, pageSize);
}

export { pageWindow, paginate };

import fs from "node:fs";
import path from "node:path";
import { sortByDateDesc } from "@/lib/news/sortByDateDesc";
import {
  buildFeed,
  estimateReadingMinutes,
  type NewsFeedEntry,
  type NewsKind,
} from "@/lib/news/feed";

export interface NewsPostSummary {
  slug: string;
  title: string;
  date: string;
  summary: string;
}

export interface NewsPostMetadata {
  title: string;
  date: string;
  summary: string;
}

const UPDATES_DIR = path.join(process.cwd(), "content", "news", "updates");
const NOTICES_DIR = path.join(process.cwd(), "content", "news", "notices");

function listSlugs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    // Leading-underscore files (e.g. notices/_placeholder.mdx) are excluded
    // from listings — see that file's header comment for why it exists:
    // Turbopack's dynamic import(`.../${slug}.mdx`) glob needs at least one
    // real .mdx file on disk to resolve, even when a directory has zero
    // real posts, so an empty directory alone fails the production build.
    .filter((file) => file.endsWith(".mdx") && !file.startsWith("_"))
    .map((file) => file.replace(/\.mdx$/, ""));
}

// The import() paths below use a static "@/content/news/<dir>/" prefix with
// only the trailing slug interpolated — that's the exact shape Next.js's
// webpack bundler needs to statically discover and include every matching
// .mdx file. A fully dynamic path (e.g. building the directory from a
// variable too) can't be analyzed this way and will fail at runtime.

export async function getAllUpdates(): Promise<NewsPostSummary[]> {
  const slugs = listSlugs(UPDATES_DIR);
  const posts = await Promise.all(
    slugs.map(async (slug) => {
      const mod = (await import(`@/content/news/updates/${slug}.mdx`)) as {
        metadata: NewsPostMetadata;
      };
      return { slug, ...mod.metadata };
    })
  );
  return sortByDateDesc(posts);
}

export async function getAllNotices(): Promise<NewsPostSummary[]> {
  const slugs = listSlugs(NOTICES_DIR);
  const posts = await Promise.all(
    slugs.map(async (slug) => {
      const mod = (await import(`@/content/news/notices/${slug}.mdx`)) as {
        metadata: NewsPostMetadata;
      };
      return { slug, ...mod.metadata };
    })
  );
  return sortByDateDesc(posts);
}

export function listUpdateSlugs(): string[] {
  return listSlugs(UPDATES_DIR);
}

export function listNoticeSlugs(): string[] {
  return listSlugs(NOTICES_DIR);
}

/**
 * Everything the post page needs beyond the MDX itself: how long it reads,
 * and where it sits in the stream.
 *
 * Adjacency runs over the MERGED feed, not just the post's own kind, so
 * walking prev/next follows the same chronology the /news list shows. The feed
 * is newest-first, so the older post is the next index along.
 */
export async function getPostContext(
  kind: NewsKind,
  slug: string,
): Promise<{
  readingMinutes: number;
  older: NewsFeedEntry | null;
  newer: NewsFeedEntry | null;
}> {
  const dir = kind === "update" ? UPDATES_DIR : NOTICES_DIR;
  const source = fs.readFileSync(path.join(dir, `${slug}.mdx`), "utf8");

  const [updates, notices] = await Promise.all([
    getAllUpdates(),
    getAllNotices(),
  ]);
  const feed = buildFeed(updates, notices);
  const index = feed.findIndex((e) => e.kind === kind && e.slug === slug);

  return {
    readingMinutes: estimateReadingMinutes(source),
    older: index >= 0 ? (feed[index + 1] ?? null) : null,
    newer: index > 0 ? (feed[index - 1] ?? null) : null,
  };
}

export async function getLatestNewsDate(): Promise<string | null> {
  const [updates, notices] = await Promise.all([getAllUpdates(), getAllNotices()]);
  const all = sortByDateDesc([...updates, ...notices]);
  return all[0]?.date ?? null;
}

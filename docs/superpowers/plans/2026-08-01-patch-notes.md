# Patch Notes / News System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an in-game changelog (`/news`) authored as MDX files in the repo, plus World Boss and News buttons on the (not-yet-overhauled) homepage with a local unread badge.

**Architecture:** Two MDX content collections (`content/news/updates/`, `content/news/notices/`) compiled via `@next/mdx`. `lib/news/posts.ts` lists and loads them server-side (`fs.readdirSync` + Next's documented static-prefix dynamic `import()` pattern). `app/news/page.tsx` and the two `[slug]` detail routes are Server Components; the tabbed feed UI is a small Client Component. The homepage (`app/page.tsx`) splits into a thin async Server Component (fetches the latest post date) wrapping a new Client Component `components/HomeMenu.tsx` (today's `Home()` body, plus two new buttons), following the same split already used by `app/archive/[id]/page.tsx`.

**Tech Stack:** Next.js 16 App Router, `@next/mdx` + `remark-gfm`, Zustand (unrelated to this feature, no store changes), Vitest for the pure-logic units.

**Read before starting:** `docs/superpowers/specs/2026-08-01-patch-notes-design.md` (full design + approved visual mockups — accent-bar feed cards, amber-bordered detail sections).

**Testing note (read this before Task 4):** `lib/news/posts.ts` does real filesystem reads and dynamic MDX imports. Vitest (`vitest.config.ts`) has no MDX/webpack loader wired in, so dynamically importing a real `.mdx` file inside a `.test.ts` file will not compile. Per this project's existing convention (`lib/game/stamina.ts` etc. unit-test pure logic; UI/integration-heavy files like `app/world-boss/page.tsx` get verified via `npm run build` + live browser check instead — see `docs/superpowers/plans/2026-07-31-player-inventory-stamina-worldboss.md`), this plan keeps the filesystem/import-touching functions in `lib/news/posts.ts` untested by Vitest, and extracts the two genuinely pure pieces of logic (`sortByDateDesc`, `hasUnreadNews`) into their own tiny modules that ARE unit tested. The fs/import code is verified for real in Task 8 via `npm run build` (which actually compiles and prerenders every `/news` route) and a live browser pass.

---

### Task 1: Wire up `@next/mdx`

**Files:**
- Modify: `package.json` (new devDependencies)
- Modify: `next.config.ts`
- Create: `mdx-components.tsx` (repo root, next to `next.config.ts`)

- [ ] **Step 1: Install the MDX packages**

Run:
```bash
npm install @next/mdx @mdx-js/loader @mdx-js/react @types/mdx remark-gfm
```

- [ ] **Step 2: Wire `@next/mdx` into `next.config.ts`**

Replace the full contents of `next.config.ts` with:

```ts
import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  // Lets Next treat .md/.mdx files as importable modules (content/ dir here,
  // not routable pages — nothing under app/ uses these extensions).
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  experimental: {
    // components/ui/*.tsx import lucide-react barrel-style throughout;
    // this rewrites those to per-icon imports so the whole icon set doesn't
    // ship to the client.
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    // Character art URLs carry a cache-busting ?v=N (see lib/game/characterArt.ts).
    // Next 16 blocks query strings on local images unless allowed here.
    // search is omitted on purpose so ART_VERSION bumps don't require a config edit.
    localPatterns: [
      {
        pathname: "/characters/**",
      },
      {
        // NPC / enemy / boss art lives in public/npc/ (see characterArt.ts).
        pathname: "/npc/**",
      },
    ],
  },
};

const withMDX = createMDX({
  options: {
    // Next 16 defaults to Turbopack for both `next build` and `next dev`
    // (no `--webpack` flag anywhere in package.json's scripts), and
    // Turbopack loader options must be JSON-serializable — a live function
    // reference (e.g. `import remarkGfm from "remark-gfm"` passed directly)
    // can't cross the JS-to-Rust boundary. Plugins must be given as plain
    // strings (the package name) instead.
    remarkPlugins: ["remark-gfm"],
  },
});

export default withMDX(nextConfig);
```

- [ ] **Step 3: Create the global MDX component styling**

Create `mdx-components.tsx` at the repo root (same level as `next.config.ts` — required by `@next/mdx` for the App Router):

```tsx
import type { MDXComponents } from "mdx/types";

const components: MDXComponents = {
  h2: ({ children }) => (
    <h2 className="mt-6 mb-2.5 border-l-4 border-amber-500 pl-2.5 font-body text-[13px] font-bold uppercase tracking-[0.14em] text-amber-400">
      {children}
    </h2>
  ),
  p: ({ children }) => (
    <p className="font-body text-sm leading-relaxed text-zinc-300">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-1.5 pl-5 font-body text-sm leading-relaxed text-zinc-300">
      {children}
    </ul>
  ),
  table: ({ children }) => (
    <table className="mt-1.5 w-full border-collapse font-body text-[13px]">
      {children}
    </table>
  ),
  th: ({ children }) => (
    <th className="border-b border-zinc-700 px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-zinc-800 px-2 py-1.5 text-zinc-200">{children}</td>
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
```

- [ ] **Step 4: Verify the build still passes with no content yet**

Run: `npm run check`
Expected: PASS (tsc, eslint, and all existing vitest tests unaffected — no content files exist yet, this step only proves the MDX webpack config doesn't break the existing build).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json next.config.ts mdx-components.tsx
git commit -m "Wire up @next/mdx for the upcoming patch-notes system"
```

---

### Task 2: Pure helpers — date sorting and unread tracking

**Files:**
- Create: `lib/news/sortByDateDesc.ts`
- Create: `lib/news/readTracking.ts`
- Test: `tests/newsSorting.test.ts`
- Test: `tests/newsReadTracking.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/newsSorting.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sortByDateDesc } from "@/lib/news/sortByDateDesc";

describe("sortByDateDesc", () => {
  it("sorts ISO date strings newest first", () => {
    const items = [{ date: "2026-07-29" }, { date: "2026-08-01" }, { date: "2026-07-31" }];
    expect(sortByDateDesc(items).map((i) => i.date)).toEqual([
      "2026-08-01",
      "2026-07-31",
      "2026-07-29",
    ]);
  });

  it("does not mutate the input array", () => {
    const items = [{ date: "2026-07-29" }, { date: "2026-08-01" }];
    const original = [...items];
    sortByDateDesc(items);
    expect(items).toEqual(original);
  });

  it("returns an empty array unchanged", () => {
    expect(sortByDateDesc([])).toEqual([]);
  });

  it("preserves extra fields on each item", () => {
    const items = [{ date: "2026-07-29", title: "A" }, { date: "2026-08-01", title: "B" }];
    expect(sortByDateDesc(items)[0]).toEqual({ date: "2026-08-01", title: "B" });
  });
});
```

Create `tests/newsReadTracking.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hasUnreadNews } from "@/lib/news/readTracking";

describe("hasUnreadNews", () => {
  it("is unread when there is no last-viewed date", () => {
    expect(hasUnreadNews("2026-08-01", null)).toBe(true);
  });

  it("is unread when the latest post is newer than last viewed", () => {
    expect(hasUnreadNews("2026-08-01", "2026-07-29")).toBe(true);
  });

  it("is read when last viewed matches the latest post", () => {
    expect(hasUnreadNews("2026-08-01", "2026-08-01")).toBe(false);
  });

  it("is read when last viewed is newer (stale badge shouldn't re-trigger)", () => {
    expect(hasUnreadNews("2026-07-29", "2026-08-01")).toBe(false);
  });

  it("is never unread when there is no latest post at all", () => {
    expect(hasUnreadNews(null, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/newsSorting.test.ts tests/newsReadTracking.test.ts`
Expected: FAIL — `Cannot find module '@/lib/news/sortByDateDesc'` (and the readTracking equivalent).

- [ ] **Step 3: Implement `lib/news/sortByDateDesc.ts`**

```ts
export function sortByDateDesc<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.date === b.date) return 0;
    return a.date > b.date ? -1 : 1;
  });
}
```

- [ ] **Step 4: Implement `lib/news/readTracking.ts`**

```ts
const NEWS_LAST_VIEWED_KEY = "toll-news-last-viewed";

/** Pure comparison, safe to unit test — no localStorage access. */
export function hasUnreadNews(latestDate: string | null, lastViewed: string | null): boolean {
  if (!latestDate) return false;
  if (!lastViewed) return true;
  return latestDate > lastViewed;
}

export function getLastViewedNewsDate(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(NEWS_LAST_VIEWED_KEY);
}

export function markNewsViewed(latestDate: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NEWS_LAST_VIEWED_KEY, latestDate);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/newsSorting.test.ts tests/newsReadTracking.test.ts`
Expected: PASS (9 tests total).

- [ ] **Step 6: Commit**

```bash
git add lib/news/sortByDateDesc.ts lib/news/readTracking.ts tests/newsSorting.test.ts tests/newsReadTracking.test.ts
git commit -m "Add pure date-sorting and unread-tracking helpers for the news system"
```

---

### Task 3: Write the first real patch-notes entry

**Files:**
- Create: `content/news/updates/2026-07-31-world-boss-update.mdx`

This documents commits `15c6fb8` (player progression, stamina, world-boss loop) and `a702300` (mid-session cloud sync, profile redirect fix) — the actual first post, and the reference example for how future posts are structured.

- [ ] **Step 1: Create the content directory and file**

Create `content/news/updates/2026-07-31-world-boss-update.mdx`:

```mdx
export const metadata = {
  title: "World Boss Update",
  date: "2026-07-31",
  summary:
    "Character leveling, stamina, and the first world-boss encounter go live.",
};

Character leveling, stamina, and the first world-boss encounter go live —
plus every gameplay change now syncs to your account mid-session instead
of only at login.

## New Feature

- Character level & ascension progression, with a dedicated Profile page
- Stamina system (120 cap, regenerates over time)
- World Boss encounter: fight Molvarr for materials, Training Manuals, and coin

## Ascension Costs

| Band | Sea Monster's Eye | Corroded Sea Weed | Coin |
| --- | --- | --- | --- |
| 1 | 3 | 10 | 10,000 |
| 2 | 6 | 15 | 25,000 |
| 3 | 10 | 25 | 50,000 |

## Fixes

- Mid-session progress (stamina spends, leveling, ascending, world-boss
  rewards) now syncs to the cloud automatically — previously it only
  synced on next login
- Fixed a React warning on the Profile page caused by redirecting during
  render instead of after
```

- [ ] **Step 2: Sanity-check the file parses as valid MDX**

There's no automated test for content files (see the plan's testing note above) — this gets verified for real once Task 4-6 wire it into an actual page and Task 8 runs `npm run build`. For now, just confirm the file was saved with the `export const metadata = {...}` block first, followed by the Markdown body — that's the shape `@next/mdx` requires.

- [ ] **Step 3: Commit**

```bash
git add content/news/updates/2026-07-31-world-boss-update.mdx
git commit -m "Add the first patch-notes entry: World Boss Update"
```

---

### Task 4: `lib/news/posts.ts` — list and load posts

**Files:**
- Create: `lib/news/posts.ts`

No Vitest coverage on this file — see the plan's testing note at the top. Verified via Task 8's `npm run build` + live check.

- [ ] **Step 1: Implement the module**

Create `lib/news/posts.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { sortByDateDesc } from "@/lib/news/sortByDateDesc";

export interface NewsPostSummary {
  slug: string;
  title: string;
  date: string;
  summary: string;
}

interface NewsPostMetadata {
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
    .filter((file) => file.endsWith(".mdx"))
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

export async function getLatestNewsDate(): Promise<string | null> {
  const [updates, notices] = await Promise.all([getAllUpdates(), getAllNotices()]);
  const all = sortByDateDesc([...updates, ...notices]);
  return all[0]?.date ?? null;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. (This won't catch a broken dynamic import path at runtime — that's what Task 8's `npm run build` is for.)

- [ ] **Step 3: Commit**

```bash
git add lib/news/posts.ts
git commit -m "Add lib/news/posts.ts to list and load MDX patch-notes content"
```

---

### Task 5: Detail pages

**Files:**
- Create: `app/news/updates/[slug]/page.tsx`
- Create: `app/news/notices/[slug]/page.tsx`

Both follow the same `generateStaticParams` + `notFound()` pattern already used by `app/archive/[id]/page.tsx`. Layout matches the approved mockup: back-link, large title, "Updated on `<date>`" header, then the rendered MDX body (styling comes from the global `mdx-components.tsx`, nothing page-specific needed).

- [ ] **Step 1: Create the Updates detail page**

Create `app/news/updates/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { listUpdateSlugs } from "@/lib/news/posts";

interface UpdateDetailPageProps {
  params: Promise<{ slug: string }>;
}

interface NewsPostMetadata {
  title: string;
  date: string;
  summary: string;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return listUpdateSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = false;

export default async function UpdateDetailPage({ params }: UpdateDetailPageProps) {
  const { slug } = await params;

  if (!listUpdateSlugs().includes(slug)) {
    notFound();
  }

  const { default: Post, metadata } = (await import(
    `@/content/news/updates/${slug}.mdx`
  )) as {
    default: React.ComponentType;
    metadata: NewsPostMetadata;
  };

  return (
    <main className="relative min-h-screen bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link
          href="/news"
          className="font-body text-xs uppercase tracking-[0.16em] text-zinc-400 hover:text-amber-200"
        >
          ← Back to News
        </Link>
        <h1 className="mt-3 font-heading text-4xl tracking-[0.08em] text-zinc-100">
          {metadata.title}
        </h1>
        <p className="mt-1 border-b-2 border-zinc-800 pb-4 font-body text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          Updated on {metadata.date}
        </p>
        <div className="mt-4">
          <Post />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the Notices detail page**

Create `app/news/notices/[slug]/page.tsx` (identical shape, notices directory):

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { listNoticeSlugs } from "@/lib/news/posts";

interface NoticeDetailPageProps {
  params: Promise<{ slug: string }>;
}

interface NewsPostMetadata {
  title: string;
  date: string;
  summary: string;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return listNoticeSlugs().map((slug) => ({ slug }));
}

export const dynamicParams = false;

export default async function NoticeDetailPage({ params }: NoticeDetailPageProps) {
  const { slug } = await params;

  if (!listNoticeSlugs().includes(slug)) {
    notFound();
  }

  const { default: Post, metadata } = (await import(
    `@/content/news/notices/${slug}.mdx`
  )) as {
    default: React.ComponentType;
    metadata: NewsPostMetadata;
  };

  return (
    <main className="relative min-h-screen bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link
          href="/news"
          className="font-body text-xs uppercase tracking-[0.16em] text-zinc-400 hover:text-amber-200"
        >
          ← Back to News
        </Link>
        <h1 className="mt-3 font-heading text-4xl tracking-[0.08em] text-zinc-100">
          {metadata.title}
        </h1>
        <p className="mt-1 border-b-2 border-zinc-800 pb-4 font-body text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          Updated on {metadata.date}
        </p>
        <div className="mt-4">
          <Post />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/news/updates/[slug]/page.tsx" "app/news/notices/[slug]/page.tsx"
git commit -m "Add patch-notes detail pages for updates and notices"
```

---

### Task 6: Feed page with Updates/Notices tabs

**Files:**
- Create: `components/news/NewsFeedTabs.tsx`
- Create: `app/news/page.tsx`

Card style is the approved mockup Option A (left amber accent bar, title + date on one line, summary below), identical treatment for both tabs.

- [ ] **Step 1: Create the tabbed feed Client Component**

Create `components/news/NewsFeedTabs.tsx`:

```tsx
"use client";

import Link from "next/link";
import React from "react";
import type { NewsPostSummary } from "@/lib/news/posts";
import { markNewsViewed } from "@/lib/news/readTracking";

interface NewsFeedTabsProps {
  updates: NewsPostSummary[];
  notices: NewsPostSummary[];
  latestNewsDate: string | null;
}

type Tab = "updates" | "notices";

function FeedCard({ post, href }: { post: NewsPostSummary; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-stretch overflow-hidden border border-zinc-800 bg-black/40 transition-colors hover:border-amber-400/60"
    >
      <div className="w-1 shrink-0 bg-amber-500" />
      <div className="flex-1 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-heading text-lg tracking-[0.04em] text-zinc-100">
            {post.title}
          </h3>
          <span className="shrink-0 font-body text-[10px] uppercase tracking-[0.1em] text-zinc-500">
            {post.date}
          </span>
        </div>
        <p className="mt-1.5 font-body text-sm text-zinc-400">{post.summary}</p>
      </div>
    </Link>
  );
}

export default function NewsFeedTabs({ updates, notices, latestNewsDate }: NewsFeedTabsProps) {
  const [tab, setTab] = React.useState<Tab>("updates");

  React.useEffect(() => {
    if (latestNewsDate) markNewsViewed(latestNewsDate);
  }, [latestNewsDate]);

  const active = tab === "updates" ? updates : notices;
  const basePath = tab === "updates" ? "/news/updates" : "/news/notices";

  return (
    <div>
      <div className="mb-4 flex border-b-2 border-zinc-800">
        {(["updates", "notices"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-0.5 border-b-2 px-4 py-2 font-body text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
              tab === t
                ? "border-amber-400 text-amber-200"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "updates" ? "Updates" : "Notices"}
          </button>
        ))}
      </div>

      {active.length === 0 ? (
        <p className="font-body text-sm text-zinc-500">Nothing here yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {active.map((post) => (
            <FeedCard key={post.slug} post={post} href={`${basePath}/${post.slug}`} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the feed page**

Create `app/news/page.tsx`:

```tsx
import { getAllUpdates, getAllNotices, getLatestNewsDate } from "@/lib/news/posts";
import NewsFeedTabs from "@/components/news/NewsFeedTabs";

export default async function NewsPage() {
  const [updates, notices, latestNewsDate] = await Promise.all([
    getAllUpdates(),
    getAllNotices(),
    getLatestNewsDate(),
  ]);

  return (
    <main className="relative min-h-screen bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="mb-6 font-heading text-4xl tracking-[0.08em] text-zinc-100">News</h1>
        <NewsFeedTabs updates={updates} notices={notices} latestNewsDate={latestNewsDate} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/news/NewsFeedTabs.tsx app/news/page.tsx
git commit -m "Add the /news feed page with Updates/Notices tabs"
```

---

### Task 7: Homepage buttons + TopNav cleanup

**Files:**
- Create: `components/HomeMenu.tsx`
- Modify: `app/page.tsx` (full rewrite — becomes a thin Server Component)
- Modify: `components/ui/TopNav.tsx:6-13` (remove the World Boss entry)

- [ ] **Step 1: Create `components/HomeMenu.tsx`**

This is today's `app/page.tsx` `Home()` function body, moved as-is into a Client Component, plus a `latestNewsDate` prop and two new buttons (World Boss, News) inserted into the grid. The News button carries the unread badge; World Boss does not (it doesn't have its own read-tracking concept — only News does per the design).

Create `components/HomeMenu.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import React from "react";
import { useAuth } from "@/hooks/AuthProvider";
import { useGameStore } from "@/store/gameStore";
import { useRouter } from "next/navigation";
import BattleArena from "@/components/game/BattleArena";
import { getLastViewedNewsDate, hasUnreadNews } from "@/lib/news/readTracking";

interface HomeMenuProps {
  latestNewsDate: string | null;
}

export default function HomeMenu({ latestNewsDate }: HomeMenuProps) {
  const { user } = useAuth();
  const { battlePhase } = useGameStore();
  const router = useRouter();
  const [hasUnread, setHasUnread] = React.useState(false);

  React.useEffect(() => {
    setHasUnread(hasUnreadNews(latestNewsDate, getLastViewedNewsDate()));
  }, [latestNewsDate]);

  const authLabel = user ? "PROFILE" : "LOGIN";
  const authRoute = user ? "/profile" : "/login";

  if (battlePhase !== "initializing") {
    return <BattleArena />;
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-zinc-950"
      style={{
        backgroundImage:
          "radial-gradient(80% 45% at 85% 0%, rgba(245,158,11,0.18), transparent 72%), radial-gradient(65% 50% at 0% 100%, rgba(16,185,129,0.2), transparent 75%), linear-gradient(145deg, #09090b 0%, #111827 48%, #0a0a0a 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[40px_40px] opacity-25" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10 md:px-10">
        <Card className="w-full rounded-none border-2 border-zinc-700 bg-black/55 shadow-[0_24px_70px_rgba(0,0,0,0.55)] ring-0 backdrop-blur-sm">
          <CardHeader className="border-b border-zinc-700 px-6 py-6 md:px-10 md:py-8">
            <div>
              <p className="font-heading text-2xl tracking-[0.2em] text-zinc-300 md:text-3xl">
                TOLL THE GAME
              </p>
              <CardTitle className="mt-2 font-heading text-5xl tracking-[0.14em] text-zinc-100 md:text-7xl">
                MAIN MENU
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 px-6 py-6 md:grid-cols-2 md:gap-5 md:px-10 md:py-10">
            <Button
              variant="outline"
              onClick={() => router.push("/story")}
              className="h-20 justify-start rounded-none border-2 border-amber-300 bg-transparent px-8 font-heading text-2xl tracking-[0.14em] text-amber-200 transition-all hover:bg-amber-300/10 hover:text-amber-100 md:h-24 md:text-3xl"
            >
              MAIN STORY
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/archive")}
              className="h-20 justify-start rounded-none border-2 border-zinc-400 bg-transparent px-8 font-heading text-2xl tracking-[0.14em] text-zinc-100 transition-all hover:bg-zinc-100/5 md:h-24 md:text-3xl"
            >
              CHARACTER ARCHIVE
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/world-boss")}
              className="h-20 justify-start rounded-none border-2 border-red-400 bg-transparent px-8 font-heading text-2xl tracking-[0.14em] text-red-200 transition-all hover:bg-red-400/10 hover:text-red-100 md:h-24 md:text-3xl"
            >
              WORLD BOSS
            </Button>

            <Button
              onClick={() => router.push("/practice")}
              className="h-20 justify-start rounded-none border-2 border-amber-300 bg-[linear-gradient(90deg,#b45309_0%,#d97706_38%,#f59e0b_70%,#facc15_100%)] px-8 font-heading text-2xl tracking-[0.14em] text-zinc-950 shadow-[0_10px_30px_rgba(245,158,11,0.35)] transition-all hover:brightness-110 md:h-24 md:text-3xl"
            >
              PRACTICE
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/news")}
              className="relative h-20 justify-start rounded-none border-2 border-violet-400 bg-transparent px-8 font-heading text-2xl tracking-[0.14em] text-violet-200 transition-all hover:bg-violet-400/10 hover:text-violet-100 md:h-24 md:text-3xl"
            >
              NEWS
              {hasUnread ? (
                <span className="absolute -top-2 -right-2 rounded-none bg-amber-400 px-1.5 py-0.5 font-body text-[9px] font-black uppercase tracking-widest text-zinc-950">
                  New
                </span>
              ) : null}
            </Button>

            <Button
              variant="ghost"
              onClick={() => router.push(authRoute)}
              className="h-20 justify-start rounded-none border-2 border-sky-300 px-8 font-heading text-2xl tracking-[0.14em] text-sky-200 transition-all hover:bg-sky-300/10 hover:text-sky-100 md:h-24 md:text-3xl"
            >
              {authLabel}
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx` with a thin Server Component**

Replace the full contents of `app/page.tsx`:

```tsx
import HomeMenu from "@/components/HomeMenu";
import { getLatestNewsDate } from "@/lib/news/posts";

export default async function Home() {
  const latestNewsDate = await getLatestNewsDate();
  return <HomeMenu latestNewsDate={latestNewsDate} />;
}
```

- [ ] **Step 3: Remove World Boss from `TopNav`**

In `components/ui/TopNav.tsx`, remove the World Boss line from `LINKS`:

```ts
const LINKS = [
  { href: "/", label: "Main Menu" },
  { href: "/story", label: "Story" },
  { href: "/practice", label: "Practice" },
  { href: "/archive", label: "Archive" },
  { href: "/profile", label: "Profile" },
] as const;
```

- [ ] **Step 4: Verify**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/HomeMenu.tsx app/page.tsx components/ui/TopNav.tsx
git commit -m "Move World Boss and add News onto the homepage menu, out of TopNav"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full check + build**

Run: `npm run check`
Expected: PASS — all Vitest tests (existing + the 9 new ones from Task 2), tsc, eslint all clean.

Run: `npm run build`
Expected: PASS. Confirm the route list includes:
```
/news
/news/updates/[slug]   (prerenders /news/updates/2026-07-31-world-boss-update)
/news/notices/[slug]
```
(no notices exist yet, so that dynamic route will prerender zero paths — that's expected and not an error, same as any `generateStaticParams` returning `[]`.)

- [ ] **Step 2: Live browser check**

Start the dev server (`npm run dev`) and, using the browser tooling available (per the prior session, `claude-in-chrome` MCP may not reach `localhost` in a sandboxed browser — fall back to the `agent-browser` CLI, already installed, if so):

1. Load `/` — confirm 6 buttons render (Main Story, Character Archive, World Boss, Practice, News, Profile/Login), World Boss and News in their red/violet accent colors, News shows a `NEW` badge.
2. Click News → lands on `/news`, Updates tab active by default, shows the "World Boss Update" card (accent-bar style).
3. Click the card → lands on `/news/updates/2026-07-31-world-boss-update`, shows title, "Updated on 2026-07-31", the summary paragraph, then the New Feature / Ascension Costs (table renders correctly) / Fixes sections with amber left-border headings.
4. Click "← Back to News", click the Notices tab → shows "Nothing here yet." (no notices exist).
5. Navigate back to `/` — the `NEW` badge on the News button should now be gone (Task 6's `markNewsViewed` fired when `/news` was visited).
6. Confirm `TopNav` no longer shows a "World Boss" link on any page.

- [ ] **Step 3: Report results**

No code changes in this task — if anything in Step 2 doesn't match, go back to the relevant task (5, 6, or 7) and fix it, then re-run Step 1 and re-verify Step 2 before considering the plan complete.

---

## Self-Review Notes (from plan authoring)

- **Spec coverage:** content model (Task 3), rendering pipeline (Task 1), routes (Tasks 5-6), visual design (Tasks 5-6 mirror the approved mockups), nav integration incl. the corrected homepage-not-TopNav placement and the Server/Client split it required (Task 7), first entry (Task 3). All covered.
- **Type consistency:** `NewsPostSummary` (posts.ts) has `{slug, title, date, summary}`; `NewsFeedTabsProps` and `FeedCard` both consume that exact shape; the two detail pages independently declare a local `NewsPostMetadata` (no `slug`) since they read `metadata` straight off the dynamic import rather than through `posts.ts` — intentional, not a drift, since the detail page already knows its own slug from the route param.
- **No placeholders** — every step has real code, real commands, real expected output.

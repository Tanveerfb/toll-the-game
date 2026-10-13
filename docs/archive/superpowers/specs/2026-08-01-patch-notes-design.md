# Patch Notes / News System — Design

**Status:** Approved by Tanveer 2026-08-01. Roadmap item 5 (`docs/ROADMAP.md`), moved up ahead of gacha per his explicit call.

## Purpose

Give the game an in-game changelog so players can see what changed each update, without needing a backend or admin panel. Solo-dev cadence: write a post as part of the commit that ships the feature, same rhythm as updating `docs/ROADMAP.md` today.

## Content Model

Two collections of MDX files, one file per post, no database:

```
content/
  news/
    updates/
      2026-07-31-world-boss-update.mdx
      2026-07-29-passive-icon-overhaul.mdx
    notices/
      2026-08-05-maintenance-notice.mdx
```

Filenames are date-prefixed (`YYYY-MM-DD-<slug>.mdx`), matching the convention already used for `docs/superpowers/specs/` and `docs/superpowers/plans/`.

Each file exports plain metadata (Next's own convention — a JS object export, not YAML frontmatter) plus a Markdown body:

```mdx
export const metadata = {
  title: "World Boss Update",
  date: "2026-07-31",
  summary: "Character leveling, stamina, and the first world-boss encounter go live.",
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
|---|---|---|---|
| 1 | 3 | 10 | 10,000 |
| 2 | 6 | 15 | 25,000 |
| 3 | 10 | 25 | 50,000 |

## Fixes

- Mid-session progress now syncs to the cloud automatically — previously
  only synced on next login
```

**Version Update posts** (`content/news/updates/`) use `##` headings as sub-sections (New Feature, Kit Adjustments, Bug Fixes, Balance, etc.) — free-form, not an enforced enum, matching the Dokkan reference's "sub-sectioned content" pattern. One post = one release = one feed card, however many sections it contains.

**Notice posts** (`content/news/notices/`) are standalone one-off announcements not tied to a release (downtime, event reminders) — same file shape, typically no sub-sections, just a body.

`version` is *not* a required metadata field — the date-prefixed filename and title carry identity; add a `version` string later only if a real semver scheme gets adopted.

## Rendering Pipeline

- `@next/mdx` (Next.js's first-party App Router MDX support) + `remark-gfm` for tables/bullets/etc., configured in `next.config.ts` via `createMDX`.
- Root `mdx-components.tsx` maps `h2`/`ul`/`table`/`th`/`td` etc. to the dark zinc/amber theme once, globally — individual posts never carry styling.
- `lib/news/posts.ts` (Server-only, uses `fs.readdirSync` + dynamic `import()` over each `content/news/*` directory) exposes:
  - `getAllUpdates(): NewsPost[]` — sorted newest-first
  - `getAllNotices(): NewsPost[]` — sorted newest-first
  - `getLatestNewsDate(): string` — max date across both collections, for the nav badge
  - `type NewsPost = { slug: string; title: string; date: string; summary: string }`

## Routes

- `/news` — client page with two tabs, **Updates** / **Notices** (server-fetches both lists via the functions above and passes them down). Each tab renders a feed of cards, newest first.
- `/news/updates/[slug]` and `/news/notices/[slug]` — detail pages. Dynamic `import(`@/content/news/updates/${slug}.mdx`)` (or notices), rendered with `generateStaticParams` sourced from `lib/news/posts.ts`, `dynamicParams = false`.

## Visual Design (approved via visual-companion mockups, 2026-08-01)

**Feed cards — accent-bar rows:** each card is a left accent bar (amber, `#f59e0b`) plus title + date on one line, summary below. No banner image, no category-tag chip — the accent bar alone signals "this is a post," title/date/summary carry the rest. Same treatment for both Updates and Notices tabs.

**Detail page:** back-link → title (large) → "Updated on `<date>`" header (uppercase, bordered) → summary paragraph → sections, each rendered as an amber left-border block with an uppercase amber `##` heading, bullet lists and tables styled to match (bordered header row, subtle row dividers).

**Nav integration (corrected 2026-08-01 — Tanveer's call):** World Boss and News do **not** live in `TopNav`. Both belong on the main-menu homepage (`app/page.tsx`), which is not yet overhauled but already houses the game's primary navigation buttons (Main Story, Character Archive, Practice, Profile/Login) as a 2-column button grid. `TopNav`'s existing "World Boss" entry (added in the prior session) moves out; `News` is added on the homepage instead of `TopNav`.

`getLatestNewsDate()` is a Server-only call (`fs.readdirSync`), and `app/page.tsx` today is a Client Component (`"use client"`, for `useAuth`/`useGameStore`/`useRouter`) — a parent layout can't inject props into a page's tree, so the fix is the same Server/Client split already used for `app/archive/[id]/page.tsx` (async Server Component page rendering a client child): the existing `Home()` function body moves as-is into a new Client Component `components/HomeMenu.tsx`, which takes `latestNewsDate: string` as a prop. `app/page.tsx` becomes a thin async Server Component: calls `getLatestNewsDate()`, renders `<HomeMenu latestNewsDate={latestNewsDate} />`.

`HomeMenu` gains two buttons in its existing grid: **WORLD BOSS** (red/crimson accent, boss-fight framing) and **NEWS** (violet accent, distinct from the four existing button colors — amber/zinc/amber-gradient/sky) with a local-storage-backed `NEW` badge (compares `latestNewsDate` prop against a stored "last viewed" timestamp, same mechanism described above). Grid goes from 4 to 6 buttons (stays an even 3×2 on `md:grid-cols-2`). Order: Main Story, Character Archive, World Boss, Practice, News, Profile/Login.

## First Real Entry

`content/news/updates/2026-07-31-world-boss-update.mdx` — documents commits `15c6fb8` (player progression, stamina, world-boss loop) and `a702300` (mid-session cloud sync, profile redirect fix) as the actual first post, written by the assistant as part of implementation, doubling as the structural reference example for future posts.

## Explicitly Out of Scope

- Firestore-backed content or an in-app admin/editor — posts are authored as repo files, shipped on redeploy like everything else.
- Category tag chips / per-category tab filtering beyond Updates vs Notices — revisit only if the two-tab split stops being enough.
- Banner images — metadata shape doesn't need to reserve a field for this since posts are pure MDX (an image can be dropped into the Markdown body directly with standard `![]()` syntax whenever art exists, no schema change required).
- Cross-device read-tracking — the unread badge is local-only.

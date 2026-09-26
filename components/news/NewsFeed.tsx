"use client";

import Link from "next/link";
import React from "react";

import NewsKindBadge, { NEWS_KIND_LABEL } from "@/components/news/NewsKindBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { panelVariants } from "@/components/ui/Panel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { NewsPostSummary } from "@/lib/news/posts";
import {
  buildFeed,
  dayOfMonth,
  groupByMonth,
  pageWindow,
  paginateFeed,
  searchFeed,
  type NewsFeedEntry,
  type NewsKind,
} from "@/lib/news/feed";
import {
  getLastViewedNewsDate,
  hasUnreadNews,
  markNewsViewed,
} from "@/lib/news/readTracking";

interface NewsFeedProps {
  updates: NewsPostSummary[];
  notices: NewsPostSummary[];
  latestNewsDate: string | null;
}

type Filter = "all" | NewsKind;

// Never resubscribes — this store has no updates, it exists only so the server
// snapshot and the client snapshot differ. Unread pips can't render until the
// client has read localStorage, and rendering them on the server would be a
// hydration mismatch.
const NO_SUBSCRIBE = () => () => {};

function Row({
  entry,
  unread,
}: {
  entry: NewsFeedEntry;
  unread: boolean;
}): React.JSX.Element {
  return (
    <Link
      href={entry.href}
      // A paper row; an unread one carries a heavy yellow rule on its left,
      // the game's "this is new" mark (ruling #154).
      className={cn(
        panelVariants({ surface: "paper", density: "none", press: true }),
        "group grid grid-cols-[38px_minmax(0,1fr)_20px] items-start gap-3 px-3 py-2.5",
        unread && "border-l-8 border-l-primary",
      )}
    >
      <span
        className={cn(
          "font-heading text-2xl leading-none tracking-title",
          !unread && "text-muted-foreground",
        )}
      >
        {dayOfMonth(entry.date)}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-heading text-lg tracking-title">
            {entry.title}
          </span>
          <NewsKindBadge kind={entry.kind} />
        </span>
        <span className="mt-0.5 block font-body text-sm leading-relaxed text-muted-foreground">
          {entry.summary}
        </span>
      </span>
      <span className="pt-1 text-center font-body text-muted-foreground">
        →
      </span>
    </Link>
  );
}

/**
 * The news page, as **option B** of `docs/design/mockups/news-page.html`:
 * what arrived since you were last here, then the archive.
 *
 * He picked this over a flat feed and a searchable changelog. It answers the
 * question a returning player actually has, and it runs on read-tracking that
 * already shipped.
 *
 * **What "new" means here, precisely.** `markNewsViewed` stores **one date**,
 * not a per-post record, so this block is *"posted since you last opened this
 * page"* — which is exactly what its heading claims, and why option B needs no
 * new persisted field and no migration. Open the page and everything below the
 * line is marked seen, including posts you did not open. That is the model;
 * the copy says so rather than implying per-post tracking (measured
 * 2026-09-17).
 *
 * Two features that shipped here and had **never rendered** are kept but are
 * now honest about when they appear: the kind filter needs both kinds to exist
 * and there are zero notices, and pagination needs more than
 * `NEWS_PAGE_SIZE = 15` posts and there are nine. Both belong to the archive,
 * which is the half that grows.
 */
export default function NewsFeed({
  updates,
  notices,
  latestNewsDate,
}: NewsFeedProps): React.JSX.Element {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [page, setPage] = React.useState(1);
  const [query, setQuery] = React.useState("");

  // Captured once, in a lazy initialiser, so it is read BEFORE the effect
  // below marks everything as seen — otherwise opening the page would clear
  // the pips in the same paint that drew them.
  const [seenBefore] = React.useState<string | null>(() =>
    typeof window === "undefined" ? null : getLastViewedNewsDate(),
  );
  const hydrated = React.useSyncExternalStore(
    NO_SUBSCRIBE,
    () => true,
    () => false,
  );

  React.useEffect(() => {
    if (latestNewsDate) markNewsViewed(latestNewsDate);
  }, [latestNewsDate]);

  const feed = React.useMemo(
    () => buildFeed(updates, notices),
    [updates, notices],
  );

  // The two halves of option B. `hydrated` gates the split because it depends
  // on localStorage: before it, everything is archive and nothing is "new",
  // which is also what the server renders.
  //
  // A FIRST visit has no split. `hasUnreadNews(date, null)` is true for every
  // post when nothing was ever stored - correct for the home menu's pip, wrong
  // here, where it put all nine posts under "New since your last visit" and
  // left the archive reading "Nothing here yet". There was no last visit, so
  // nothing is new since it (browser check, 2026-09-17).
  const isNew = React.useCallback(
    (entry: NewsFeedEntry) =>
      hydrated && seenBefore !== null && hasUnreadNews(entry.date, seenBefore),
    [hydrated, seenBefore],
  );
  const fresh = feed.filter(isNew);
  const archive = feed.filter((entry) => !isNew(entry));

  const searched = React.useMemo(
    () => searchFeed(archive, query),
    [archive, query],
  );
  const filtered = React.useMemo(
    () =>
      filter === "all" ? searched : searched.filter((e) => e.kind === filter),
    [searched, filter],
  );

  const { items, page: safePage, pageCount } = paginateFeed(filtered, page);
  const groups = groupByMonth(items);

  // The filter only earns its space once both kinds exist — with zero notices
  // "All" and "Updates" would be the same list under two buttons.
  const showFilter = updates.length > 0 && notices.length > 0;

  const choose = (next: Filter) => {
    setFilter(next);
    setPage(1);
  };

  return (
    <div>
      {/* ---- What arrived while you were away ---- */}
      {fresh.length > 0 ? (
        <section className="flex flex-col gap-1.5">
          <p className="px-0.5 font-body text-label font-bold uppercase tracking-eyebrow text-primary">
            New since your last visit · {fresh.length}
          </p>
          <div className="flex flex-col gap-1">
            {fresh.map((entry) => (
              <Row key={entry.href} entry={entry} unread />
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- The archive ---- */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <p className="font-body text-label font-bold uppercase tracking-eyebrow text-ground-dim">
          {fresh.length > 0 ? "Earlier" : "All posts"}
        </p>
        <span className="ml-auto font-body text-caption font-bold uppercase tracking-label tabular-nums text-ground-dim">
          <b className="font-bold text-primary">{filtered.length}</b>{" "}
          {filtered.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <Input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setPage(1);
        }}
        placeholder="Search patch notes…"
        aria-label="Search patch notes"
        className="mt-2"
      />

      {showFilter ? (
        // One filter out of three: the shadcn toggle group (ruling #154).
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filter}
          onValueChange={(value) => {
            if (value) choose(value as Filter);
          }}
          className="mt-2"
          aria-label="Kind"
        >
          {(["all", "update", "notice"] as const).map((option) => (
            <ToggleGroupItem key={option} value={option}>
              {option === "all" ? "All" : `${NEWS_KIND_LABEL[option]}s`}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}

      {items.length === 0 ? (
        <p
          className={cn(
            panelVariants({ surface: "paper", density: "none" }),
            "mt-4 px-3 py-6 text-center font-body text-xs text-muted-foreground",
          )}
        >
          {query.trim()
            ? `Nothing matches “${query.trim()}”.`
            : "Nothing here yet."}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="mt-4">
            <p className="mb-2 border-b-2 border-ground-line pb-1.5 font-body text-label font-bold uppercase tracking-eyebrow text-ground-dim">
              {group.label}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((entry) => (
                <Row key={entry.href} entry={entry} unread={false} />
              ))}
            </div>
          </section>
        ))
      )}

      {pageCount > 1 ? (
        <nav
          aria-label="News pages"
          className="mt-6 flex flex-wrap items-center gap-1.5 border-t-2 border-ground-line pt-4"
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(safePage - 1)}
            disabled={safePage === 1}
          >
            ← Prev
          </Button>
          {pageWindow(safePage, pageCount).map((n, index) =>
            n === null ? (
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="px-1 font-body text-caption font-bold text-ground-dim"
              >
                …
              </span>
            ) : (
              <Button
                key={n}
                size="sm"
                // The page you are on is the paper button; the others are
                // outlines. Not the primary: paging is not the screen's action.
                variant={n === safePage ? "secondary" : "outline"}
                aria-current={n === safePage ? "page" : undefined}
                className="tabular-nums"
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ),
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(safePage + 1)}
            disabled={safePage === pageCount}
          >
            Next →
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const KIND_LABEL: Record<NewsKind, string> = {
  update: "Update",
  notice: "Notice",
};
const KIND_TONE: Record<NewsKind, string> = {
  // Updates are the routine stream; notices are the ones you should stop for.
  update: "border-el-blue/45 text-el-blue",
  notice: "border-role-ultimate/45 text-role-ultimate",
};

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
      className={`group grid grid-cols-[38px_minmax(0,1fr)_20px] items-start gap-3 border border-transparent border-l-2 px-3 py-2.5 transition-colors hover:border-edge hover:border-l-signal hover:bg-panel ${
        unread ? "border-l-signal" : "border-l-hairline"
      }`}
    >
      <span
        className={`font-heading text-2xl leading-none tracking-title ${
          unread ? "text-readout-strong" : "text-readout-muted"
        }`}
      >
        {dayOfMonth(entry.date)}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-heading text-lg tracking-title text-readout-strong">
            {entry.title}
          </span>
          <span
            className={`border px-1.5 py-px font-body text-[9px] font-bold uppercase tracking-label ${KIND_TONE[entry.kind]}`}
          >
            {KIND_LABEL[entry.kind]}
          </span>
        </span>
        <span className="mt-0.5 block font-body text-[13px] leading-relaxed text-readout-dim">
          {entry.summary}
        </span>
      </span>
      <span className="pt-1 text-center font-body text-readout-muted transition-colors group-hover:text-signal">
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
        <section className="border border-signal/40 bg-signal/5 p-2.5">
          <p className="mb-1.5 px-0.5 font-body text-[10px] font-bold uppercase tracking-eyebrow text-signal">
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
        <p className="font-body text-[10px] font-bold uppercase tracking-eyebrow text-readout-muted">
          {fresh.length > 0 ? "Earlier" : "All posts"}
        </p>
        <span className="ml-auto font-body text-[11px] font-bold uppercase tracking-label tabular-nums text-readout-muted">
          <b className="font-bold text-signal">{filtered.length}</b>{" "}
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
        className="mt-2 rounded-none border-edge bg-inset font-body"
      />

      {showFilter ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(["all", "update", "notice"] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={filter === option ? "default" : "outline"}
              aria-pressed={filter === option}
              onClick={() => choose(option)}
            >
              {option === "all" ? "All" : `${KIND_LABEL[option]}s`}
            </Button>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-4 border border-hairline bg-panel px-3 py-6 text-center font-body text-xs text-readout-muted">
          {query.trim()
            ? `Nothing matches “${query.trim()}”.`
            : "Nothing here yet."}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="mt-4">
            <p className="mb-2 border-b border-hairline pb-1.5 font-body text-[10px] font-bold uppercase tracking-eyebrow text-readout-muted">
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
          className="mt-6 flex flex-wrap items-center gap-1.5 border-t border-hairline pt-4"
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
                className="px-1 font-body text-[11px] font-bold text-readout-muted"
              >
                …
              </span>
            ) : (
              <Button
                key={n}
                size="sm"
                variant={n === safePage ? "default" : "outline"}
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

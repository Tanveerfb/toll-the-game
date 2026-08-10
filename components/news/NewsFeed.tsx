"use client";

import Link from "next/link";
import React from "react";
import type { NewsPostSummary } from "@/lib/news/posts";
import {
  buildFeed,
  dayOfMonth,
  groupByMonth,
  pageWindow,
  paginateFeed,
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

const CHIP =
  "chamfer min-h-11 border px-3 py-1.5 font-body text-[11px] font-bold uppercase tracking-[0.16em] transition-colors";
const CHIP_OFF =
  "border-edge bg-void/60 text-readout-dim hover:border-edge-strong hover:text-readout";
const CHIP_ON = "border-signal bg-signal text-void";

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
        className={`font-heading text-2xl leading-none tracking-[0.03em] ${
          unread ? "text-readout-strong" : "text-readout-muted"
        }`}
      >
        {dayOfMonth(entry.date)}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-heading text-lg tracking-[0.04em] text-readout-strong">
            {entry.title}
          </span>
          <span
            className={`border px-1.5 py-px font-body text-[9px] font-bold uppercase tracking-[0.16em] ${KIND_TONE[entry.kind]}`}
          >
            {KIND_LABEL[entry.kind]}
          </span>
          {unread ? (
            <span className="bg-signal px-1.5 py-px font-body text-[9px] font-bold uppercase tracking-[0.16em] text-void">
              New
            </span>
          ) : null}
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

export default function NewsFeed({
  updates,
  notices,
  latestNewsDate,
}: NewsFeedProps): React.JSX.Element {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [page, setPage] = React.useState(1);

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
  const filtered = React.useMemo(
    () => (filter === "all" ? feed : feed.filter((e) => e.kind === filter)),
    [feed, filter],
  );

  const { items, page: safePage, pageCount } = paginateFeed(filtered, page);
  const groups = groupByMonth(items);
  const unreadCount = hydrated
    ? feed.filter((e) => hasUnreadNews(e.date, seenBefore)).length
    : 0;

  // The filter only earns its space once both kinds exist — with zero notices
  // "All" and "Updates" would be the same list under two buttons.
  const showFilter = updates.length > 0 && notices.length > 0;

  const choose = (next: Filter) => {
    setFilter(next);
    setPage(1);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {showFilter ? (
          <div className="flex flex-wrap gap-1.5">
            {(["all", "update", "notice"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => choose(option)}
                aria-pressed={filter === option}
                className={`${CHIP} ${filter === option ? CHIP_ON : CHIP_OFF}`}
              >
                {option === "all" ? "All" : `${KIND_LABEL[option]}s`}
              </button>
            ))}
          </div>
        ) : null}
        <span className="ml-auto font-body text-[11px] font-bold uppercase tracking-[0.18em] tabular-nums text-readout-muted">
          <b className="font-bold text-signal">{filtered.length}</b>{" "}
          {filtered.length === 1 ? "entry" : "entries"}
          {unreadCount > 0 ? (
            <>
              {" · "}
              <b className="font-bold text-signal">{unreadCount}</b> unread
            </>
          ) : null}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 font-body text-sm text-readout-muted">
          Nothing here yet.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="mt-5">
            <p className="mb-2 border-b border-hairline pb-1.5 font-body text-[10px] font-bold uppercase tracking-[0.28em] text-readout-muted">
              {group.label}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((entry) => (
                <Row
                  key={entry.href}
                  entry={entry}
                  unread={hydrated && hasUnreadNews(entry.date, seenBefore)}
                />
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
          <button
            type="button"
            onClick={() => setPage(safePage - 1)}
            disabled={safePage === 1}
            className={`${CHIP} ${CHIP_OFF} disabled:pointer-events-none disabled:opacity-40`}
          >
            ← Prev
          </button>
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
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === safePage ? "page" : undefined}
                className={`${CHIP} tabular-nums ${n === safePage ? CHIP_ON : CHIP_OFF}`}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => setPage(safePage + 1)}
            disabled={safePage === pageCount}
            className={`${CHIP} ${CHIP_OFF} disabled:pointer-events-none disabled:opacity-40`}
          >
            Next →
          </button>
        </nav>
      ) : null}
    </div>
  );
}

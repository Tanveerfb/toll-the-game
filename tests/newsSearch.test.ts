import { describe, expect, it } from "vitest";

import { buildFeed, searchFeed, type NewsFeedEntry } from "@/lib/news/feed";
import type { NewsPostSummary } from "@/lib/news/posts";

/**
 * Search over the news feed.
 *
 * Added 2026-09-17 with the option-B rebuild. The page had a kind filter and
 * pagination — neither of which had ever rendered, since the filter needs both
 * kinds to exist and there are zero notices, and pagination needs more than
 * `NEWS_PAGE_SIZE = 15` posts and there are nine — and no way to find anything.
 */

function post(title: string, summary: string, date: string): NewsPostSummary {
  return { slug: title.toLowerCase().replace(/\s+/g, "-"), title, summary, date };
}

const UPDATES = [
  post("Built for a Phone", "Every screen redrawn for a 390px canvas.", "2026-08-21"),
  post("The Log Shows Effects", "The battle log records every buff applied.", "2026-09-01"),
  post("Summon System Arrives", "Banners, rates and pity.", "2026-08-02"),
];

const feed: NewsFeedEntry[] = buildFeed(UPDATES, []);

describe("searchFeed", () => {
  it("returns everything for an empty query", () => {
    expect(searchFeed(feed, "")).toHaveLength(feed.length);
    expect(searchFeed(feed, "   ")).toHaveLength(feed.length);
  });

  it("matches a title", () => {
    const hits = searchFeed(feed, "phone");
    expect(hits.map((e) => e.title)).toEqual(["Built for a Phone"]);
  });

  it("matches a summary, not just a title", () => {
    // "pity" appears only in the summary — a search that read titles alone
    // would be useless for patch notes, where the detail is in the body.
    const hits = searchFeed(feed, "pity");
    expect(hits.map((e) => e.title)).toEqual(["Summon System Arrives"]);
  });

  it("ignores case on both sides", () => {
    expect(searchFeed(feed, "PHONE")).toHaveLength(1);
    expect(searchFeed(feed, "pHoNe")).toHaveLength(1);
  });

  it("trims the query", () => {
    expect(searchFeed(feed, "  phone  ")).toHaveLength(1);
  });

  it("returns nothing when nothing matches, rather than everything", () => {
    // The failure mode worth guarding: a bad early return that treats "no
    // matches" as "no filter" and quietly shows the whole list.
    expect(searchFeed(feed, "molvarr")).toEqual([]);
  });

  it("leaves the feed's order alone", () => {
    const hits = searchFeed(feed, "the");
    const dates = hits.map((e) => e.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("does not mutate the feed it was given", () => {
    const before = feed.length;
    searchFeed(feed, "phone");
    expect(feed).toHaveLength(before);
  });
});

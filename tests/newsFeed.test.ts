import { describe, expect, it } from "vitest";
import {
  buildFeed,
  dayOfMonth,
  estimateReadingMinutes,
  groupByMonth,
  monthLabel,
  pageWindow,
  paginate,
} from "@/lib/news/feed";
import type { NewsPostSummary } from "@/lib/news/posts";

const post = (slug: string, date: string): NewsPostSummary => ({
  slug,
  date,
  title: slug,
  summary: `summary for ${slug}`,
});

describe("buildFeed", () => {
  it("merges both kinds into one newest-first stream", () => {
    const feed = buildFeed(
      [post("u-old", "2026-07-31"), post("u-new", "2026-08-09")],
      [post("n-mid", "2026-08-02")],
    );
    expect(feed.map((e) => e.slug)).toEqual(["u-new", "n-mid", "u-old"]);
  });

  it("routes each kind to its own segment", () => {
    const feed = buildFeed([post("a", "2026-08-01")], [post("b", "2026-08-02")]);
    expect(feed.map((e) => e.href)).toEqual([
      "/news/notices/b",
      "/news/updates/a",
    ]);
  });
});

describe("groupByMonth", () => {
  it("splits a run into consecutive month groups", () => {
    const groups = groupByMonth(
      buildFeed(
        [
          post("aug-b", "2026-08-09"),
          post("aug-a", "2026-08-01"),
          post("jul", "2026-07-31"),
        ],
        [],
      ),
    );
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ["August 2026", 2],
      ["July 2026", 1],
    ]);
  });

  it("returns nothing for an empty feed", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("monthLabel and dayOfMonth", () => {
  it("names the month", () => {
    expect(monthLabel("2026-08")).toBe("August 2026");
    expect(monthLabel("2026-01")).toBe("January 2026");
  });

  it("passes through anything that isn't a month key", () => {
    expect(monthLabel("nonsense")).toBe("nonsense");
    expect(monthLabel("2026-13")).toBe("2026-13");
  });

  it("strips the leading zero off the day", () => {
    expect(dayOfMonth("2026-08-09")).toBe("9");
    expect(dayOfMonth("2026-08-31")).toBe("31");
  });
});

describe("paginate", () => {
  const feed = buildFeed(
    Array.from({ length: 23 }, (_, i) =>
      post(`p${i}`, `2026-08-${String(i + 1).padStart(2, "0")}`),
    ),
    [],
  );

  it("slices to the page size and reports the count", () => {
    const result = paginate(feed, 1, 10);
    expect(result.items).toHaveLength(10);
    expect(result.pageCount).toBe(3);
  });

  it("returns the remainder on the last page", () => {
    expect(paginate(feed, 3, 10).items).toHaveLength(3);
  });

  it("clamps a request past the end onto the last real page", () => {
    expect(paginate(feed, 99, 10).page).toBe(3);
  });

  it("clamps zero and negative pages up to the first", () => {
    expect(paginate(feed, 0, 10).page).toBe(1);
    expect(paginate(feed, -4, 10).page).toBe(1);
  });

  it("treats an empty feed as one empty page, not zero pages", () => {
    // "Page 1 of 0" would render, and the clamp would have no valid target.
    const result = paginate([], 1, 10);
    expect(result.pageCount).toBe(1);
    expect(result.items).toEqual([]);
  });
});

describe("pageWindow", () => {
  it("lists every page while the count is small", () => {
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("elides the middle on a long archive", () => {
    expect(pageWindow(9, 20)).toEqual([1, null, 8, 9, 10, null, 20]);
  });

  it("keeps the control the same width at either end", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 19, 20]);
  });

  it("renders a one-page gap as the page itself, never an ellipsis", () => {
    // "1 … 3" is wider than "1 2 3" and says less.
    expect(pageWindow(4, 8)).toEqual([1, 2, 3, 4, 5, null, 8]);
  });
});

describe("estimateReadingMinutes", () => {
  it("ignores the metadata block so a post isn't paid for its frontmatter", () => {
    const frontmatterOnly = `export const metadata = {
  title: "A Title That Is Quite Long Indeed",
  date: "2026-08-09",
  summary: "${"word ".repeat(300)}",
};

Body.`;
    expect(estimateReadingMinutes(frontmatterOnly)).toBe(1);
  });

  it("scales with the body", () => {
    expect(estimateReadingMinutes("word ".repeat(1000))).toBe(5);
  });

  it("never reports zero minutes", () => {
    expect(estimateReadingMinutes("")).toBe(1);
    expect(estimateReadingMinutes("Short.")).toBe(1);
  });
});

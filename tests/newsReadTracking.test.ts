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

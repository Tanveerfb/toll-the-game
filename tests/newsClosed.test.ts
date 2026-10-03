import { describe, expect, it } from "vitest";
import { NEWS_OPEN } from "@/lib/news/open";
import {
  getAllNotices,
  getAllUpdates,
  getLatestNewsDate,
  listNoticeSlugs,
  listUpdateSlugs,
} from "@/lib/news/posts";
import { hasUnreadNews } from "@/lib/news/readTracking";

// News is closed while the game is overhauled (lib/news/open.ts). If the
// switch is flipped back on, this file is the reminder to retire these checks.
describe("news closed", () => {
  it("is switched off", () => {
    expect(NEWS_OPEN).toBe(false);
  });

  it("lists no posts of either kind", async () => {
    expect(listUpdateSlugs()).toEqual([]);
    expect(listNoticeSlugs()).toEqual([]);
    expect(await getAllUpdates()).toEqual([]);
    expect(await getAllNotices()).toEqual([]);
  });

  it("has no latest date, so nothing reads as unread", async () => {
    const latest = await getLatestNewsDate();
    expect(latest).toBeNull();
    expect(hasUnreadNews(latest, null)).toBe(false);
  });
});

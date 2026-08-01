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

/** Subscribes to cross-tab localStorage changes (the `storage` event only
 *  fires in OTHER tabs/windows, not the one that wrote the value — same-tab
 *  updates are covered separately since consumers remount on navigation). */
export function subscribeToNewsReadState(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

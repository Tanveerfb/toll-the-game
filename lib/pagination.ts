/**
 * Generic pagination, shared by the news feed and the story chapter select.
 *
 * Lived in `lib/news/feed.ts` first and was lifted here when the second
 * consumer appeared (Tanveer, 2026-08-11) — the arithmetic was never
 * news-specific.
 */

export interface Page<T> {
  items: T[];
  /** Clamped into range — an out-of-range request lands on a real page. */
  page: number;
  pageCount: number;
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): Page<T> {
  const size = Math.max(1, Math.floor(pageSize));
  // An empty list is one empty page, not zero pages — otherwise "page 1 of 0"
  // renders and the clamp below has no valid target.
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const safe = Math.min(pageCount, Math.max(1, Math.floor(page) || 1));
  const start = (safe - 1) * size;
  return { items: items.slice(start, start + size), page: safe, pageCount };
}

/**
 * Page numbers to render, with `null` standing in for an elision. Always
 * includes the first and last page and a neighbour either side of the current
 * one, so the control keeps a fixed width however long the list gets.
 */
export function pageWindow(
  page: number,
  pageCount: number,
): Array<number | null> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const shown = new Set([1, pageCount, page - 1, page, page + 1]);
  const out: Array<number | null> = [];
  for (let n = 1; n <= pageCount; n += 1) {
    if (!shown.has(n)) continue;
    // A gap of exactly one page renders as that page, not as an ellipsis —
    // "1 … 3" is wider than "1 2 3" and tells you less.
    const previous = out[out.length - 1];
    if (typeof previous === "number" && n - previous === 2) out.push(previous + 1);
    else if (typeof previous === "number" && n - previous > 2) out.push(null);
    out.push(n);
  }
  return out;
}

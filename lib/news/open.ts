/**
 * Whether news posts are published at all.
 *
 * **Closed while he overhauls the game** (Tanveer, 2026-10-03): *"remove all
 * posts for now. we are in the middle of overhauling the game so posts are not
 * valid until we are stable and ready with the game. just put a 'Coming soon'
 * on posts page for now."*
 *
 * The one switch, mirroring `ORDERS_OPEN`. Off, the post loaders list nothing
 * (so the feed, the post routes and the home "Unread notices" alert all stand
 * down together) and `/news` says "Coming soon". The MDX files stay in
 * `content/news/`; turning this back on is a review of which posts are still
 * true, not a rebuild. See "News returns" in `docs/ROADMAP.md`.
 */
export const NEWS_OPEN = false;

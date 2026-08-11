/**
 * The single source of truth for "what modes exist in this game".
 *
 * TopNav and HomeMenu each used to keep their own list, and they disagreed:
 * the nav offered Main Menu/Story/Practice/Archive/Profile while the menu
 * offered Story/Archive/World Boss/Practice/News/Gacha/Login — so World Boss,
 * News and Gacha were unreachable from every page except the home screen.
 * Both now render from this array.
 */
export interface GameRoute {
  href: string;
  /** Full name — used on the home screen and as the nav fallback. */
  label: string;
  /** Shorter name for the h-11 nav bar, where 8 links have to fit. */
  navLabel?: string;
}

// Typed as `readonly GameRoute[]` rather than `as const` so consumers see
// `navLabel` as an optional field on every entry, not per-literal.
export const GAME_ROUTES: readonly GameRoute[] = [
  { href: "/", label: "Main Menu", navLabel: "Menu" },
  { href: "/story", label: "Main Story", navLabel: "Story" },
  { href: "/events", label: "Events", navLabel: "Events" },
  { href: "/gacha", label: "Gacha" },
  { href: "/archive", label: "Character Archive", navLabel: "Archive" },
  { href: "/practice", label: "Practice" },
  { href: "/news", label: "News" },
  { href: "/profile", label: "Profile" },
];

/** `/` matches exactly; everything else matches its subtree. */
export function isRouteActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

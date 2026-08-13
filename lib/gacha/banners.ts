import debutBanner from "@/data/banners/debut-2026-08.json";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";

/**
 * Banners.
 *
 * **There are no limited banners (Tanveer, 2026-08-13.)** The V1. Beta Roster
 * Banner carried an `endsAt` and read as "Limited · ends <date>" for weeks; it
 * was always meant to be permanent. The end date is gone from the data and the
 * type, and the countdown it fed on the home screen went with it.
 *
 * Two banners still exist in code because they are two *economies*, not two
 * durations:
 *
 * - The **gem banner** — the beta roster. Gems, a 5% featured rate, two
 *   milestones. This is the one players see.
 * - The **ticket banner** — Permanent Tickets, every pull a character, one
 *   milestone. Its pool is every character flagged `permanentPool: true`,
 *   which is currently **none**, so it renders nowhere.
 *
 * The `limited` identifiers in `store/playerStore.ts` (`pullLimited`,
 * `pity.limited`) still carry the old word. They key persisted player state, so
 * renaming them means a migration that buys the player nothing — they mean "the
 * gem banner" and are documented as such rather than churned. Do not read them
 * as evidence that a limited banner exists.
 */
export interface GemBannerConfig {
  id: string;
  name: string;
  featured: string[];
  rate: number;
}

export interface TicketBannerConfig {
  id: "permanent";
  featured: string[];
}

/** The gem banner. One exists; when a second is authored this becomes a
 *  lookup across banner files rather than a single static import. */
export function getGemBanner(): GemBannerConfig {
  const banner = debutBanner as GemBannerConfig;
  if (banner.featured.length === 0) {
    throw new Error(`Gem banner "${banner.id}" has no featured characters`);
  }
  return banner;
}

/** Pool is computed live from character data, not a static file — see
 *  the `permanentPool` flag on `CharacterData` (lib/game/characterCatalog.ts).
 *  Empty until a character is flagged `permanentPool: true`, and an empty
 *  ticket banner is not offered to the player at all. */
export function getTicketBanner(): TicketBannerConfig {
  const featured = getPlayableCharacters()
    .filter((character) => character.permanentPool === true)
    .map((character) => character.id);
  return { id: "permanent", featured };
}

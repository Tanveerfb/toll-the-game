import debutBanner from "@/data/banners/debut-2026-08.json";
import { getPlayableCharacters } from "@/lib/game/characterCatalog";

export interface LimitedBannerConfig {
  id: string;
  name: string;
  featured: string[];
  rate: number;
  endsAt: string;
}

export interface PermanentBannerConfig {
  id: "permanent";
  featured: string[];
}

/** Only one Limited banner exists at a time right now — the debut banner.
 *  When banner rotation is built, this becomes a lookup by current date
 *  against a list of banner files instead of a single static import. */
export function getActiveLimitedBanner(): LimitedBannerConfig {
  const banner = debutBanner as LimitedBannerConfig;
  if (banner.featured.length === 0) {
    throw new Error(`Limited banner "${banner.id}" has no featured characters`);
  }
  return banner;
}

/** Pool is computed live from character data, not a static file — see
 *  the `permanentPool` flag on `CharacterData` (lib/game/characterCatalog.ts).
 *  Starts empty until a character is flagged `permanentPool: true`. */
export function getPermanentBanner(): PermanentBannerConfig {
  const featured = getPlayableCharacters()
    .filter((character) => character.permanentPool === true)
    .map((character) => character.id);
  return { id: "permanent", featured };
}

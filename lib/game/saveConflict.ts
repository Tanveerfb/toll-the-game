import type { PlayerState } from "@/store/playerStore";

/**
 * Whether signing in should ask which save to keep, and what to show.
 *
 * His call (2026-10-13, audit finding 4): *"Ask with differences shown."*
 * Before this, a guest who played, then signed in to an existing account,
 * had the cloud copy silently replace local progress, and the login screen
 * promised the opposite. The question is asked only when **both** saves have
 * been played (a fresh device over a real account, or a real device over an
 * empty account, needs no question), and what it shows is this diff.
 *
 * Pure: the dialog (`docs/specs/save-conflict.md`) renders `rows`; the
 * provider applies the choice. Nothing here reads a store.
 */

type SaveSide = "local" | "cloud";

type SaveConflictRow = {
  /** What the row is about, in the player's words. */
  label: string;
  local: string;
  cloud: string;
};

type SaveConflict = {
  rows: SaveConflictRow[];
  /** The side the rows suggest is further along; the dialog pre-selects it. */
  suggested: SaveSide;
};

/** The slice of a save the comparison reads; both sides are this shape. */
export type SaveSummaryInput = Pick<
  PlayerState,
  "roster" | "currencies" | "characters" | "account" | "stats" | "epicClears"
>;

/**
 * A save that has been played: anything beyond the starter roster, or any
 * pull, clear or rank gained. `DEFAULT_PLAYER_STATE` is one character, no
 * stats and rank 1, so a fresh save is "untouched" whatever its gems.
 */
export function isPlayedSave(save: SaveSummaryInput): boolean {
  return (
    save.roster.length > 1 ||
    save.account.rank > 1 ||
    save.stats.pulls > 0 ||
    save.stats.bossClears > 0 ||
    Object.keys(save.epicClears).length > 0 ||
    Object.values(save.characters).some((c) => c.level > 1 || c.ascension > 0 || c.ultLevel > 1)
  );
}

/** A number of points: the higher save is "further along". */
function progressScore(save: SaveSummaryInput): number {
  const levels = Object.values(save.characters).reduce((sum, c) => sum + c.level, 0);
  return (
    save.roster.length * 100 +
    save.account.rank * 50 +
    levels +
    save.stats.pulls +
    save.stats.bossClears * 5 +
    Object.values(save.epicClears).reduce((sum, r) => sum + r.clears, 0) * 5
  );
}

/**
 * Null when no question is needed: one side is untouched, so it is replaced
 * without asking (the played side wins, whichever it is). Otherwise the rows
 * a player compares and the side to pre-select.
 */
export function describeSaveConflict(
  local: SaveSummaryInput,
  cloud: SaveSummaryInput,
): SaveConflict | null {
  if (!isPlayedSave(local) || !isPlayedSave(cloud)) return null;
  const highest = (save: SaveSummaryInput) =>
    Object.values(save.characters).reduce((max, c) => Math.max(max, c.level), 1);
  const clears = (save: SaveSummaryInput) =>
    Object.values(save.epicClears).reduce((sum, r) => sum + r.clears, 0) + save.stats.bossClears;
  const n = (value: number) => value.toLocaleString();
  const rows: SaveConflictRow[] = [
    { label: "Characters", local: n(local.roster.length), cloud: n(cloud.roster.length) },
    { label: "Account rank", local: n(local.account.rank), cloud: n(cloud.account.rank) },
    { label: "Highest level", local: n(highest(local)), cloud: n(highest(cloud)) },
    { label: "Gems", local: n(local.currencies.gems), cloud: n(cloud.currencies.gems) },
    { label: "Pulls made", local: n(local.stats.pulls), cloud: n(cloud.stats.pulls) },
    { label: "Fights cleared", local: n(clears(local)), cloud: n(clears(cloud)) },
  ];
  return {
    rows,
    suggested: progressScore(cloud) >= progressScore(local) ? "cloud" : "local",
  };
}

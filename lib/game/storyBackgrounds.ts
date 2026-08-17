/**
 * Scene backgrounds.
 *
 * Story mode v1 had none: `StoryScene` carried four fields and no background, so
 * twelve chapters played over the same void and `part1.json` wrote *"A small
 * rural village. Remote, quiet, self-contained."* as narration because there was
 * no other way to say where you were.
 *
 * v2 authors a **slug** per scene (`village_ruins`, `open_road`, …) matching
 * Category A of `docs/ART_REQUESTS.md`. The plates are queued for a ComfyUI
 * session and don't exist yet, which is the normal state of art in this project
 * and must never block the feature (`AGENTS.md`). So a slug resolves to:
 *
 *  1. the plate, once `image` is filled in here — the only edit an art session
 *     needs to make, and it lights up every scene using that slug at once;
 *  2. otherwise a **tint**, used to build a gradient backdrop that at least
 *     separates a burned village from a lake at a glance.
 *
 * A slug nobody registered still renders (neutral tint) rather than throwing:
 * an unknown location is an authoring slip worth seeing on screen, not a crash.
 */

export interface StoryBackground {
  /** Human label — used in dev tooling and the mockup's fallback badge. */
  label: string;
  /**
   * Two hex stops, top then bottom. Read straight into a linear-gradient, so a
   * location reads as *somewhere* before its plate is drawn.
   */
  tint: [string, string];
  /** Public path to the 16:9 plate, once one exists. Absent = fallback. */
  image?: string;
}

/** Slugs mirror `docs/ART_REQUESTS.md` Category A. */
export const STORY_BACKGROUNDS: Record<string, StoryBackground> = {
  village_peaceful: { label: "Village, intact", tint: ["#17262c", "#0a1116"] },
  village_ruins: { label: "Village, burned", tint: ["#2a1a16", "#0b0d10"] },
  bureau_interior: { label: "Bureau interior", tint: ["#141c28", "#080d12"] },
  open_road: { label: "Open road", tint: ["#182320", "#0a1014"] },
  exam_staging: { label: "Exam staging ground", tint: ["#1b1d2b", "#090d13"] },
  exam_ground: { label: "Phase 1 terrain", tint: ["#16221b", "#090f12"] },
  zipline_ridge: { label: "Zipline ridge", tint: ["#152230", "#090f15"] },
  scorched_earth: { label: "Scorched earth", tint: ["#301c12", "#0b0c0e"] },
  gamblers_table: { label: "Gambler's table", tint: ["#231624", "#0a0a10"] },
  the_lake: { label: "The lake", tint: ["#101f2b", "#070d13"] },
  the_bridge: { label: "The bridge", tint: ["#131d26", "#080c11"] },
  holding_room: { label: "Holding room", tint: ["#191a1e", "#0a0b0e"] },
  overseer_dining: { label: "Overseer's dining room", tint: ["#241d15", "#0c0b0a"] },
  final_phase: { label: "Phase 3 arena", tint: ["#221f14", "#0b0b0c"] },
};

const NEUTRAL: StoryBackground = {
  label: "Unplaced",
  tint: ["#111a23", "#06090c"],
};

export function getStoryBackground(slug: string | undefined): StoryBackground {
  if (!slug) return NEUTRAL;
  return STORY_BACKGROUNDS[slug] ?? NEUTRAL;
}

/** True when the slug still resolves to the gradient rather than a plate — what
 *  the dev-only fallback badge keys off. */
export function isBackgroundPending(slug: string | undefined): boolean {
  return getStoryBackground(slug).image === undefined;
}

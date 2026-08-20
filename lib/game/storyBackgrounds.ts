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
  village_peaceful: {
    label: "Village, intact",
    tint: ["#17262c", "#0a1116"],
    image: "/backgrounds/village_peaceful.webp",
  },
  village_ruins: {
    label: "Village, burned",
    tint: ["#2a1a16", "#0b0d10"],
    image: "/backgrounds/village_ruins.webp",
  },
  bureau_interior: {
    label: "Bureau interior",
    tint: ["#141c28", "#080d12"],
    image: "/backgrounds/bureau_interior.webp",
  },
  open_road: {
    label: "Open road",
    tint: ["#182320", "#0a1014"],
    image: "/backgrounds/open_road.webp",
  },
  /* Chapter 1's world, added 2026-08-20 once the beat sheets were actually read.
     The cold open names three places the registry had no slug for at all. */
  city_toll_metropolis: {
    label: "Toll metropolis",
    tint: ["#1e2a33", "#080d12"],
    image: "/backgrounds/city_toll_metropolis.webp",
  },
  bureau_exterior: {
    label: "Bureau, exterior",
    tint: ["#1a232e", "#090d12"],
    image: "/backgrounds/bureau_exterior.webp",
  },
  waypoint_town: {
    label: "Waypoint town",
    tint: ["#2a2118", "#0c0a09"],
    image: "/backgrounds/waypoint_town.webp",
  },
  /* The nine-year training montage. One place, three weathers — the snow and
     storm plates are img2img derivatives of the summer one, so the montage
     reads as time passing over the same ground rather than three locations. */
  wilderness_ridge_summer: {
    label: "Training ridge, summer",
    tint: ["#1f2a22", "#0a0f0c"],
    image: "/backgrounds/wilderness_ridge_summer.webp",
  },
  wilderness_ridge_snow: {
    label: "Training ridge, winter",
    tint: ["#232c33", "#0c1013"],
    image: "/backgrounds/wilderness_ridge_snow.webp",
  },
  wilderness_ridge_storm: {
    label: "Training ridge, storm",
    tint: ["#1b242a", "#090d10"],
    image: "/backgrounds/wilderness_ridge_storm.webp",
  },
  /* Chapter 2. `jungle_clearing` took eight attempts and a method of its own —
     the ground blocked in with PIL, then img2img at denoise 0.80. See
     ART_PIPELINE: below ~0.7 a dense-foliage source shreds into stripe noise,
     and above ~0.85 the composition goes. */
  jungle_clearing: {
    label: "Jungle clearing",
    tint: ["#1a2419", "#090f0a"],
    image: "/backgrounds/jungle_clearing.webp",
  },
  jungle_path_day: {
    label: "Jungle trail",
    tint: ["#16241d", "#080f0c"],
    image: "/backgrounds/jungle_path_day.webp",
  },
  jungle_path_dusk: {
    label: "Jungle trail, dusk",
    tint: ["#121b22", "#070b0e"],
    image: "/backgrounds/jungle_path_dusk.webp",
  },
  jungle_deep: {
    label: "Jungle, deep",
    tint: ["#0b1a16", "#050a08"],
    image: "/backgrounds/jungle_deep.webp",
  },
  /* Chapter 3 — the exam building, inside and out. Four plates of one place. */
  exam_compound_exterior: {
    label: "Exam compound",
    tint: ["#1d2731", "#090d12"],
    image: "/backgrounds/exam_compound_exterior.webp",
  },
  exam_registration_hall: {
    label: "Registration hall",
    tint: ["#1c2833", "#090e13"],
    image: "/backgrounds/exam_registration_hall.webp",
  },
  exam_waiting_room: {
    label: "Waiting hall",
    tint: ["#1b2530", "#080d11"],
    image: "/backgrounds/exam_waiting_room.webp",
  },
  exam_venue_courtyard: {
    label: "Venue courtyard, night",
    tint: ["#141d2e", "#070a11"],
    image: "/backgrounds/exam_venue_courtyard.webp",
  },
  exam_staging: { label: "Exam staging ground", tint: ["#1b1d2b", "#090d13"] },
  exam_ground: { label: "Phase 1 terrain", tint: ["#16221b", "#090f12"] },
  zipline_ridge: { label: "Zipline ridge", tint: ["#152230", "#090f15"] },
  scorched_earth: { label: "Scorched earth", tint: ["#301c12", "#0b0c0e"] },
  /* Was `gamblers_table` ("Part 7, interior, low light, a table") until
     2026-08-20. Chapter 7 is Chiara reporting to the admins in the monitor
     room; there is no gambling table anywhere in Arc One. This room is the
     most-used interior in the arc — chapters 6, 7, 8 and 10 all play here. */
  admin_room: { label: "Admin monitor room", tint: ["#141b26", "#080c11"] },
  the_lake: { label: "The lake", tint: ["#101f2b", "#070d13"] },
  /* Was `the_bridge` ("the lake's only crossing") until 2026-08-20. Chapter 9
     turns on there being no crossing at all — Duke reframes Molvarr itself as
     the bridge. What the chapters actually need is the near shore: flag 1, the
     Bureau speaker on its pole, and the whole problem-solving half of Ch8. */
  lake_shore: { label: "Lake, near shore", tint: ["#12222c", "#070d12"] },
  holding_room: { label: "Holding room", tint: ["#191a1e", "#0a0b0e"] },
  /* Was `overseer_dining` ("the old man's dinner room") until 2026-08-20.
     Chapter 11 puts Duke and Tao in the candidates' shared common space late at
     night, most of the room already gone to bed — not a private dining room. */
  common_space_night: { label: "Common space, night", tint: ["#1d1a17", "#0b0a0a"] },
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

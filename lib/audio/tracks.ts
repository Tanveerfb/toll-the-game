/**
 * Music manifest. Screens ask for a **role**, never a filename, so swapping
 * what plays where is an edit to this one map.
 *
 * The paths below are declared before the files exist — `public/audio/` ships
 * empty on purpose (Tanveer supplies the OST). A role whose file is missing
 * resolves to silence, not an error; see `lib/audio/music.ts`. The filenames
 * each role expects are documented in `docs/AUDIO.md`.
 *
 * Music only — no SFX bus here or anywhere (Tanveer, 2026-08-09). A future
 * SFX system belongs beside this module, not inside it.
 */
export type MusicRole =
  | "menu"
  | "story"
  | "storyScene"
  | "battle"
  | "victory";

export interface MusicTrack {
  src: string;
  /** Per-track level trim (0–1). Different masters arrive at different
   *  loudness; this is where that gets evened out without re-exporting. */
  gain: number;
  loop: boolean;
}

export const MUSIC_TRACKS: Record<MusicRole, MusicTrack> = {
  menu: { src: "/audio/menu.ogg", gain: 0.9, loop: true },
  story: { src: "/audio/story.ogg", gain: 0.9, loop: true },
  storyScene: { src: "/audio/story-scene.ogg", gain: 0.85, loop: true },
  battle: { src: "/audio/battle.ogg", gain: 1, loop: true },
  // Not looped: a completion sting should land once and get out of the way.
  victory: { src: "/audio/victory.ogg", gain: 1, loop: false },
};

export const MUSIC_ROLES = Object.keys(MUSIC_TRACKS) as MusicRole[];

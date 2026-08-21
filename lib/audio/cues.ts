/**
 * Sound-effect manifest. Callers ask for a **cue**, never a filename — the same
 * contract `tracks.ts` uses for music, so swapping what a hit sounds like is an
 * edit to this one map.
 *
 * `tracks.ts` said "no SFX bus here or anywhere (Tanveer, 2026-08-09)". He
 * reversed that on **2026-08-21**; this is the bus, and it deliberately sits
 * beside the music module rather than inside it, exactly as that note asked.
 *
 * **The files do not exist yet, and that is not a bug.** `public/audio/` ships
 * empty; a cue whose file is missing resolves to silence with no error and no
 * console noise, the same way a missing music role does. `docs/AUDIO.md` lists
 * what to drop in. **Which sounds these are is Tanveer's call** — this file
 * names the *moments* the game will ask about, which is engineering, not
 * design.
 */
export type SfxCue =
  /** A card is committed to the action queue. */
  | "cardPlay"
  /** Two cards merge into a higher rank. */
  | "cardMerge"
  /** A normal attack connects. */
  | "hit"
  /** A CRITICAL connects — deliberately its own cue, since crit is the one
   *  outcome a player should hear without reading the number. */
  | "critical"
  /** An attack is evaded. */
  | "evade"
  /** An ultimate fires. */
  | "ultimate"
  /** A unit drops to zero. */
  | "defeat"
  /** The turn resolves and passes over. */
  | "turnEnd"
  /** Battle won. */
  | "victory"
  /** Battle lost. */
  | "defeatScreen";

export interface SfxDefinition {
  src: string;
  /** Per-cue level trim (0–1). Cues arrive at different loudness and this is
   *  where that is evened out without re-exporting the file. */
  gain: number;
  /**
   * Ignore repeat requests within this many milliseconds.
   *
   * A three-action turn resolving an AoE can ask for `hit` eight times inside
   * one animation frame; without a throttle that is one loud click, not eight
   * hits. Zero means every request plays.
   */
  throttleMs: number;
}

export const SFX: Record<SfxCue, SfxDefinition> = {
  cardPlay: { src: "/audio/sfx/card-play.ogg", gain: 0.7, throttleMs: 40 },
  cardMerge: { src: "/audio/sfx/card-merge.ogg", gain: 0.8, throttleMs: 60 },
  hit: { src: "/audio/sfx/hit.ogg", gain: 0.85, throttleMs: 60 },
  critical: { src: "/audio/sfx/critical.ogg", gain: 1, throttleMs: 60 },
  evade: { src: "/audio/sfx/evade.ogg", gain: 0.7, throttleMs: 60 },
  ultimate: { src: "/audio/sfx/ultimate.ogg", gain: 1, throttleMs: 200 },
  defeat: { src: "/audio/sfx/defeat.ogg", gain: 0.9, throttleMs: 120 },
  turnEnd: { src: "/audio/sfx/turn-end.ogg", gain: 0.6, throttleMs: 200 },
  victory: { src: "/audio/sfx/victory.ogg", gain: 1, throttleMs: 0 },
  defeatScreen: { src: "/audio/sfx/defeat-screen.ogg", gain: 1, throttleMs: 0 },
};

export const SFX_CUES = Object.keys(SFX) as SfxCue[];

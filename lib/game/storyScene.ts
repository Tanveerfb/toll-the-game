import type { StoryScene } from "@/types/story";

/**
 * Reveal speed. Story prose runs long — Part 1 opens with a ~300-character
 * narration block — so this is tuned against a paragraph, not a one-line
 * quip: 14ms/char puts that block a little over 4 seconds, brisk enough to
 * read with the reveal rather than wait on it. Tap-to-complete covers anyone
 * who still finds it slow.
 */
export const TYPEWRITER_MS_PER_CHAR = 14;

/** Auto-advance dwell once a line is fully revealed: a floor so short lines
 *  don't flash past, plus time proportional to how much there is to read. */
export const AUTO_ADVANCE_FLOOR_MS = 900;
export const AUTO_ADVANCE_MS_PER_CHAR = 45;

/**
 * How much of `text` is visible `elapsed` ms into the reveal.
 *
 * `instant` (reduced motion, or the player tapping to complete) short-circuits
 * to the whole string — the reveal must never become an obstacle.
 */
export function revealedLength(
  text: string,
  elapsed: number,
  instant = false,
): number {
  if (instant) return text.length;
  if (elapsed <= 0) return 0;
  return Math.min(text.length, Math.floor(elapsed / TYPEWRITER_MS_PER_CHAR));
}

export function isRevealComplete(
  text: string,
  elapsed: number,
  instant = false,
): boolean {
  return revealedLength(text, elapsed, instant) >= text.length;
}

/** Total time a full reveal takes, used to schedule auto-advance. */
export function revealDurationMs(text: string): number {
  return text.length * TYPEWRITER_MS_PER_CHAR;
}

export function autoAdvanceDelayMs(text: string): number {
  return AUTO_ADVANCE_FLOOR_MS + text.length * AUTO_ADVANCE_MS_PER_CHAR;
}

/**
 * What a tap does right now — the standard visual-novel contract, and the
 * reason a long block stops being a wall of text: the first tap finishes the
 * line, only the second moves on.
 */
export type TapIntent = "complete" | "advance";

export function tapIntent(
  text: string,
  elapsed: number,
  instant = false,
): TapIntent {
  return isRevealComplete(text, elapsed, instant) ? "advance" : "complete";
}

/**
 * Narration gets a visibly different treatment from dialogue — they used to
 * render identically, which is why an eight-panel intro read as one
 * undifferentiated block.
 *
 * A scene counts as narration when it has no speaker **or** when its speaker
 * is the narrator. Part 1 authors most of its prose as `"speaker": "Narrator"`,
 * and rendering that in a character dialogue box with a NARRATOR name plate
 * treats the camera as a cast member.
 */
const NARRATOR_SPEAKERS = new Set(["narrator"]);

export function isNarration(scene: StoryScene): boolean {
  if (!scene.speaker) return true;
  return NARRATOR_SPEAKERS.has(scene.speaker.trim().toLowerCase());
}

export interface PortraitSlots {
  left: string | null;
  right: string | null;
}

/**
 * Which portrait each side should show for `index`, given everything before
 * it: the active speaker on their own side, and **the last speaker to appear
 * on the opposite side, retained**.
 *
 * Retention is the point. Today only the active side is mounted, so a
 * two-hander is a single portrait popping between two empty slots instead of
 * looking like a conversation. The component dims the non-active side.
 */
export function portraitSlotsAt(
  scenes: StoryScene[],
  index: number,
): PortraitSlots {
  const slots: PortraitSlots = { left: null, right: null };
  for (let i = 0; i <= index && i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene.portraitId) continue;
    const side = scene.side ?? "left";
    slots[side] = scene.portraitId;
  }
  return slots;
}

/** The side whose portrait is speaking at `index`, or null for narration and
 *  for lines with no portrait of their own. */
export function activeSideAt(
  scenes: StoryScene[],
  index: number,
): "left" | "right" | null {
  const scene = scenes[index];
  if (!scene?.portraitId) return null;
  return scene.side ?? "left";
}

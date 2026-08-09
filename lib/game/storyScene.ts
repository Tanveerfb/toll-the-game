import type { StoryScene } from "@/types/story";

/**
 * Reveal pacing.
 *
 * A character-by-character typewriter was the first attempt and it read badly
 * (Tanveer, 2026-08-09: *"I have to wait for it to complete to start
 * reading"*). Two reasons, both structural rather than a matter of speed:
 * the eye can't parse a half-finished word, and slicing the string reflows
 * the paragraph on every wrap, so the text keeps moving under you.
 *
 * So: reveal by **word**, with the full text laid out from the first frame and
 * only its opacity animating. Nothing reflows, which means the line can be
 * read ahead of the animation instead of after it. The stagger is also capped
 * — past `MAX_REVEAL_MS` a long paragraph reveals no slower than a short one,
 * because the point is a sense of arrival, not a reading speed limit.
 */
export const WORD_STAGGER_MS = 22;
export const MAX_REVEAL_MS = 650;
/** How long one word takes to fade up, once its turn arrives. */
export const WORD_FADE_MS = 220;

/** Auto-advance dwell once a line is fully revealed: a floor so short lines
 *  don't flash past, plus time proportional to how much there is to read. */
export const AUTO_ADVANCE_FLOOR_MS = 900;
export const AUTO_ADVANCE_MS_PER_CHAR = 45;

/**
 * Splits into words with their trailing whitespace attached, so re-joining the
 * pieces reproduces the source exactly and no space is lost between spans.
 */
export function splitWords(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

/** Total stagger across every word, before each word's own fade. */
export function staggerDurationMs(text: string): number {
  const words = splitWords(text).length;
  if (words <= 1) return 0;
  return Math.min((words - 1) * WORD_STAGGER_MS, MAX_REVEAL_MS);
}

/** When the last word has finished fading in — what "complete" means. */
export function revealDurationMs(text: string): number {
  if (!text) return 0;
  return staggerDurationMs(text) + WORD_FADE_MS;
}

/**
 * Delay before word `index` starts fading. Spread across the capped window, so
 * word count changes the density of the stagger rather than its length.
 */
export function wordDelayMs(index: number, text: string): number {
  const words = splitWords(text).length;
  if (words <= 1) return 0;
  return (staggerDurationMs(text) * Math.min(index, words - 1)) / (words - 1);
}

export function isRevealComplete(
  text: string,
  elapsed: number,
  instant = false,
): boolean {
  if (instant) return true;
  return elapsed >= revealDurationMs(text);
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

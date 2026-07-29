/**
 * Structured passive-description format (Tanveer 2026-07-29): a passive is
 * authored as one or more trigger/condition headings, each followed by the
 * effect(s) that happen under it, with optional clarifying sub-notes:
 *
 * ```
 * # When finishing a turn without receiving damage
 * - All enemies max HP 8% 👇 (Max 5 times) (Uncancellable)
 * -- Effects reset after receiving damage
 * ```
 *
 * `#` = heading (the trigger/condition — becomes part of the displayed
 * passive, not just an internal label). `-` = an effect bullet. `--` = a
 * comment/clarifier attached to the immediately preceding bullet, rendered
 * smaller and dimmer. The arrows themselves (👇/👆) are handled by
 * KeyworkHighlighter, not here — this module only splits the raw text into
 * sections/bullets/comments; each bullet's text is still run through
 * KeyworkHighlighter for number/arrow/keyword rendering.
 */

export interface PassiveMarkupBullet {
  text: string;
  comments: string[];
}

export interface PassiveMarkupSection {
  heading: string;
  bullets: PassiveMarkupBullet[];
}

const HEADING_PREFIX = "# ";
const COMMENT_PREFIX = "-- ";
const BULLET_PREFIX = "- ";

/** True if `description` uses the structured `#`/`-`/`--` format rather than
 *  old-style flat prose — callers branch rendering on this. */
export function isStructuredPassiveMarkup(description: string): boolean {
  return description
    .split("\n")
    .some((line) => line.trim().startsWith(HEADING_PREFIX));
}

export function parsePassiveMarkup(description: string): PassiveMarkupSection[] {
  const lines = description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const sections: PassiveMarkupSection[] = [];
  let current: PassiveMarkupSection | null = null;

  for (const line of lines) {
    if (line.startsWith(HEADING_PREFIX)) {
      current = { heading: line.slice(HEADING_PREFIX.length).trim(), bullets: [] };
      sections.push(current);
    } else if (line.startsWith(COMMENT_PREFIX)) {
      // A comment with no preceding bullet (malformed input) is dropped
      // rather than crashing — this only ever renders hand-authored content.
      const lastBullet = current?.bullets.at(-1);
      if (lastBullet) {
        lastBullet.comments.push(line.slice(COMMENT_PREFIX.length).trim());
      }
    } else if (line.startsWith(BULLET_PREFIX)) {
      if (!current) {
        current = { heading: "", bullets: [] };
        sections.push(current);
      }
      current.bullets.push({
        text: line.slice(BULLET_PREFIX.length).trim(),
        comments: [],
      });
    }
    // Any other line (shouldn't happen in well-formed markup) is ignored.
  }

  return sections;
}

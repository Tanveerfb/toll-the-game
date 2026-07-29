import { mechanicGlossary } from "@/lib/game/mechanicGlossary";

/**
 * Keyword highlight + glossary footnotes (2026-07-24 battle UI overhaul,
 * spec §5): skill/passive descriptions highlight named terms inline
 * (KeyworkHighlighter already does this), each highlighted term also gets a
 * `※` footnote glossary line. This is the pure term-extraction/lookup piece
 * — reuses lib/game/mechanicGlossary.ts, no new plumbing, just surfaced as a
 * shared, tested module instead of a private per-component copy.
 */

export interface KeywordFootnote {
  keyword: string;
  meaning: string;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every glossary term that appears as a whole word in `description`, in the
 * order it first appears in the text (not glossary/dictionary order),
 * deduped case-insensitively.
 *
 * Many glossary keys are substrings of longer, more specific ones ("raises"
 * inside "greatly raises"/"permanently raises", "lowers" inside "greatly
 * lowers", "seal"/"seals" inside "attack seal"/"attack seals", ...). Testing
 * each keyword independently (the old approach — one `\bkeyword\b` regex per
 * entry) matched BOTH the short and long form at the same spot in the text,
 * surfacing unrelated/redundant footnotes (a description that only ever says
 * "greatly raises" would also get a spurious plain "raises" footnote).
 * KeyworkHighlighter.tsx already avoids this by running ONE alternation regex
 * sorted longest-keyword-first so a longer match wins and consumes those
 * characters before a shorter one gets a chance — mirror that exact strategy
 * here so footnotes always correspond 1:1 with what's actually highlighted.
 */
export function extractKeywordFootnotes(
  description: string,
  glossary: Record<string, string> = mechanicGlossary,
): KeywordFootnote[] {
  const keywords = Object.keys(glossary).sort((a, b) => b.length - a.length);
  if (keywords.length === 0) return [];
  const pattern = new RegExp(
    `\\b(${keywords.map(escapeRegex).join("|")})\\b`,
    "gi",
  );
  const matches = [...description.matchAll(pattern)];

  const deduped: KeywordFootnote[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const normalized = match[1].toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push({ keyword: normalized, meaning: glossary[normalized] });
  }
  return deduped;
}

/** "attack seal" -> "Attack Seal" — display label for a footnote line. */
export function formatFootnoteLabel(keyword: string): string {
  return keyword
    .split(" ")
    .map((chunk) => (chunk ? chunk[0].toUpperCase() + chunk.slice(1) : chunk))
    .join(" ");
}

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
 */
export function extractKeywordFootnotes(
  description: string,
  glossary: Record<string, string> = mechanicGlossary,
): KeywordFootnote[] {
  const lowerDescription = description.toLowerCase();
  const matches = Object.entries(glossary)
    .map(([keyword, meaning]) => {
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
      const isMatched = regex.test(description);
      const position = lowerDescription.indexOf(keyword.toLowerCase());
      return { keyword, meaning, isMatched, position };
    })
    .filter((entry) => entry.isMatched)
    .sort((a, b) => a.position - b.position);

  const deduped: KeywordFootnote[] = [];
  const seen = new Set<string>();
  for (const entry of matches) {
    const normalized = entry.keyword.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push({ keyword: entry.keyword, meaning: entry.meaning });
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

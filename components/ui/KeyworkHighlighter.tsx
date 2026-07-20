"use client";

import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { mechanicGlossary } from "@/lib/game/mechanicGlossary";

// Description highlighter, 7DS-style (Tanveer 2026-07-20): mechanic keywords
// render as blue text with a hover tooltip; every number (damage %, durations,
// stacks, gauge counts) renders as amber; multi-word parenthetical limiter
// notes — "(Resets upon taking damage)", "(max 5 stacks, uncancellable)" —
// render as cyan. No category pills. A `keywordClassName` override keeps the
// deck-preview chip look.

const KEYWORD_CLASS =
  "cursor-help font-semibold text-sky-400 underline decoration-dotted decoration-sky-400/40 underline-offset-2";
const NUMBER_CLASS = "font-semibold text-amber-400";
const PAREN_CLASS = "text-cyan-300";

// A standalone number, optionally a percentage (180%, 2, 2.5).
const NUMBER_SRC = "\\d+(?:\\.\\d+)?%?";
// A parenthetical that contains a space — a limiter note, not "turn(s)"/"(s)".
const PAREN_SRC = "\\([^)]*\\s[^)]*\\)";

interface KeyworkHighlighterProps {
  text: string;
  className?: string;
  glossary?: Record<string, string>;
  keywordClassName?: string;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function KeyworkHighlighter({
  text,
  className,
  glossary,
  keywordClassName,
}: KeyworkHighlighterProps): React.JSX.Element {
  const dictionary: Record<string, string> = glossary ?? mechanicGlossary;
  const keywords = React.useMemo(
    () => Object.keys(dictionary).sort((a, b) => b.length - a.length),
    [dictionary],
  );

  const patternSource = React.useMemo(() => {
    const kw = keywords.map(escapeRegex).join("|");
    return kw
      ? `(${PAREN_SRC})|\\b(${kw})\\b|(${NUMBER_SRC})`
      : `(${PAREN_SRC})|(${NUMBER_SRC})`;
  }, [keywords]);

  const hasKeywords = keywords.length > 0;
  // Fresh regex per render (matchAll needs a global regex; a memoized one
  // can't be mutated under the React compiler's immutability rule).
  const matches = [...text.matchAll(new RegExp(patternSource, "gi"))];

  const nodes: React.ReactNode[] = [];
  let last = 0;
  matches.forEach((match, i) => {
    const idx = match.index ?? 0;
    if (idx > last) {
      nodes.push(
        <React.Fragment key={`t-${i}`}>{text.slice(last, idx)}</React.Fragment>,
      );
    }
    const parenMatch = match[1];
    const kwMatch = hasKeywords ? match[2] : undefined;
    const numMatch = hasKeywords ? match[3] : match[2];

    if (parenMatch) {
      nodes.push(
        <span key={`p-${i}`} className={PAREN_CLASS}>
          {parenMatch}
        </span>,
      );
    } else if (kwMatch) {
      const desc = dictionary[kwMatch.toLowerCase()];
      nodes.push(
        <Tooltip key={`k-${i}`}>
          <TooltipTrigger asChild>
            <span className={keywordClassName ?? KEYWORD_CLASS}>{kwMatch}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <span className="block">
              <span className="block font-body text-[10px] uppercase tracking-[0.14em] opacity-70">
                {kwMatch.toLowerCase()}
              </span>
              <span className="mt-1 block font-body text-xs">{desc}</span>
            </span>
          </TooltipContent>
        </Tooltip>,
      );
    } else if (numMatch) {
      nodes.push(
        <span key={`n-${i}`} className={NUMBER_CLASS}>
          {numMatch}
        </span>,
      );
    }

    last = idx + match[0].length;
  });
  if (last < text.length) {
    nodes.push(<React.Fragment key="t-end">{text.slice(last)}</React.Fragment>);
  }

  return <span className={className}>{nodes}</span>;
}

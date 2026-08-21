"use client";

import React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import Hint from "@/components/ui/Hint";
import {
  mechanicGlossary,
  keywordCategories,
  passiveStatVerbCategories,
} from "@/lib/game/mechanicGlossary";

const ARROW_CATEGORIES = { ...keywordCategories, ...passiveStatVerbCategories };

// Description highlighter, 7DS-style (Tanveer 2026-07-20): mechanic keywords
// render as signal text with a hover tooltip; every number (damage %,
// durations, stacks, gauge counts) renders bright; multi-word parenthetical
// limiter notes — "(Resets upon taking damage)", "(max 5 stacks,
// uncancellable)" — render dimmed. No category pills. A `keywordClassName`
// override keeps the deck-preview chip look.
//
// Numbers used to be amber. Under the Combat Terminal palette they're
// achromatic instead (`readout-strong`): a skill line already carries a
// keyword hue and sits under a skill-type accent, so a third colour on every
// digit was noise. Bright-on-dim separates them without competing.

const KEYWORD_CLASS =
  "cursor-help font-semibold text-signal underline decoration-dotted decoration-signal/40 underline-offset-2";
const NUMBER_CLASS = "font-semibold text-readout-strong";
const PAREN_CLASS = "text-readout-muted";

// A standalone number, optionally a percentage (180%, 2, 2.5).
const NUMBER_SRC = "\\d+(?:\\.\\d+)?%?";
// A parenthetical that contains a space — a limiter note, not "turn(s)"/"(s)".
const PAREN_SRC = "\\([^)]*\\s[^)]*\\)";
// Explicit author-inserted arrows (Tanveer's passive-markup format, see
// lib/game/passiveMarkup.ts): 👇 = decrease, 👆 = increase. Unambiguous —
// unlike keyword-based detection there's no false-positive risk, so this is
// always on, not gated by showStatArrows.
const EMOJI_SRC = "👇|👆";

interface KeyworkHighlighterProps {
  text: string;
  className?: string;
  glossary?: Record<string, string>;
  keywordClassName?: string;
  /** Override for numbers — heal skills pass a green class so their recovery
   *  amount reads green (7DS). Defaults to amber. */
  numberClassName?: string;
  /** Dokkan-style stat-change arrows: a green up-arrow after any keyword
   *  whose `keywordCategories` entry is "buff", a red down-arrow for
   *  "debuff". Passives only (Tanveer's call) — omitted for skill
   *  descriptions, so this defaults to false everywhere else. */
  showStatArrows?: boolean;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Which stat-change arrow (if any) a matched keyword should render. Pure
 *  and exported so the decision can be tested directly without a rendering
 *  harness (this repo has no component-test infra — see
 *  tests/keywordArrows.test.ts). */
export function arrowDirectionForKeyword(
  keyword: string,
  showStatArrows: boolean | undefined,
): "up" | "down" | null {
  if (!showStatArrows) return null;
  const category =
    ARROW_CATEGORIES[keyword.toLowerCase() as keyof typeof ARROW_CATEGORIES];
  if (category === "buff") return "up";
  if (category === "debuff") return "down";
  return null;
}

export default function KeyworkHighlighter({
  text,
  className,
  glossary,
  keywordClassName,
  numberClassName,
  showStatArrows,
}: KeyworkHighlighterProps): React.JSX.Element {
  const dictionary: Record<string, string> = glossary ?? mechanicGlossary;
  const keywords = React.useMemo(
    () => Object.keys(dictionary).sort((a, b) => b.length - a.length),
    [dictionary],
  );

  const patternSource = React.useMemo(() => {
    const kw = keywords.map(escapeRegex).join("|");
    const kwGroup = kw ? `|\\b(?<kw>${kw})\\b` : "";
    return `(?<emoji>${EMOJI_SRC})|(?<paren>${PAREN_SRC})${kwGroup}|(?<num>${NUMBER_SRC})`;
  }, [keywords]);

  // Fresh regex per render (matchAll needs a global regex; a memoized one
  // can't be mutated under the React compiler's immutability rule).
  const matches = [...text.matchAll(new RegExp(patternSource, "giu"))];

  const nodes: React.ReactNode[] = [];
  let last = 0;
  matches.forEach((match, i) => {
    const idx = match.index ?? 0;
    if (idx > last) {
      nodes.push(
        <React.Fragment key={`t-${i}`}>{text.slice(last, idx)}</React.Fragment>,
      );
    }
    const groups = match.groups ?? {};
    const emojiMatch = groups.emoji;
    const parenMatch = groups.paren;
    const kwMatch = groups.kw;
    const numMatch = groups.num;

    if (emojiMatch === "👇") {
      nodes.push(
        <ArrowDown
          key={`e-${i}`}
          className="inline h-3.5 w-3.5 text-role-attack"
          strokeWidth={3}
        />,
      );
    } else if (emojiMatch === "👆") {
      nodes.push(
        <ArrowUp
          key={`e-${i}`}
          className="inline h-3.5 w-3.5 text-role-heal"
          strokeWidth={3}
        />,
      );
    } else if (parenMatch) {
      nodes.push(
        <span key={`p-${i}`} className={PAREN_CLASS}>
          {parenMatch}
        </span>,
      );
    } else if (kwMatch) {
      const desc = dictionary[kwMatch.toLowerCase()];
      const arrow = arrowDirectionForKeyword(kwMatch, showStatArrows);
      const tooltipLabel = arrow ? "raises/lowers" : kwMatch.toLowerCase();
      // Dokkan-style: the arrow SUBSTITUTES the verb rather than decorating
      // it — "loses 50% ATK" reads as "50% ATK ↓" (Tanveer: "you don't even
      // need 'gains' in the passive anymore... arrows are substituting for
      // words like raises/lowers"). The word still drives the tooltip (hover
      // the icon for the mechanic meaning) but is no longer shown as text.
      nodes.push(
        <Hint
          key={`k-${i}`}
          ariaLabel={`${tooltipLabel} — what it means`}
          // `align-baseline` keeps the button sitting on the text's baseline
          // instead of the inline-block default, and `py-1 -my-1` grows the
          // tap area 8px without opening the line up. An inline word inside a
          // sentence is the one control that can't be 44px tall without
          // wrecking the paragraph it lives in — this is as far as it goes.
          className={`align-baseline py-1 -my-1 ${
            arrow ? "inline-flex items-center" : keywordClassName ?? KEYWORD_CLASS
          }`}
          content={
            <span className="block">
              <span className="block font-body text-[10px] uppercase tracking-[0.14em] opacity-70">
                {tooltipLabel}
              </span>
              <span className="mt-1 block font-body text-xs">{desc}</span>
            </span>
          }
        >
          {arrow === "up" ? (
            <ArrowUp
              className="inline h-3.5 w-3.5 text-role-heal"
              strokeWidth={3}
            />
          ) : arrow === "down" ? (
            <ArrowDown
              className="inline h-3.5 w-3.5 text-role-attack"
              strokeWidth={3}
            />
          ) : (
            kwMatch
          )}
        </Hint>,
      );
    } else if (numMatch) {
      nodes.push(
        <span key={`n-${i}`} className={numberClassName ?? NUMBER_CLASS}>
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

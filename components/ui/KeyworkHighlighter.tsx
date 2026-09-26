"use client";

import React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import Hint from "@/components/ui/Hint";
import {
  mechanicGlossary,
  keywordCategories,
  passiveStatVerbCategories,
  keywordStatesItsOwnValue,
} from "@/lib/game/mechanicGlossary";

const ARROW_CATEGORIES = { ...keywordCategories, ...passiveStatVerbCategories };

// Description highlighter, 7DS-style (Tanveer 2026-07-20): mechanic keywords
// render marked, and open a hint on tap (#120); every number (damage %,
// durations, stacks, gauge counts) renders bright; multi-word parenthetical
// limiter notes — "(Resets upon taking damage)", "(max 5 stacks,
// uncancellable)" — render dimmed. No category pills. A `keywordClassName`
// override keeps the deck-preview chip look.
//
// Numbers used to be amber, then achromatic bright text under Combat
// Terminal.
//
// **Shōnen Ink (2026-09-26): kit text is read on paper.** He picked the
// highlighter from three drawn options
// (`docs/design/mockups/kit-document-on-paper.html`, option B): a tappable
// keyword wears the `ink-marker`, yellow because yellow means "you can act on
// this" and a keyword opens a hint. The marker is paper-only, so every host of
// the default keyword class is a paper card. Numbers and limiter notes take
// their surface's colour (weight and opacity, not hue), so they read on any
// surface; a host that passes its own `keywordClassName` (the battle card
// preview) is unaffected by the marker.

const KEYWORD_CLASS = "ink-marker cursor-help px-0.5 font-bold";
const NUMBER_CLASS = "font-extrabold";
const PAREN_CLASS = "opacity-70";

/**
 * A stat arrow as a small fill with an ink glyph — green up, red down. The
 * hues are role colours used as a FILL, so the arrow reads on paper, where
 * the old coloured glyph alone was too faint.
 */
function StatArrow({ direction }: { direction: "up" | "down" }): React.JSX.Element {
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  return (
    <span
      className={`mx-0.5 inline-flex size-3.5 items-center justify-center border border-border align-middle text-card-foreground ${
        direction === "up" ? "bg-role-heal" : "bg-role-attack"
      }`}
    >
      <Icon className="size-2.5" strokeWidth={3} />
    </span>
  );
}

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
  /** Override for numbers — heal skills pass a green fill so their recovery
   *  amount reads green (7DS). Defaults to heavy weight in the surface's own
   *  colour. */
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
      nodes.push(<StatArrow key={`e-${i}`} direction="down" />);
    } else if (emojiMatch === "👆") {
      nodes.push(<StatArrow key={`e-${i}`} direction="up" />);
    } else if (parenMatch) {
      nodes.push(
        <span key={`p-${i}`} className={PAREN_CLASS}>
          {parenMatch}
        </span>,
      );
    } else if (
      kwMatch &&
      keywordStatesItsOwnValue(text, kwMatch, idx + match[0].length)
    ) {
      // #130: the clause already states the percentage, so the word is plain
      // text. A pill here would assert the canonical 30% over a sentence
      // naming a different number.
      nodes.push(
        <React.Fragment key={`k-${i}`}>{kwMatch}</React.Fragment>,
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
              <span className="block font-body text-label uppercase tracking-label opacity-70">
                {tooltipLabel}
              </span>
              <span className="mt-1 block font-body text-xs">{desc}</span>
            </span>
          }
        >
          {arrow === "up" ? (
            <StatArrow direction="up" />
          ) : arrow === "down" ? (
            <StatArrow direction="down" />
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

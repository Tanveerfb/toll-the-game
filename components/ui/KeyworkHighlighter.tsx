"use client";

import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  keywordCategories,
  mechanicGlossary,
  type KeywordCategory,
  type MechanicKeyword,
} from "@/lib/game/mechanicGlossary";

// Colored keyword pills (Tanveer's scheme): red = attack-based effects,
// purple = debuffs, green = heals/cleanses, yellow = stances, white = cancels.
const CATEGORY_PILL_CLASSES: Record<KeywordCategory, string> = {
  offense: "bg-red-600/90 text-white",
  debuff: "bg-purple-600/90 text-white",
  heal: "bg-emerald-600/90 text-white",
  buff: "bg-emerald-500/90 text-white",
  stance: "bg-amber-300 text-zinc-950",
  cancel: "bg-zinc-100 text-zinc-900",
};

const PILL_BASE =
  "cursor-help rounded-sm px-1 py-px font-body text-[0.8em] font-bold uppercase tracking-wide whitespace-nowrap align-baseline";

// Dynamic per-skill keys extend a static keyword with a stat suffix
// ("raises atk", "greatly lowers def") — inherit the base word's category.
function categoryForKeyword(key: string): KeywordCategory | undefined {
  const direct = keywordCategories[key as MechanicKeyword];
  if (direct) return direct;
  const base = (Object.keys(keywordCategories) as MechanicKeyword[]).find(
    (candidate) => key.startsWith(`${candidate} `),
  );
  return base ? keywordCategories[base] : undefined;
}

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

  if (keywords.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const pattern = new RegExp(
    `\\b(${keywords.map(escapeRegex).join("|")})\\b`,
    "gi",
  );
  const parts = text.split(pattern);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const key = part.toLowerCase();
        const description = dictionary[key];

        if (!description) {
          return (
            <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
          );
        }

        const category = categoryForKeyword(key);

        return (
          <Tooltip key={`${part}-${index}`}>
            <TooltipTrigger asChild>
              <span
                className={
                  keywordClassName ??
                  (category
                    ? `${PILL_BASE} ${CATEGORY_PILL_CLASSES[category]}`
                    : "cursor-help underline decoration-dotted underline-offset-3 text-foreground")
                }
              >
                {part}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <span className="block">
                <span className="block font-body text-[10px] uppercase tracking-[0.14em] opacity-70">
                  {key}
                </span>
                <span className="mt-1 block font-body text-xs">
                  {description}
                </span>
              </span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}

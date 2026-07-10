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
  stance: "bg-amber-300 text-zinc-950",
  cancel: "bg-zinc-100 text-zinc-900",
};

const PILL_BASE =
  "cursor-help rounded-sm px-1 py-px font-body text-[0.8em] font-bold uppercase tracking-wide whitespace-nowrap align-baseline";

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

        const category = keywordCategories[key as MechanicKeyword];

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

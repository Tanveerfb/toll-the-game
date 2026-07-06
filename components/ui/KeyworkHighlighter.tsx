"use client";

import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { mechanicGlossary } from "@/lib/game/mechanicGlossary";

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

        return (
          <Tooltip key={`${part}-${index}`}>
            <TooltipTrigger asChild>
              <span
                className={
                  keywordClassName ??
                  "cursor-help underline decoration-dotted underline-offset-3 text-foreground"
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

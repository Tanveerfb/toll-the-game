"use client";

import { Tooltip } from "@heroui/react";
import React from "react";
import { mechanicGlossary } from "@/lib/game/mechanicGlossary";

interface KeyworkHighlighterProps {
  text: string;
  className?: string;
  glossary?: Record<string, string>;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function KeyworkHighlighter({
  text,
  className,
  glossary,
}: KeyworkHighlighterProps): React.JSX.Element {
  const dictionary = glossary ?? mechanicGlossary;
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
          <Tooltip key={`${part}-${index}`} delay={0}>
            <Tooltip.Trigger
              className="cursor-help underline decoration-dotted underline-offset-3 text-foreground"
              render={(props) => <span {...props} />}
            >
              {part}
            </Tooltip.Trigger>
            <Tooltip.Content
              showArrow
              className="max-w-xs border border-border bg-surface text-foreground"
            >
              <Tooltip.Arrow />
              <p className="font-body text-[10px] uppercase tracking-[0.14em] text-muted">
                {key}
              </p>
              <p className="mt-1 font-body text-xs text-foreground">
                {description}
              </p>
            </Tooltip.Content>
          </Tooltip>
        );
      })}
    </span>
  );
}

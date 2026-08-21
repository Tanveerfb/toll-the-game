"use client";

import React from "react";

import KeyworkHighlighter from "@/components/ui/KeyworkHighlighter";
import {
  buildDescriptionForRank,
  buildSkillKeywordGlossary,
} from "@/lib/game/descriptionTranslator";
import {
  extractKeywordFootnotes,
  formatFootnoteLabel,
} from "@/lib/game/keywordFootnotes";
import { mechanicGlossary } from "@/lib/game/mechanicGlossary";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";
import type { ActionCard } from "@/types/action";

/**
 * What one card in hand actually does — its description resolved to this
 * card's rank, plus a footnote per mechanic it names.
 *
 * Lifted out of `Deck.tsx`'s hover preview on 2026-08-21 because it now has
 * two homes. The preview floats above the hand on hover, which a phone cannot
 * produce, so **in battle on a phone there was no way to read a skill at all**
 * — you played cards by remembering what they did. Press-and-hold opens this
 * same body in a modal (`Hand`'s `onDetail`, Tanveer 2026-08-21).
 *
 * One component rather than two renderings of the same fields, so the modal
 * cannot drift into telling a different story than the preview.
 */

export function skillPowerText(card: ActionCard): string {
  if (card.skill.type === "ultimate") return `Power ${card.skill.damage}`;
  return `Power ${card.skill.damageRanked[card.rank - 1]}`;
}

export function skillDescription(card: ActionCard): string {
  const skillData = card.skill as CharacterSkillData;
  if (!skillData.description || skillData.description.trim().length === 0) {
    return "No description available.";
  }
  return buildDescriptionForRank(skillData, card.rank - 1);
}

export default function CardDetail({
  card,
}: {
  card: ActionCard;
}): React.JSX.Element {
  const description = React.useMemo(() => skillDescription(card), [card]);

  // Tiered stat wording ("raises", "greatly lowers") resolves to this card's
  // actual numbers at its rank.
  const glossary = React.useMemo(
    () => ({
      ...mechanicGlossary,
      ...buildSkillKeywordGlossary(
        card.skill as CharacterSkillData,
        card.rank - 1,
      ),
    }),
    [card],
  );

  const footnotes = React.useMemo(
    () => extractKeywordFootnotes(description, glossary),
    [description, glossary],
  );

  return (
    <>
      <p className="font-body text-sm text-readout">
        <KeyworkHighlighter
          text={description}
          className="font-body text-sm text-readout"
          glossary={glossary}
          keywordClassName="inline-flex cursor-help items-center rounded-none border border-edge-strong bg-transparent px-1 py-[1px] font-body text-xs uppercase tracking-[0.06em] text-readout-strong"
        />
      </p>

      {footnotes.length > 0 ? (
        <>
          <div className="my-3 border-t border-edge" />
          <div className="space-y-1">
            {footnotes.map((entry) => (
              <p
                key={entry.keyword}
                className="font-body text-xs text-readout-dim"
              >
                <span className="mr-1 text-readout-muted">※</span>
                <span className="font-semibold text-signal">
                  {formatFootnoteLabel(entry.keyword)}
                </span>
                <span className="text-readout"> — {entry.meaning}</span>
              </p>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

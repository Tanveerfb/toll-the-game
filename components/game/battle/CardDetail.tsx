"use client";

import React from "react";

import KeyworkHighlighter from "@/components/ui/KeyworkHighlighter";
import {
  buildDescriptionForRank,
  buildSkillKeywordGlossary,
} from "@/lib/game/descriptionTranslator";
import { extractKeywordFootnotes } from "@/lib/game/keywordFootnotes";
import { FootnoteList } from "@/components/game/KitDetails";
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

  // Kit text is read on paper, with the archive's own marker and footnotes
  // (ruling #155): this renders inside the press-and-hold dialog and the
  // hover preview, both paper. It had its own outlined-keyword style, which is
  // how a keyword came to look different mid-fight from the kit page.
  return (
    <>
      <p className="font-body text-sm">
        <KeyworkHighlighter
          text={description}
          className="font-body text-sm"
          glossary={glossary}
        />
      </p>
      <FootnoteList footnotes={footnotes} />
    </>
  );
}

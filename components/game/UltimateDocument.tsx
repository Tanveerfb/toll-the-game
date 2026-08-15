"use client";

import React from "react";
import SkillDocument from "@/components/game/SkillDocument";
import { usePlayerStore, getCharacterProgress } from "@/store/playerStore";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";

/**
 * The ULT row on the archive page, which needs one thing the page can't give
 * it: the player's own ult level.
 *
 * The archive detail page is a server component, so it cannot read the
 * persisted store. This wrapper is the smallest possible client boundary —
 * everything about rendering the ultimate still lives in `SkillDocument`; this
 * only supplies "you are here".
 *
 * The marker is withheld until `hasHydrated` so the server render and the first
 * client render agree, matching how `CharacterProgressionPanel` and
 * `CharacterStatBars` already gate on the roster.
 */
export default function UltimateDocument({
  characterId,
  ultimate,
  storyOnly = false,
}: {
  characterId: string;
  ultimate: CharacterSkillData;
  /** Boss and NPC kits have no ult level — render the ladder unmarked. */
  storyOnly?: boolean;
}): React.JSX.Element {
  const hasHydrated = usePlayerStore((s) => s.hasHydrated);
  const owned = usePlayerStore((s) => s.roster.includes(characterId));
  const ultLevel = usePlayerStore((s) =>
    getCharacterProgress(s, characterId).ultLevel,
  );

  const marker =
    !storyOnly && hasHydrated && owned ? ultLevel : undefined;

  return (
    <SkillDocument skill={ultimate} slot="ULT" currentUltLevel={marker} />
  );
}

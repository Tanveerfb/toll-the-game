"use client";

import React from "react";
import type { CharacterSkillData } from "@/lib/game/characterCatalog";
import {
  buildRankedSkillDescriptions,
  buildSingleDescription,
} from "@/lib/game/descriptionTranslator";

export function useRankedSkillDescriptions(
  skill?: CharacterSkillData,
): string[] {
  return React.useMemo(() => {
    if (!skill) {
      return [];
    }

    return buildRankedSkillDescriptions(skill);
  }, [skill]);
}

export function useSingleSkillDescription(skill?: CharacterSkillData): string {
  return React.useMemo(() => {
    if (!skill) {
      return "To be added";
    }

    return buildSingleDescription(skill);
  }, [skill]);
}

import type { StatMultiplier } from "./statMultiplier";

export interface UltimateCard {
  skillName: string;
  url?: string;
  statMultiplier: StatMultiplier;
  damage: number;
  characterId: string;
  type: "ultimate";
}

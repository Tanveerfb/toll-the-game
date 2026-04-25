import type { StatMultiplier } from "./statMultiplier";
import type { Mechanic } from "./mechanic";

export interface UltimateCard {
  skillName: string;
  description?: string;
  url?: string;
  statMultiplier: StatMultiplier;
  damage: number;
  characterId: string;
  type: "ultimate";
  mechanics?: Mechanic[];
}

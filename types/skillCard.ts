import type { SkillType } from "./skillType";
import type { StatMultiplier } from "./statMultiplier";
import type { Mechanic } from "./mechanic";

export interface SkillCard {
  skillName: string;
  description?: string;
  url?: string;
  statMultiplier: StatMultiplier;
  /** Damage values ranked [low, mid, high] */
  damageRanked: [number, number, number];
  characterId: string;
  type: Exclude<SkillType, "ultimate">;
  mechanics?: Mechanic[];
}

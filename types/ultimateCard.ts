import type { StatMultiplier } from "./statMultiplier";
import type { Mechanic } from "./mechanic";

export interface UltimateCard {
  skillName: string;
  description?: string;
  url?: string;
  statMultiplier: StatMultiplier;
  /** Level-1 damage, and the value any unit without an ult level uses (bosses,
   *  story NPCs). Kept as the fallback so a kit that never opts into the
   *  ladder keeps working unchanged. */
  damage: number;
  /** Damage at ult levels 1–6, authored per character. Overrides `damage`
   *  whenever present — see `ultDamageForLevel` in `lib/game/progression.ts`. */
  damageByUltLevel?: number[];
  characterId: string;
  type: "ultimate";
  mechanics?: Mechanic[];
}

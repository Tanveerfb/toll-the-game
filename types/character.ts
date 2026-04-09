import type { Color } from "./color";
import type { SkillCard } from "./skillCard";
import type { UltimateCard } from "./ultimateCard";

export interface Character {
  id: string;
  name: string;
  color: Color;
  atk: number;
  def: number;
  hp: number;
  /** Exactly 2 skill cards */
  skills: [SkillCard, SkillCard];
  ultimate?: UltimateCard;
  passive?: Passive; // most characters have 1, optional for NPCs
}

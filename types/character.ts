import type { Color } from "./color";
import type { SkillCard } from "./skillCard";
import type { UltimateCard } from "./ultimateCard";
import type { Mechanic } from "./mechanic";

export interface Character {
  id: string;
  name: string;
  color: Color;
  atk: number;
  def: number;
  hp: number;
  tags?: string[]; // E.g. [FEMALE], [KHALSA]
  /** Exactly 2 skill cards */
  skills: [SkillCard, SkillCard];
  ultimate?: UltimateCard;
  passive?: any; // most characters have 1, optional for NPCs
}

export interface BattleCharacter extends Character {
  instanceId: string; // To differentiate copies of same character
  currentHP: number;
  currentAttack: number;
  currentDefense: number;
  ultGauge: number; // For Detonate checking
  buffs: Mechanic[];
  debuffs: Mechanic[];
  passiveState: Record<string, unknown>;
  team: "player" | "enemy";
}

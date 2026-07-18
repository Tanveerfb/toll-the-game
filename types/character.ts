import type { Color } from "./color";
import type { SkillCard } from "./skillCard";
import type { UltimateCard } from "./ultimateCard";
import type { StatusEffect } from "./mechanic";
import type { Passive } from "./passive";

export interface Character {
  id: string;
  name: string;
  color: Color;
  atk: number;
  def: number;
  hp: number;
  tags?: string[]; // E.g. [FEMALE], [KHALSA]
  /**
   * Enemy action-economy tier. "elite" units (named bosses) act the full
   * 3× per turn even solo; unset = low-mid and folds into the team +1 bonus.
   * See enemyActionsForTurn in lib/game/ai.ts.
   */
  tier?: "elite";
  /** Ult-gauge capacity override (default 5). Molvarr boss = 10. */
  ultGaugeMax?: number;
  /** Exactly 2 skill cards */
  skills: [SkillCard, SkillCard];
  ultimate?: UltimateCard;
  passive?: Passive; // most characters have 1, optional for NPCs
}

export interface BattleCharacter extends Character {
  instanceId: string; // To differentiate copies of same character
  currentHP: number;
  currentAttack: number;
  currentDefense: number;
  ultGauge: number; // For Detonate checking
  buffs: StatusEffect[];
  debuffs: StatusEffect[];
  passiveState: Record<string, unknown>;
  team: "player" | "enemy";
  /**
   * Sub (bench) unit: passives stay active, but the unit contributes no
   * cards, takes no AI actions, and cannot be targeted. Promoted to the
   * field when an on-field teammate dies. Absent/false = on field.
   */
  isSub?: boolean;
}

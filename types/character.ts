import type { Color } from "./color";
import type { SkillCard } from "./skillCard";
import type { UltimateCard } from "./ultimateCard";
import type { StatusEffect } from "./mechanic";
import type { Passive } from "./passive";

/**
 * A single phase of a multi-phase ("hearts") boss (7DS GC Ragnarok model). Each
 * phase has its own stat block + skill/passive set; the boss transitions to the
 * next phase when the current one's HP hits 0. Skills can be any count and there
 * can be multiple passives (unlike the 2-skill/1-passive playable kit).
 */
export interface CharacterPhase {
  hp: number;
  atk: number;
  def: number;
  skills: SkillCard[];
  /** Auto-fired special (Molvarr): NOT part of the deck/hand. The boss engine
   * forces it as the final action on a timer (bossAutoSp). */
  spSkill?: SkillCard;
  ultimate?: UltimateCard;
  passives?: Passive[];
}

export interface Character {
  id: string;
  name: string;
  color: Color;
  atk: number;
  def: number;
  hp: number;
  tags?: string[]; // E.g. [FEMALE], [KHALSA]
  /** Multi-phase boss definition. Phase 0's stats/skills seed the unit; on
   * HP 0 it transitions to the next phase (see lib/game/phases.ts). */
  phases?: CharacterPhase[];
  /**
   * Enemy action-economy tier. "elite" units (named bosses) act the full
   * 3× per turn even solo; unset = low-mid and folds into the team +1 bonus.
   * See enemyActionsForTurn in lib/game/ai.ts.
   */
  tier?: "elite";
  /** Ult-gauge capacity override (default 5). Molvarr boss = 10. */
  ultGaugeMax?: number;
  /** Immune to crowd-control debuffs (stun/freeze). Molvarr SP Passive 2. */
  ccImmune?: boolean;
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
  /** Current phase index for a multi-phase boss (0-based). Absent = phase 0. */
  phaseIndex?: number;
  /**
   * Sub (bench) unit: passives stay active, but the unit contributes no
   * cards, takes no AI actions, and cannot be targeted. Promoted to the
   * field when an on-field teammate dies. Absent/false = on field.
   */
  isSub?: boolean;
}

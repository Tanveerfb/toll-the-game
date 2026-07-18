import { SkillCard } from "./skillCard";
import { UltimateCard } from "./ultimateCard";

export interface ActionCard {
  id: string; // Unique ID for this specific card instance in the deck
  sourceInstanceId: string;
  skill: SkillCard | UltimateCard;
  rank: 1 | 2 | 3;
  targetInstanceId?: string; // Captured at selection time
}

export interface Action {
  sourceInstanceId: string;
  skill: SkillCard | UltimateCard;
  targetInstanceId: string;
  /** Card rank at resolution time. Absent (AI/legacy) means rank 1. Ultimates ignore it. */
  rank?: 1 | 2 | 3;
  /** When the AI played from its hand: the consumed card's id (battle loop
   * removes it). Absent for the legacy skill-based path. */
  cardId?: string;
}

export type TurnActions = (Action | null)[];

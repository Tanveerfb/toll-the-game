import { SkillCard } from "./skillCard";
import { UltimateCard } from "./ultimateCard";

export interface ActionCard {
  id: string; // Unique ID for this specific card instance in the deck
  sourceInstanceId: string;
  skill: SkillCard | UltimateCard;
  targetInstanceId?: string; // Captured at selection time
}

export interface Action {
  sourceInstanceId: string;
  skill: SkillCard | UltimateCard;
  targetInstanceId: string;
}

export type TurnActions = (Action | null)[];


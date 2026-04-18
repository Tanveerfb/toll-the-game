import { SkillCard } from "./skillCard";
import { UltimateCard } from "./ultimateCard";

export interface Action {
  sourceInstanceId: string;
  skill: SkillCard | UltimateCard;
  targetInstanceId: string;
}

export type TurnActions = (Action | null)[];

export type BattlePhase =
  | "initializing"
  | "OnBattleStart"
  | "OnPlayerTurnStart"
  | "PlayerAction"
  | "OnPlayerTurnEnd"
  | "OnEnemyTurnStart"
  | "EnemyAction"
  | "OnEnemyTurnEnd"
  | "victory"
  | "defeat";

export type MechanicType =
  | "aoe"
  | "pierce"
  | "weakpoint"
  | "ignite"
  | "detonate"
  | "conditionalBuff"
  | "conditionalDebuff"
  | "damageOverTime"
  | "healOverTime"
  | "decay"
  | "consumeIgnite"
  | "buff"
  | "debuff"
  | "heal";

export interface Mechanic {
  type: MechanicType;
  valueRanked?: [number, number, number];
  stacksRanked?: [number, number, number];
  stacks?: number;
  value?: number;
  targethasBuff?: boolean;
  targethasDebuff?: boolean;
  buffDuration?: number;
  debuffDuration?: number;
  duration?: number;
  targetdefense?: number;
  targetdamageReduction?: number;
  
  // New dynamic fields
  damagePercent?: number;
  valuePercent?: number;
  valuePerStackPercent?: number;
  effect?: string;
  stat?: string;
  unstackable?: boolean;
  uncancellable?: boolean;
  conditionStacks?: number;
  maxTriggers?: number;
  
  // Runtime calculated fields
  capturedDamage?: number; 
}

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
  | "aoeRanked"
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
  | "heal"
  | "stance"
  | "stun"
  | "taunt"
  | "cleanse"
  | "cancelBuffs"
  | "cancelStances"
  | "lowerUltGauge"
  | "spite"
  | "concentrate"
  | "amplify";

export interface Mechanic {
  type: MechanicType;
  valueRanked?: [number, number, number];
  stacksRanked?: [number, number, number];
  durationRanked?: [number, number, number];
  ranks?: boolean[];
  sourceId?: string;
  targetSelf?: boolean;
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

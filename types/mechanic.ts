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
  | "healOverTime";

export interface Mechanic {
  type: MechanicType;
  valueRanked?: [number, number, number];
  stacks?: number;
  value?: number;
  targethasBuff?: boolean;
  targethasDebuff?: boolean;
  buffDuration?: number;
  debuffDuration?: number;
  targetdefense?: number;
  targetdamageReduction?: number;
}

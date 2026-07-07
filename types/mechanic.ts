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
  | "amplify"
  | "shock"
  | "critical"
  | "synergy"
  | "chargedStacks"
  | "lifesteal"
  | "extort"
  | "rupture"
  | "seal"
  | "counterStance"
  | "deathblow"
  | "maxHpShred"
  | "turnRamp";

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
  maxStacks?: number;
  damageBonusPercent?: number;
  atkDownPercent?: number;
  atkDownDuration?: number;
  name?: string;
  ignoreDefensePercent?: number; // critical: % of DEF ignored
  evadePerStackPercent?: number; // chargedStacks: evade chance per stack
  atkPerStackPercent?: number; // chargedStacks: ATK per stack
  defPerStackPercent?: number; // chargedStacks: DEF per stack
  conditionTags?: string[]; // synergy: tags that receive the bonus
  flatBonus?: boolean; // synergy: true = flat %, not scaled per tag carrier
  preApplied?: boolean; // display badge for a gain already baked into current stats
  counterDamagePercent?: number; // counterStance: % of ATK dealt back to attackers
  counterDamagePercentRanked?: [number, number, number];
  sealType?: string; // seal: which skill type is sealed (e.g. "attack")
  atkStolen?: number; // extort runtime: flat ATK points taken
  defStolen?: number; // extort runtime: flat DEF points taken
  flatValue?: number; // buff/debuff: flat stat points instead of a percent

  // Runtime calculated fields
  capturedDamage?: number; 
}

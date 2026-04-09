type PassiveTrigger =
  | "onBattleStart"
  | "onAllyTurn"
  | "onEnemyTurn"
  | "onEnemyKill"
  | "onAllyKill"
  | "onAllyDeath"
  | "onHit"
  | "onDamageTaken"
  | "onHeal"
  | "onBuffApply"
  | "onBuffExpire"
  | "onDebuffApply"
  | "onDebuffExpire"
  | "onStatusEffectApply"
  | "onStatusEffectExpire"
  | "onCriticalHit"
  | "afterSkill ";

export interface Passive {
  name: string;
  trigger: PassiveTrigger;
  description: string;
  mechanics: Mechanic[]; // multiple effects from one trigger
}

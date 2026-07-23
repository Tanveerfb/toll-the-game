import type { Mechanic } from "./mechanic";

/**
 * Passive triggers actually consumed by the engine:
 * - Phase-queue passives map through `mapTriggerToPhase` in lib/game/passive.ts
 *   ("onBattleStart", "aura", and the On*Turn* phase names).
 * - Inline combat passives are keyed on the rest inside combat.ts / tick.ts.
 * Kit-authored triggers not in this list are a compile/load error — add the
 * trigger here AND its handling in the engine together.
 */
export type PassiveTrigger =
  | "onBattleStart"
  | "aura"
  | "always"
  | "beforeSkill"
  | "afterSkill"
  | "onFirstAction"
  | "onAllySkill"
  | "onAttackReceived"
  | "onLethalDamage"
  | "onDamageDealt"
  | "onRoundEnd"
  | "onNewTurn"
  | "onIgniteConsume"
  | "OnPlayerTurnStart"
  | "OnPlayerTurnEnd"
  | "OnEnemyTurnStart"
  | "OnEnemyTurnEnd";

export interface Passive {
  name: string;
  description?: string;
  trigger: PassiveTrigger;
  /**
   * Whether the passive stays active from the bench. Default-deny: absent
   * or false means it does NOT work from sub (Tanveer ruling 2026-07-24 —
   * most passives need field presence to interact with enemies/allies).
   * Set true only for passives that just grant buffs/effects with no
   * interaction requirement (e.g. Leorio, Mustafa, Gabrist).
   */
  worksFromSub?: boolean;
  mechanics?: Mechanic[];
}

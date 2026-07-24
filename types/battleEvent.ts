import type { Color } from "./color";

/**
 * Structured record of one resolved action (one executeSkill call), emitted
 * by the combat engine alongside the human-readable battle log. The UI
 * animation sequencer replays these — it must never parse log strings.
 */

export interface BattleEventTarget {
  instanceId: string;
  name: string;
  /** Damage dealt to this target (post-mitigation, floored) */
  damage?: number;
  /** HP restored to this target */
  heal?: number;
  evaded?: boolean;
  crit?: boolean;
  /** Target hit 0 HP from this action */
  killed?: boolean;
  /** Lethal survival passive caught the hit (Nine Lives) */
  survivedLethal?: boolean;
  /** Exact HP snapshots so the sequencer can replay bars without drift */
  hpBefore?: number;
  hpAfter?: number;
}

export interface BattleEventCounter {
  byInstanceId: string;
  byName: string;
  onInstanceId: string;
  damage: number;
  killedAttacker: boolean;
  attackerHpAfter: number;
}

export interface BattleActionEvent {
  kind: "action";
  sourceInstanceId: string;
  sourceName: string;
  sourceTeam: "player" | "enemy";
  sourceColor: Color;
  /** Character id (not instance) — used to look up cut-in art */
  sourceCharacterId: string;
  skillName: string;
  skillType: string;
  isUlt: boolean;
  /** Played card's rank (1-3). Undefined/legacy paths default to 1 in the
   *  sequencer. Ignored for ultimates — they're their own reveal tier. */
  rank?: 1 | 2 | 3;
  targets: BattleEventTarget[];
  counters: BattleEventCounter[];
}

export interface BattleTickTarget {
  instanceId: string;
  name: string;
  hpBefore: number;
  hpAfter: number;
}

/**
 * A non-action HP change — DoT/Corrosion, HoT regen, a boss's turn-start
 * drain or stat-spike self-heal. No attacker/skill, so the sequencer plays
 * these without a lunge: just a per-target flash/floater so the bar never
 * silently snaps to a "future" value ahead of any animation.
 */
export interface BattleTickEvent {
  kind: "tick";
  /** Short label for context (not currently rendered, reserved for a future
   *  on-tile tag) — e.g. "Corrosion", "Regeneration", "Decay". */
  label: string;
  targets: BattleTickTarget[];
}

export type AnyBattleEvent = BattleActionEvent | BattleTickEvent;

export type BattleEventEmitter = (event: BattleActionEvent) => void;
export type AnyBattleEventEmitter = (event: AnyBattleEvent) => void;

import type { Color } from "./color";
import type { StatusEffectType } from "./mechanic";

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
  /** Damage was intended against this target and resolved to 0 — the hit was
   *  fully absorbed. Ruling #71: the UI shows "Tanked" rather than a 0, and
   *  the engine skips the after-effects that only exist because a hit landed.
   *  Distinct from `evaded`, which means the hit never connected at all. */
  tanked?: boolean;
  crit?: boolean;
  /** Target hit 0 HP from this action */
  killed?: boolean;
  /** Lethal survival passive caught the hit (Nine Lives) */
  survivedLethal?: boolean;
  /** Exact HP snapshots so the sequencer can replay bars without drift */
  hpBefore?: number;
  hpAfter?: number;
}

/**
 * One status entry as it landed on (or left) a character during an action.
 *
 * A flattened, presentation-free view of `StatusEffect` — the drawer must not
 * reach into the live runtime entry, which carries bookkeeping fields
 * (`hpScalePercent`, `sourceId`, `preApplied`) that mean nothing to a reader.
 */
export interface BattleEventEffect {
  /** Which array it sits in. Sign and colour come from this, not from `type`:
   *  a debuff's `valuePercent` is stored positive. */
  slot: "buff" | "debuff";
  type: StatusEffectType;
  name?: string;
  stat?: string;
  stats?: string[];
  valuePercent?: number;
  /** Flat per-tick damage/heal for DoTs and HoTs. */
  value?: number;
  /** Whichever of buffDuration/debuffDuration applied. */
  duration?: number;
  sealType?: string;
  uncancellable?: boolean;
  debuffImmune?: boolean;
}

/**
 * Everything that changed about one character's statuses across one action.
 *
 * Deliberately keyed by character rather than nested under `targets`: a skill
 * routinely moves statuses on units that were never targeted — a self buff, an
 * `applyTo: "allies"` grant, an Extort link dying on a third party (ruling
 * #32), a defeat passive. Nesting under `targets` would have silently dropped
 * exactly those, which is the failure Open Issue #22 describes.
 */
export interface BattleEventEffectChange {
  instanceId: string;
  name: string;
  applied: BattleEventEffect[];
  removed: BattleEventEffect[];
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
  /** Status changes this action caused, per character. Absent on legacy
   *  events and on engine paths that ran without an emitter. */
  effects?: BattleEventEffectChange[];
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
  /** Statuses that expired (or, for a boss turn-start passive, landed) on this
   *  tick. Compared at **identity** rather than full equality — a tick
   *  decrements every surviving duration, and reporting those as changes would
   *  redraw the whole board once a turn. See `diffEffectIdentities`. */
  effects?: BattleEventEffectChange[];
  /** Short label for context (not currently rendered, reserved for a future
   *  on-tile tag) — e.g. "Corrosion", "Regeneration", "Decay". */
  label: string;
  targets: BattleTickTarget[];
}

export type AnyBattleEvent = BattleActionEvent | BattleTickEvent;

export type BattleEventEmitter = (event: BattleActionEvent) => void;
export type AnyBattleEventEmitter = (event: AnyBattleEvent) => void;

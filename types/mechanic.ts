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

/**
 * Kit-authored mechanics (STATUS #7 refactor): a discriminated union keyed
 * on `type`. Narrowing on `type` exposes exactly that mechanic's fields —
 * a typo'd field or a field on the wrong mechanic is now a compile error,
 * and `characterSchema.ts` rejects unknown `type` strings at load time.
 *
 * Shared base carries the rank-array fields plus the scalars
 * `normalizeMechanic` resolves them into at execution time.
 */
interface MechanicBase {
  /** Rank-scaled values [R1, R2, R3] — resolved into the scalar twins below. */
  valueRanked?: number[];
  stacksRanked?: number[];
  durationRanked?: number[];
  counterDamagePercentRanked?: number[];
  /** Normalized scalars (written by normalizeMechanic, or authored flat). */
  value?: number;
  stacks?: number;
  duration?: number;
  counterDamagePercent?: number;
  /** Display/flavor fields allowed anywhere. */
  name?: string;
  description?: string;
  triggerText?: string;
}

// --- Targeting / damage-shape flags -------------------------------------
export interface AoeMechanic extends MechanicBase {
  type: "aoe";
}
export interface AoeRankedMechanic extends MechanicBase {
  type: "aoeRanked";
  /** Per-rank activation, e.g. [false, true, true]. */
  ranks: boolean[];
}
export interface PierceMechanic extends MechanicBase {
  type: "pierce"; // flat 50% DEF ignore (ruling #27); explicit `value` wins
}
export interface WeakpointMechanic extends MechanicBase {
  type: "weakpoint";
}
export interface RuptureMechanic extends MechanicBase {
  type: "rupture";
}
export interface DetonateMechanic extends MechanicBase {
  type: "detonate";
}
export interface ConcentrateMechanic extends MechanicBase {
  type: "concentrate";
}
export interface SpiteMechanic extends MechanicBase {
  type: "spite";
}
export interface AmplifyMechanic extends MechanicBase {
  type: "amplify";
  valuePercent?: number; // % damage per cancellable buff on the user
}
export interface CriticalMechanic extends MechanicBase {
  type: "critical";
  ignoreDefensePercent?: number;
  damageBonusPercent?: number;
}

// --- Stat changes / stances ----------------------------------------------
export interface BuffMechanic extends MechanicBase {
  type: "buff";
  stat?: string;
  valuePercent?: number;
  targetSelf?: boolean;
  unstackable?: boolean;
  uncancellable?: boolean;
  maxStacks?: number; // Duke's Flowing Ruin stack counter
}
export interface DebuffMechanic extends MechanicBase {
  type: "debuff";
  stat?: string;
  valuePercent?: number;
  targetSelf?: boolean;
}
export interface StanceMechanic extends MechanicBase {
  type: "stance";
  stat?: string;
  valuePercent?: number;
  targetSelf?: boolean;
  unstackable?: boolean;
  uncancellable?: boolean;
}
export interface HealMechanic extends MechanicBase {
  type: "heal";
  valuePercent?: number;
  targetSelf?: boolean;
}
export interface CleanseMechanic extends MechanicBase {
  type: "cleanse";
  targetSelf?: boolean;
}
export interface CancelBuffsMechanic extends MechanicBase {
  type: "cancelBuffs";
}
export interface CancelStancesMechanic extends MechanicBase {
  type: "cancelStances";
}

// --- Debuff applications ---------------------------------------------------
export interface StunMechanic extends MechanicBase {
  type: "stun";
}
export interface TauntMechanic extends MechanicBase {
  type: "taunt";
}
export interface SealMechanic extends MechanicBase {
  type: "seal";
  sealType?: string; // which skill type is sealed (e.g. "attack")
}
export interface ShockMechanic extends MechanicBase {
  type: "shock";
  damagePercent?: number; // % of the applying hit dealt per tick
}
export interface BleedMechanic extends MechanicBase {
  type: "bleed";
  damagePercent?: number;
}
export interface DecayMechanic extends MechanicBase {
  type: "decay";
  damagePercent?: number;
}
export interface IgniteMechanic extends MechanicBase {
  type: "ignite";
}
export interface ConsumeIgniteMechanic extends MechanicBase {
  type: "consumeIgnite";
  effect?: string; // e.g. "buffAtk"
  valuePerStackPercent?: number;
}
export interface LowerUltGaugeMechanic extends MechanicBase {
  type: "lowerUltGauge";
}
export interface GainUltGaugeMechanic extends MechanicBase {
  type: "gainUltGauge";
}
export interface LifestealMechanic extends MechanicBase {
  type: "lifesteal";
  valuePercent?: number;
}
export interface ExtortMechanic extends MechanicBase {
  type: "extort";
  valuePercent?: number;
}

// --- Passive-only mechanics -------------------------------------------------
export interface SynergyMechanic extends MechanicBase {
  type: "synergy";
  conditionTags?: string[];
  conditionColors?: string[];
  stat: string;
  valuePercent: number;
  /** true = flat % per carrier; absent = scales with carrier count (ruling #35). */
  flatBonus?: boolean;
}
export interface AuraMechanic extends MechanicBase {
  type: "aura";
  stat: string;
  valuePercent: number;
  conditionNoDeadAllies?: boolean;
}
export interface CharacterSynergyMechanic extends MechanicBase {
  type: "characterSynergy";
  requiredCharacterIds: string[];
  stat?: string;
  valuePercent?: number;
  bothAliveBonusPercent?: number;
}
export interface ChargedStacksMechanic extends MechanicBase {
  type: "chargedStacks";
  maxStacks?: number;
  atkPerStackPercent?: number;
  defPerStackPercent?: number;
  evadePerStackPercent?: number;
}
export interface DeathblowMechanic extends MechanicBase {
  type: "deathblow";
  hpStepPercent?: number;
  critPerStepPercent?: number;
  damagePerStepPercent?: number;
}
export interface MaxHpShredMechanic extends MechanicBase {
  type: "maxHpShred";
  valuePercent?: number;
  maxStacks?: number;
}
export interface TurnRampMechanic extends MechanicBase {
  type: "turnRamp";
  valuePercent?: number;
  maxStacks?: number;
}
export interface MomentumStacksMechanic extends MechanicBase {
  type: "momentumStacks";
  valuePercent: number;
  maxStacks: number;
}
export interface StatShiftAfterAttacksMechanic extends MechanicBase {
  type: "statShiftAfterAttacks";
  attacksRequired?: number;
  atkShiftPercent?: number;
  defShiftPercent?: number;
  maxTriggers?: number;
}
export interface SurviveLethalMechanic extends MechanicBase {
  type: "surviveLethal";
  hpConditionPercent?: number;
  healDamagePercent?: number;
}
export interface ConsumeHpPercentMechanic extends MechanicBase {
  type: "consumeHpPercent";
  valuePercent: number;
}
export interface HealLifestealMechanic extends MechanicBase {
  type: "healLifesteal";
  hpConditionPercent: number;
  lifestealPercent: number;
}
export interface ConditionalBuffMechanic extends MechanicBase {
  type: "conditionalBuff"; // Duke's Flowing Ruin consume
  conditionStacks?: number;
  damageBonusPercent?: number;
  atkDownPercent?: number;
  atkDownDuration?: number;
  stat?: string;
}

export type Mechanic =
  | AoeMechanic
  | AoeRankedMechanic
  | PierceMechanic
  | WeakpointMechanic
  | RuptureMechanic
  | DetonateMechanic
  | ConcentrateMechanic
  | SpiteMechanic
  | AmplifyMechanic
  | CriticalMechanic
  | BuffMechanic
  | DebuffMechanic
  | StanceMechanic
  | HealMechanic
  | CleanseMechanic
  | CancelBuffsMechanic
  | CancelStancesMechanic
  | StunMechanic
  | TauntMechanic
  | SealMechanic
  | ShockMechanic
  | BleedMechanic
  | DecayMechanic
  | IgniteMechanic
  | ConsumeIgniteMechanic
  | LowerUltGaugeMechanic
  | GainUltGaugeMechanic
  | LifestealMechanic
  | ExtortMechanic
  | SynergyMechanic
  | AuraMechanic
  | CharacterSynergyMechanic
  | ChargedStacksMechanic
  | DeathblowMechanic
  | MaxHpShredMechanic
  | TurnRampMechanic
  | MomentumStacksMechanic
  | StatShiftAfterAttacksMechanic
  | SurviveLethalMechanic
  | ConsumeHpPercentMechanic
  | HealLifestealMechanic
  | ConditionalBuffMechanic;

export type MechanicType = Mechanic["type"];

/** Every mechanic `type` string legal in kit JSON — used by the Zod schema. */
export const MECHANIC_TYPES = [
  "aoe",
  "aoeRanked",
  "pierce",
  "weakpoint",
  "rupture",
  "detonate",
  "concentrate",
  "spite",
  "amplify",
  "critical",
  "buff",
  "debuff",
  "stance",
  "heal",
  "cleanse",
  "cancelBuffs",
  "cancelStances",
  "stun",
  "taunt",
  "seal",
  "shock",
  "bleed",
  "decay",
  "ignite",
  "consumeIgnite",
  "lowerUltGauge",
  "gainUltGauge",
  "lifesteal",
  "extort",
  "synergy",
  "aura",
  "characterSynergy",
  "chargedStacks",
  "deathblow",
  "maxHpShred",
  "turnRamp",
  "momentumStacks",
  "statShiftAfterAttacks",
  "surviveLethal",
  "consumeHpPercent",
  "healLifesteal",
  "conditionalBuff",
] as const satisfies readonly MechanicType[];

/**
 * Runtime status entries living on BattleCharacter.buffs/debuffs. One shape
 * (not discriminated) — statuses genuinely share their fields, and ticks/UI
 * read them generically.
 */
export type StatusEffectType =
  | "buff"
  | "debuff"
  | "stance"
  | "taunt"
  | "stun"
  | "seal"
  | "ignite"
  | "decay"
  | "damageOverTime"
  | "healOverTime";

export interface StatusEffect {
  type: StatusEffectType;
  stat?: string;
  /** Percent stat modifier (buff/debuff/stance). */
  valuePercent?: number;
  /** Flat per-tick damage/heal (DoT/HoT) or flat stat points context-free. */
  value?: number;
  /** Flat stat points (Extort steals). */
  flatValue?: number;
  buffDuration?: number;
  debuffDuration?: number;
  name?: string;
  /** Author link: taunt redirect target, Extort thief (rulings #31/#32). */
  sourceId?: string;
  stacks?: number;
  unstackable?: boolean;
  /** Ruling #30: uncancellable entries are grey "effects", not buffs/debuffs. */
  uncancellable?: boolean;
  /** Display badge for a gain already baked into current stats. */
  preApplied?: boolean;
  /** Counter stance: % of ATK dealt back to attackers. */
  counterDamagePercent?: number;
  sealType?: string;
  /** Decay: damage captured from the applying hit, dealt per tick. */
  capturedDamage?: number;
}

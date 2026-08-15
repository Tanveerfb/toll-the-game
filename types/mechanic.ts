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
  /**
   * Ult-level-scaled values [UL1…UL6] — the ultimate's answer to the rank
   * arrays above, and resolved into the same scalars.
   *
   * An ultimate has no rank, so a card ladder can't express a mechanic that
   * grows with investment. Isolde's Starbound Ward is the reference case: it
   * deals no damage at all, so `damageByUltLevel` does nothing for her and the
   * whole value of an ult level lives in the buff it grants (Tanveer,
   * 2026-08-14: ult levels "work in a similar fashion to skill ranks... only
   * one of 6 values comes to the battle").
   */
  valuePercentByUltLevel?: number[];
  valueByUltLevel?: number[];
  durationByUltLevel?: number[];
  /** Ult level at which this mechanic starts applying at all. Below it the
   *  mechanic is dropped rather than applied at zero — Isolde's Debuff
   *  Immunity only exists from ult level 3. */
  minUltLevel?: number;
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
  /** Stats this one entry covers when it modifies more than one — "raises ATK
   *  and DEF" is a single effect. See StatusEffect.stats. */
  stats?: string[];
  valuePercent?: number;
  targetSelf?: boolean;
  unstackable?: boolean;
  uncancellable?: boolean;
  maxStacks?: number; // Duke's Flowing Ruin stack counter
}
export interface DebuffMechanic extends MechanicBase {
  type: "debuff";
  stat?: string;
  /** Stats this one entry covers when it modifies more than one — "raises ATK
   *  and DEF" is a single effect. See StatusEffect.stats. */
  stats?: string[];
  valuePercent?: number;
  targetSelf?: boolean;
}
export interface StanceMechanic extends MechanicBase {
  type: "stance";
  stat?: string;
  /** Stats this one entry covers when it modifies more than one — "raises ATK
   *  and DEF" is a single effect. See StatusEffect.stats. */
  stats?: string[];
  valuePercent?: number;
  targetSelf?: boolean;
  unstackable?: boolean;
  uncancellable?: boolean;
}
export interface HealMechanic extends MechanicBase {
  type: "heal";
  valuePercent?: number;
  /** Heal a % of the target's MISSING HP (maxHP - currentHP) instead of a
   * stat/flat amount. Molvarr P1 SP Skill = 30% of diminished HP. */
  missingHpPercent?: number;
  targetSelf?: boolean;
  /** onIgniteConsume passives (Master Tao): heals once per this many Ignite
   *  stacks consumed in a single cast, capped at maxTriggers total per battle. */
  conditionStacks?: number;
  maxTriggers?: number;
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
/** Cleanses cancellable debuffs and blocks all NEW debuffs (stat-downs,
 * DoTs, stun/seal/taunt — everything, not just CC) while active. Isolde's
 * "Starbound Ward". Gated by combat.ts's `targetIsDebuffImmune` check at
 * the top of the hostile-mechanics block. */
export interface DebuffImmunityMechanic extends MechanicBase {
  type: "debuffImmunity";
  targetSelf?: boolean;
}
/**
 * Permanent immunity to stat-lowering debuffs on the named stats — narrower
 * than `debuffImmunity`, which is a temporary blanket block on every debuff
 * type. Read straight off a passive, so it is always on and cannot be
 * cleansed or cancelled.
 *
 * Exists for boss-exclusive passives: a boss whose whole fight is decided by
 * one attacker halving its ATK has no counterplay otherwise
 * (Tanveer, 2026-08-09 — Duke's Flowing Ruin vs Lyra).
 */
export interface StatDebuffImmunityMechanic extends MechanicBase {
  type: "statDebuffImmunity";
  /** Stats that can't be lowered, e.g. ["atk"]. */
  stats: string[];
}
/** Applies a Heal-over-Time worth `valuePercent`% of THIS cast's heal
 * amount, per turn, for `duration` turns. Isolde's "Threads of Renewal"
 * rejuvenate. */
export interface HealOverTimeMechanic extends MechanicBase {
  type: "healOverTime";
  valuePercent?: number;
  targetSelf?: boolean;
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
export interface CorrosionMechanic extends MechanicBase {
  type: "corrosion";
  /** % of the target's MAX HP dealt per stack per turn (default 10). Uncapped
   * stacking — each application is an independent debuff entry. */
  valuePercent?: number;
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
  stat?: string;
  /** Several stats as ONE effect. Synergies target BASIC stats
   *  (`["atk","def","hp"]`); only Seras's and Batra's use `stat: "all"`,
   *  which also reaches substats (Tanveer, 2026-08-09). */
  stats?: string[];
  valuePercent: number;
  /** true = flat % per carrier; absent = scales with carrier count (ruling #35). */
  flatBonus?: boolean;
}
export interface AuraMechanic extends MechanicBase {
  type: "aura";
  stat?: string;
  /** Several stats as ONE effect, e.g. ["atk","def","hp"] for basic stats. */
  stats?: string[];
  valuePercent: number;
  conditionNoDeadAllies?: boolean;
}
export interface CharacterSynergyMechanic extends MechanicBase {
  type: "characterSynergy";
  requiredCharacterIds: string[];
  stat?: string;
  /** Stats the BASE bond raises — basic stats by default. */
  stats?: string[];
  valuePercent?: number;
  bothAliveBonusPercent?: number;
  /** Stats the both-alive bonus raises; "all" reaches substats too. The two
   *  halves target differently on purpose (Tanveer, 2026-08-09). */
  bothAliveStat?: string;
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
/** Once the owner's team reaches phase-turn `atTurn` (displayed, 1-indexed;
 * default 3), ranks up every non-ultimate, sub-max-rank card belonging to
 * the owner currently in their hand/deck by 1. Fires once per battle
 * (guarded by passiveState.rankUpOwnDeckTriggered). Handled directly in
 * BattleProvider.tsx (the mechanic-queue's `action` callback only sees
 * `teams`, not the hand/deck store) — see store/gameStore.ts's
 * rankUpCharacterCards. Chiara's "Cut the Deck". */
export interface RankUpOwnDeckMechanic extends MechanicBase {
  type: "rankUpOwnDeck";
  atTurn?: number;
}
/** One option a `randomTurnEffect` passive can roll. */
export interface RandomEffectOption {
  target: "enemies" | "allies" | "self";
  stat: string;
  valuePercent: number;
  duration: number;
  kind: "buff" | "debuff";
}
/** Each of the owner's own team-turn starts, rolls one of `options`
 * uniformly at random and applies it (1 turn is typical, but each option
 * carries its own duration). Chiara's "Cut the Deck". */
export interface RandomTurnEffectMechanic extends MechanicBase {
  type: "randomTurnEffect";
  options: RandomEffectOption[];
}

// --- Boss-only mechanics (multi-phase "hearts" bosses) ----------------------
// These are read live from the boss's ACTIVE phase passives by the boss engine
// (lib/game/bossPassives.ts), evaluated at the boss's turn start / in combat —
// NOT registered through the OnBattleStart queue (which can't re-register on a
// phase transition). See docs/design/BOSS_MOLVARR.md.

/** Force the phase's SP Skill as the boss's final action every N phase-turns. */
export interface BossAutoSpMechanic extends MechanicBase {
  type: "bossAutoSp";
  everyNTurns?: number; // default 3
}
/** From phase-turn `fromTurn`, multiply the boss's ATK/DEF/maxHP once. Current
 * HP scales by the same ratio. Uncancellable, fires a single time per phase. */
export interface BossStatSpikeMechanic extends MechanicBase {
  type: "bossStatSpike";
  fromTurn?: number; // default 10
  multiplier?: number; // default 2 (a "100% increase")
}
/** From phase-turn `fromTurn`, each on-field enemy takes damage equal to
 * `percent`% of its MAX HP at the boss's turn start (healable; cap intact). */
export interface BossMaxHpDrainMechanic extends MechanicBase {
  type: "bossMaxHpDrain";
  fromTurn?: number; // default 10
  percent?: number; // default 10
}
/** Recomputed each boss turn: boss ATK buff = (total debuff stacks across the
 * enemy field) x `percentPerDebuff`%. Uncancellable badge, updated in place. */
export interface BossDebuffAtkMechanic extends MechanicBase {
  type: "bossDebuffAtk";
  percentPerDebuff?: number; // default 10
}
/** Apply `perTurn` Corrosion stack(s) (each `duration` turns) to every on-field
 * enemy at the boss's turn start. */
export interface BossApplyCorrosionMechanic extends MechanicBase {
  type: "bossApplyCorrosion";
  perTurn?: number; // default 1
  duration?: number; // default 2
  /** Fire only on multiples of N phase-turns (1 = every turn, the default).
   *  Molvarr P2 runs on 3 — applying it every turn compounded through
   *  Growing Malice into a several-thousand-damage ultimate (Tanveer,
   *  2026-08-13). */
  everyNTurns?: number;
}
/** The boss deals `percent`% extra damage to targets afflicted by Corrosion. */
export interface BossCorrosionBonusMechanic extends MechanicBase {
  type: "bossCorrosionBonus";
  percent?: number; // default 30
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
  | DebuffImmunityMechanic
  | StatDebuffImmunityMechanic
  | HealOverTimeMechanic
  | StunMechanic
  | TauntMechanic
  | SealMechanic
  | ShockMechanic
  | BleedMechanic
  | DecayMechanic
  | CorrosionMechanic
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
  | ConditionalBuffMechanic
  | RankUpOwnDeckMechanic
  | RandomTurnEffectMechanic
  | BossAutoSpMechanic
  | BossStatSpikeMechanic
  | BossMaxHpDrainMechanic
  | BossDebuffAtkMechanic
  | BossApplyCorrosionMechanic
  | BossCorrosionBonusMechanic;

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
  "debuffImmunity",
  "statDebuffImmunity",
  "healOverTime",
  "stun",
  "taunt",
  "seal",
  "shock",
  "bleed",
  "decay",
  "corrosion",
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
  "rankUpOwnDeck",
  "randomTurnEffect",
  "bossAutoSp",
  "bossStatSpike",
  "bossMaxHpDrain",
  "bossDebuffAtk",
  "bossApplyCorrosion",
  "bossCorrosionBonus",
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
  | "corrosion"
  | "damageOverTime"
  | "healOverTime";

export interface StatusEffect {
  type: StatusEffectType;
  stat?: string;
  /**
   * Stats this ONE entry modifies, when it covers more than one.
   *
   * "Raises ATK and DEF" is a single effect, not two — one entry, one pill,
   * one thing to cleanse (Tanveer, 2026-08-09). Distinct from `stat: "all"`,
   * which means literally every stat; `stats: ["atk","def"]` means exactly
   * those two. Read through `entryAffectsStat` in lib/game/stats.ts, never by
   * comparing `.stat` directly.
   */
  stats?: string[];
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
  /**
   * Percent by which this entry scaled the holder's MAX HP when it landed.
   *
   * Max HP isn't read through `effectiveStat` the way ATK/DEF are — it's a
   * baked number — so a durationed HP buff has to record what it did in order
   * for expiry to undo it. Without this a "+30% all stats for 3 turns" left
   * the HP raise behind forever (Tanveer, 2026-08-09).
   */
  hpScalePercent?: number;
  /** Counter stance: % of ATK dealt back to attackers. */
  counterDamagePercent?: number;
  sealType?: string;
  /** Decay: damage captured from the applying hit, dealt per tick. */
  capturedDamage?: number;
  /** Corrosion basis: true = % of MAX HP per tick (R3/ultimate only),
   *  false/absent = % of the victim's REMAINING (current) HP per tick. */
  maxHp?: boolean;
  /** Debuff Immunity: while true on an active buff, the owner resists all
   * NEW debuffs (combat.ts's `targetIsDebuffImmune` gate). Existing
   * cancellable debuffs are cleansed the moment this is granted. */
  debuffImmune?: boolean;
}

/**
 * Stage effects — per-battle modifiers that belong to the *encounter*, not to
 * any character kit (Tanveer, 2026-08-10).
 *
 * They exist so a fight can be made harder, easier or simply different without
 * editing a kit or shipping a near-duplicate character. Part 2 Chapter 2 was
 * built the wrong way first: `lyra_npc_2` was a byte-for-byte copy of
 * `lyra_npc` whose only difference was a passive line granting "All stats 5%
 * up". That duplicate drifted (it never got registered for art) and has been
 * deleted in favour of a stage effect.
 *
 * Default is **no stage effects at all** — a standard fight. Tanveer names
 * which fights get which effects.
 */

/** Which side an effect applies to. Drives the three brief sections. */
export type StageEffectTarget = "player" | "enemy" | "both";

interface StageEffectBase {
  target: StageEffectTarget;
  /** Optional authored text; otherwise generated from the effect itself. */
  description?: string;
}

/**
 * Flat percentage added to the side's stats for the whole battle, baked into
 * base stats at battle start rather than applied as a buff — a stage is not
 * something `cancelBuffs` may strip, nor something Rupture should count.
 */
export interface StatBoostStageEffect extends StageEffectBase {
  type: "statBoost";
  /** "all" reaches substats too, matching synergy semantics. */
  stat: "all" | "atk" | "def" | "hp";
  valuePercent: number;
}

/**
 * Extra actions per turn for the side. **Still capped at ACTIONS_PER_TURN (3)**
 * — this lifts a side that is under the cap (a lone unit at 2) rather than
 * raising the ceiling.
 */
export interface BonusActionsStageEffect extends StageEffectBase {
  type: "bonusActions";
  value: number;
}

export type StageEffect = StatBoostStageEffect | BonusActionsStageEffect;

export const STAGE_EFFECT_TYPES = ["statBoost", "bonusActions"] as const;
export const STAGE_EFFECT_TARGETS = ["player", "enemy", "both"] as const;

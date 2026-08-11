import type { ActionCard } from "@/types/action";

/**
 * Does this skill need a living enemy to do anything?
 *
 * Ruling #43 fizzled *every* queued card once the fight was decided, which is
 * too broad: a heal, a cleanse or a team buff still has somewhere to land when
 * the last enemy drops, and the player already paid for it (Tanveer,
 * 2026-08-11). Only the ones with nothing left to point at are cancelled.
 *
 * The discriminator for ultimates is **damage**, not type. Isolde's Starbound
 * Ward is `type: "ultimate"` with `damage: 0` and nothing but ally buffs on it
 * — it should fire. An ultimate that deals damage should not.
 */

/**
 * The three fields this actually reads. Deliberately structural rather than
 * `ActionCard["skill"]`: the same question gets asked of catalogue data
 * (`CharacterSkillData`, whose `statMultiplier` is a plain string) and of
 * built cards, and neither should have to be cast to ask it.
 */
export interface TargetableSkill {
  type: string;
  damage?: number;
  damageRanked?: number[];
}

type SkillLike = TargetableSkill;

/** Types that only ever point at an enemy. */
const ENEMY_FACING_TYPES = new Set(["attack", "debuff", "disable"]);

/** Types that only ever point at your own side. */
const ALLY_FACING_TYPES = new Set(["heal", "cleanse", "buff", "stance"]);

/**
 * Any damage at all, at any rank.
 *
 * **Only meaningful on a skill that isn't ally-facing.** `damageRanked` on a
 * `heal` is the heal magnitude, not damage — Isolde's Threads of Renewal,
 * Siddiq's Cleansing Bloom and Prism's Blessing Light all carry one. AGENTS.md
 * excludes heals from the damage rule for exactly that reason, and reading
 * this number without checking the type first cancels the heals it was
 * supposed to protect.
 */
export function dealsDamage(skill: SkillLike): boolean {
  if (ALLY_FACING_TYPES.has(skill.type)) return false;
  const flat = skill.damage ?? 0;
  if (flat > 0) return true;
  const ranked = skill.damageRanked ?? [];
  return ranked.some((value) => value > 0);
}

export function requiresEnemyTarget(skill: SkillLike): boolean {
  // Type first. An ally-facing skill never needs an enemy, whatever numbers
  // it happens to carry.
  if (ALLY_FACING_TYPES.has(skill.type)) return false;
  if (ENEMY_FACING_TYPES.has(skill.type)) return true;
  // Leaves `ultimate`, which is judged on its damage — the type says nothing
  // about where it points (Isolde's Starbound Ward is a pure ally buff).
  return dealsDamage(skill);
}

/**
 * An attacking ultimate that never got to fire isn't burned — it goes to the
 * front of the queue for next turn's draw, ahead of the random refill
 * (Tanveer, 2026-08-11). The gauge is only spent at resolution, so a cancelled
 * ultimate already keeps its charge; losing the card as well would leave a
 * full gauge with nothing to spend it on.
 */
export function returnsToDeckOnFizzle(card: ActionCard): boolean {
  return card.skill.type === "ultimate" && requiresEnemyTarget(card.skill);
}

/** Split a queue that can no longer reach an enemy into what still resolves
 *  and what is cancelled. Order is preserved on both sides. */
export function partitionOnEnemyless(cards: ActionCard[]): {
  playable: ActionCard[];
  cancelled: ActionCard[];
} {
  const playable: ActionCard[] = [];
  const cancelled: ActionCard[] = [];
  for (const card of cards) {
    if (requiresEnemyTarget(card.skill)) cancelled.push(card);
    else playable.push(card);
  }
  return { playable, cancelled };
}

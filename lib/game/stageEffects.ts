import type { StageEffect, StageEffectTarget } from "@/types/stageEffects";

type Side = "player" | "enemy";

/** True when `effect` applies to `side` ("both" applies to either). */
export function appliesTo(effect: StageEffect, side: Side): boolean {
  return effect.target === side || effect.target === "both";
}

/** Extra actions this side gets. Callers still clamp to ACTIONS_PER_TURN. */
export function bonusActionsFor(
  effects: StageEffect[] | undefined,
  side: Side,
): number {
  if (!effects?.length) return 0;
  return effects
    .filter((e) => e.type === "bonusActions" && appliesTo(e, side))
    .reduce((sum, e) => sum + (e as { value: number }).value, 0);
}

/**
 * Total percentage boost to `stat` for this side. A "all" effect counts
 * towards every stat; a stat-specific one only towards its own.
 */
export function statBoostPercentFor(
  effects: StageEffect[] | undefined,
  side: Side,
  stat: "atk" | "def" | "hp",
): number {
  if (!effects?.length) return 0;
  return effects
    .filter(
      (e): e is Extract<StageEffect, { type: "statBoost" }> =>
        e.type === "statBoost" && appliesTo(e, side),
    )
    .filter((e) => e.stat === "all" || e.stat === stat)
    .reduce((sum, e) => sum + e.valuePercent, 0);
}

/**
 * Base stats after this side's stage effects. Baked at battle start rather
 * than applied as a buff, so `cancelBuffs` can't strip the arena and Rupture
 * doesn't count it as a buff to punish.
 */
export function stageAdjustedStats(
  base: { atk: number; def: number; hp: number },
  effects: StageEffect[] | undefined,
  side: Side,
): { atk: number; def: number; hp: number } {
  const scale = (stat: "atk" | "def" | "hp") => {
    const percent = statBoostPercentFor(effects, side, stat);
    return percent === 0 ? base[stat] : Math.round(base[stat] * (1 + percent / 100));
  };
  return { atk: scale("atk"), def: scale("def"), hp: scale("hp") };
}

const STAT_LABEL: Record<string, string> = {
  all: "All stats",
  atk: "ATK",
  def: "DEF",
  hp: "HP",
};

/**
 * Display line for one effect, in the roster's arrow idiom
 * ("All stats 5% 👆 during battle").
 */
export function describeStageEffect(effect: StageEffect): string {
  if (effect.description) return effect.description;
  if (effect.type === "statBoost") {
    const label = STAT_LABEL[effect.stat] ?? effect.stat.toUpperCase();
    return `${label} ${effect.valuePercent}% 👆 during battle`;
  }
  const plural = effect.value === 1 ? "action" : "actions";
  return `+${effect.value} ${plural} per turn (max 3)`;
}

/** Grouped for the fight-brief's three sections, in display order. */
export function groupStageEffects(effects: StageEffect[] | undefined): {
  enemy: StageEffect[];
  both: StageEffect[];
  player: StageEffect[];
} {
  const list = effects ?? [];
  const pick = (target: StageEffectTarget) =>
    list.filter((e) => e.target === target);
  return { enemy: pick("enemy"), both: pick("both"), player: pick("player") };
}

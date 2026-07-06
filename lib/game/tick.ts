import { BattleCharacter } from "@/types/character";

/**
 * Turn-start system tick for one team: applies DoT/HoT, then decrements
 * buff/debuff durations and drops expired effects.
 *
 * Duration semantics: a duration of N means the effect survives N of these
 * ticks. Effects without a duration persist until removed by other means.
 * Also resets per-turn passive flags.
 */
export function tickTeamEffects(
  team: BattleCharacter[],
  log: (entry: string) => void,
): BattleCharacter[] {
  return team.map((original) => {
    if (original.currentHP <= 0) return original;

    const char = {
      ...original,
      passiveState: { ...original.passiveState },
    };

    // Reset action-specific passive flags each turn start
    char.passiveState.firstActionTriggeredThisTurn = false;

    // Apply Damage-over-Time (DoT) and Decay effects
    const dotEffects = char.debuffs.filter(
      (d) => d.type === "damageOverTime" || d.type === "decay",
    );
    let totalDot = 0;
    dotEffects.forEach((dot) => {
      if (dot.type === "decay" && dot.capturedDamage) {
        totalDot += dot.capturedDamage;
      } else if (dot.value) {
        totalDot += dot.value;
      }
    });
    if (totalDot > 0) {
      char.currentHP = Math.max(0, char.currentHP - totalDot);
      log(`[System] ${char.name} takes ${totalDot} damage from DoT.`);
    }

    // Apply Heal-over-Time (HoT) effects
    const hotEffects = char.buffs.filter((b) => b.type === "healOverTime");
    let totalHot = 0;
    hotEffects.forEach((hot) => {
      if (hot.value) totalHot += hot.value;
    });
    if (totalHot > 0) {
      char.currentHP = Math.min(char.hp, char.currentHP + totalHot);
      log(`[System] ${char.name} heals ${totalHot} HP from HoT.`);
    }

    // Tick down buff and debuff durations
    char.buffs = char.buffs
      .map((b) => ({
        ...b,
        buffDuration: b.buffDuration ? b.buffDuration - 1 : undefined,
      }))
      .filter((b) => b.buffDuration === undefined || b.buffDuration > 0);
    char.debuffs = char.debuffs
      .map((d) => ({
        ...d,
        debuffDuration: d.debuffDuration ? d.debuffDuration - 1 : undefined,
      }))
      .filter((d) => d.debuffDuration === undefined || d.debuffDuration > 0);

    return char;
  });
}

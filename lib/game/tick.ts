import { BattleCharacter } from "@/types/character";
import { trySurviveLethal } from "./lethal";

/**
 * Duration semantics (ruling #21 — durations are literal):
 *
 * - Harmful effects (debuffs, DoT, stun, seal) tick at the END of the
 *   victim's team turn. The victim always gets their own turn to cleanse
 *   before a proc lands, and "stun for N turns" blocks exactly N of the
 *   victim's turns.
 * - Beneficial effects (buffs, stances, HoT) tick at the START of the
 *   owner's team turn. A 1-turn buff applied on your turn protects you
 *   through the entire opposing turn and expires as your next turn begins.
 *
 * Duration N therefore means N procs (DoT/HoT) or N full turns of effect.
 * Effects without a duration persist until removed by other means.
 */

/** Own-turn-START tick: reset per-turn flags, proc HoT, expire buffs. */
export function tickTeamBuffs(
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

    char.buffs = char.buffs
      .map((b) => ({
        ...b,
        buffDuration: b.buffDuration ? b.buffDuration - 1 : undefined,
      }))
      .filter((b) => b.buffDuration === undefined || b.buffDuration > 0);

    return char;
  });
}

/** Own-turn-END tick: proc DoT/decay, expire debuffs. */
export function tickTeamDebuffs(
  team: BattleCharacter[],
  log: (entry: string) => void,
): BattleCharacter[] {
  return team.map((original) => {
    if (original.currentHP <= 0) return original;

    const char = {
      ...original,
      passiveState: { ...original.passiveState },
    };

    // Apply Damage-over-Time (DoT), Decay, and Corrosion effects
    const dotEffects = char.debuffs.filter(
      (d) =>
        d.type === "damageOverTime" ||
        d.type === "decay" ||
        d.type === "corrosion",
    );
    let totalDot = 0;
    dotEffects.forEach((dot) => {
      if (dot.type === "corrosion") {
        // % of the victim's MAX HP per stack — the uncapped boss gimmick.
        const percent = dot.valuePercent ?? 10;
        totalDot += Math.floor(char.hp * (percent / 100)) * (dot.stacks ?? 1);
      } else if (dot.type === "decay" && dot.capturedDamage) {
        totalDot += dot.capturedDamage;
      } else if (dot.value) {
        totalDot += dot.value;
      }
    });
    let survivedLethalDot = false;
    if (totalDot > 0) {
      const newHp = char.currentHP - totalDot;
      if (newHp <= 0) {
        // Ruling #29: DoT deaths trigger lethal survival too; the revival
        // strips every buff and debuff (which also ends the DoTs).
        const healAmount = trySurviveLethal(char, totalDot);
        if (healAmount !== null) {
          survivedLethalDot = true;
          log(
            `[System] ${char.name} triggered ${char.passive?.name ?? "lethal survival"} against DoT, healed ${healAmount} HP and lost all buffs and debuffs.`,
          );
        } else {
          char.currentHP = 0;
        }
      } else {
        char.currentHP = newHp;
      }
      // DoT counts as taking damage (matters for Extort Life-style passives)
      char.passiveState.tookDamageThisRound = true;
      if (!survivedLethalDot) {
        log(`[System] ${char.name} takes ${totalDot} damage from DoT.`);
      }
    }

    if (!survivedLethalDot) {
      char.debuffs = char.debuffs
        .map((d) => ({
          ...d,
          debuffDuration: d.debuffDuration ? d.debuffDuration - 1 : undefined,
        }))
        .filter((d) => d.debuffDuration === undefined || d.debuffDuration > 0);
    }

    return char;
  });
}

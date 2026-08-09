import { scaleMaxHp, inverseHpPercent } from "@/lib/game/maxHp";
import { BattleCharacter } from "@/types/character";
import { trySurviveLethal } from "./lethal";
import { applyHeal } from "./heal";

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
    // Benched units can't act or be healed normally — freeze their buffs too
    if (original.currentHP <= 0 || original.isSub) return original;

    const char = {
      ...original,
      passiveState: { ...original.passiveState },
    };

    // Reset action-specific passive flags each turn start
    char.passiveState.firstActionTriggeredThisTurn = false;

    // Apply Heal-over-Time (HoT) effects — recovery rate is recalculated
    // live off the recipient's CURRENT rate every tick, not snapshotted
    // at cast time (Tanveer ruling 2026-07-24).
    const hotEffects = char.buffs.filter((b) => b.type === "healOverTime");
    let totalHot = 0;
    hotEffects.forEach((hot) => {
      if (hot.value) totalHot += hot.value;
    });
    if (totalHot > 0) {
      const { character: healedChar, healed } = applyHeal(char, totalHot);
      Object.assign(char, healedChar);
      if (healed > 0) log(`[System] ${char.name} heals ${healed} HP from HoT.`);
    }

    const ticked = char.buffs.map((b) => ({
      ...b,
      buffDuration: b.buffDuration ? b.buffDuration - 1 : undefined,
    }));
    char.buffs = ticked.filter(
      (b) => b.buffDuration === undefined || b.buffDuration > 0,
    );
    // A max-HP raise is baked, not read dynamically, so when the buff that
    // granted it expires the HP has to be unwound or it stays forever
    // (Tanveer, 2026-08-09). Stacked raises unwind one at a time, each by its
    // own inverse.
    ticked
      .filter((b) => b.buffDuration !== undefined && b.buffDuration <= 0)
      .forEach((expired) => {
        if (typeof expired.hpScalePercent !== "number") return;
        Object.assign(char, scaleMaxHp(char, inverseHpPercent(expired.hpScalePercent)));
        log(`${char.name}'s ${expired.name ?? "buff"} fades — max HP returns to ${char.hp}.`);
      });

    return char;
  });
}

/** Own-turn-END tick: proc DoT/decay, expire debuffs. */
export function tickTeamDebuffs(
  team: BattleCharacter[],
  log: (entry: string) => void,
): BattleCharacter[] {
  return team.map((original) => {
    // Benched units can't act or be targeted by new debuffs (combat.ts) —
    // existing DoT/Corrosion on a subbed-out unit shouldn't keep ticking
    // (and potentially killing it) while it's stuck on the bench.
    if (original.currentHP <= 0 || original.isSub) return original;

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
        // Basis (Tanveer 2026-07-21): an R3/ultimate application (dot.maxHp)
        // ticks % of MAX HP; an R1/R2 application ticks % of the victim's
        // REMAINING (current, pre-tick) HP instead — the uncapped boss
        // gimmick, softened for lower ranks.
        const percent = dot.valuePercent ?? 10;
        const basis = dot.maxHp ? char.hp : char.currentHP;
        totalDot += Math.floor(basis * (percent / 100)) * (dot.stacks ?? 1);
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
      const tickedDebuffs = char.debuffs.map((d) => ({
        ...d,
        debuffDuration: d.debuffDuration ? d.debuffDuration - 1 : undefined,
      }));
      char.debuffs = tickedDebuffs.filter(
        (d) => d.debuffDuration === undefined || d.debuffDuration > 0,
      );
      // Same unwind for a max-HP shrink (see the buff side above).
      tickedDebuffs
        .filter((d) => d.debuffDuration !== undefined && d.debuffDuration <= 0)
        .forEach((expired) => {
          if (typeof expired.hpScalePercent !== "number") return;
          Object.assign(char, scaleMaxHp(char, inverseHpPercent(expired.hpScalePercent)));
          log(`${char.name}'s ${expired.name ?? "debuff"} fades — max HP returns to ${char.hp}.`);
        });
    }

    return char;
  });
}

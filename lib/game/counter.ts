import { applyHeal } from "@/lib/game/heal";
import { calculateDamage } from "@/lib/game/damage";
import { getEffectiveAttack } from "@/lib/game/stats";
import { activeBossMechanics } from "@/lib/game/bossPassives";
import { getEffectiveLifesteal } from "@/lib/game/substats";
import type { BattleCharacter } from "@/types/character";
import type { BattleEventCounter } from "@/types/battleEvent";
import type { StatusEffect } from "@/types/mechanic";

/**
 * Counter stances, both kinds.
 *
 * - **Own counter** (Meliodas's Full Counter): the stance holder strikes back
 *   when IT is attacked and survives the hit. A unit killed by the hit does not
 *   counter. Counters do not chain.
 * - **Team counter** (green Duke's Undertow, `guardsAllies`): the holder
 *   strikes back when ANY ally is attacked, off the holder's own ATK, once per
 *   enemy skill however many allies it struck (Tanveer, 2026-09-27). Settled
 *   2026-10-02: an evaded attack still counts as attacking that ally, and the
 *   counter needs at least one attacked ally still standing — "same as
 *   Meliodas", applied to the team.
 */

/** The holder's own-counter stance, if any. A team counter is not one. */
export function ownCounterStance(unit: BattleCharacter): StatusEffect | undefined {
  return unit.buffs.find(
    (b) => b.type === "stance" && b.counterDamagePercent && !b.guardsAllies,
  );
}

/** The holder's team-counter stance, if any. */
export function teamCounterStance(unit: BattleCharacter): StatusEffect | undefined {
  return unit.buffs.find(
    (b) => b.type === "stance" && b.counterDamagePercent && b.guardsAllies,
  );
}

/**
 * `counterer` strikes `attacker` for `percent`% of the counterer's ATK.
 * Mutates both, logs, and returns the event for the animation sequencer.
 */
export function strikeBack(
  counterer: BattleCharacter,
  attacker: BattleCharacter,
  percent: number,
  log: (entry: string) => void,
): BattleEventCounter {
  const counterBase = (getEffectiveAttack(counterer) * percent) / 100;
  // The struck unit's `counterDamageReduction` passive cuts the counter and
  // nothing else; the multiplier is applied to the finished damage, so it
  // composes with DEF, type and damage-reduction effects like any final cut.
  const reduction = activeBossMechanics(attacker)
    .filter((m) => m.type === "counterDamageReduction")
    .reduce((mult, m) => mult * (1 - m.valuePercent / 100), 1);
  const fullCounter = Math.floor(
    calculateDamage({
      baseDamage: counterBase,
      skillMechanics: [],
      target: attacker,
      attackerColor: counterer.color,
      attacker: counterer,
    }),
  );
  const counterDamage = Math.floor(fullCounter * reduction);
  if (counterDamage < fullCounter) {
    // Running total of what the passive saved, kept for the simulator's stats.
    attacker.passiveState.counterDamagePrevented =
      ((attacker.passiveState.counterDamagePrevented as number) || 0) +
      (fullCounter - counterDamage);
  }
  attacker.currentHP = Math.max(0, attacker.currentHP - counterDamage);
  if (counterDamage > 0) {
    attacker.passiveState.tookDamageThisRound = true;
    const lifestealPercent = getEffectiveLifesteal(counterer);
    if (lifestealPercent > 0) {
      const { character: healed, healed: amount } = applyHeal(
        counterer,
        Math.floor(counterDamage * (lifestealPercent / 100)),
      );
      Object.assign(counterer, healed);
      if (amount > 0) {
        log(`${counterer.name} self-healed ${amount} HP (lifesteal counter).`);
      }
    }
  }
  log(
    `[Action] ${counterer.name} counters ${attacker.name} for ${counterDamage} damage${attacker.currentHP === 0 ? " — defeated" : ""}!`,
  );
  return {
    byInstanceId: counterer.instanceId,
    byName: counterer.name,
    onInstanceId: attacker.instanceId,
    damage: counterDamage,
    killedAttacker: attacker.currentHP === 0,
    attackerHpAfter: attacker.currentHP,
  };
}

/**
 * Team counters against one enemy skill. `attacked` is every unit on the
 * defending side the skill was aimed at, evaded or hit, AFTER it resolved.
 */
export function resolveTeamCounters(
  defendingTeam: BattleCharacter[],
  attacked: BattleCharacter[],
  attacker: BattleCharacter,
  log: (entry: string) => void,
): BattleEventCounter[] {
  if (attacked.length === 0) return [];
  if (!attacked.some((u) => u.currentHP > 0)) return [];
  const events: BattleEventCounter[] = [];
  for (const guard of defendingTeam) {
    if (attacker.currentHP <= 0) break;
    if (guard.currentHP <= 0 || guard.isSub) continue;
    const stance = teamCounterStance(guard);
    if (!stance?.counterDamagePercent) continue;
    events.push(strikeBack(guard, attacker, stance.counterDamagePercent, log));
  }
  return events;
}

import { applyHeal } from "@/lib/game/heal";
import { blocksFor } from "@/lib/game/passiveBlocks";
import type { BattleCharacter } from "@/types/character";

/**
 * `onKill` passives - "when this character defeats an enemy".
 *
 * **What counts as a kill.** An enemy's HP reaches 0 from THIS character's
 * direct damage: its own skill or ultimate, or a counter it lands. The caller
 * (`executeSkill`) credits those, because only it knows who struck the blow.
 *
 * **What does not.** Damage over time (Bleed, Decay, Corrosion; Ignite deals none) is not
 * a kill: it resolves in the turn ticks, outside `executeSkill`, with no
 * attacker to credit, and this module is never called from there. An ally's
 * kill does not count for its owner either - the credit is per striker. This
 * was chosen, not discovered (2026-10-03): it is the narrow reading of "defeats
 * an enemy", and it is flagged for Tanveer in case he meant a looser one.
 *
 * Today the one effect is `heal` (`valuePercent` of the owner's MAX HP, as the
 * stat pipeline holds it, so a ramped or buffed pool heals proportionally),
 * limited by `maxTriggers` over the whole battle. The heal goes through
 * `applyHeal`, so Recovery Rate applies like any other heal.
 *
 * Runs inside the one resolution path both the live battle and the simulator
 * use. Mutates in place, like the other post-passes; `teams` are the clones
 * `executeSkill` built for this action.
 */

const TRIGGERS_USED = "killHealTriggers";
/** Running total of heals earned, read by the simulator's stats. */
const HEALS_EARNED = "onKillHeals";

export function applyKillPassives(
  teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
  kills: ReadonlyMap<string, number>,
  log: (entry: string) => void,
): void {
  for (const [instanceId, count] of kills) {
    const unit = [...teams.playerTeam, ...teams.enemyTeam].find(
      (u) => u.instanceId === instanceId,
    );
    // A killer that fell to its own counter or that sits on the bench earns
    // nothing; the bench rule is the passive default-deny used everywhere.
    if (!unit || unit.currentHP <= 0) continue;
    if (unit.isSub && unit.passive?.worksFromSub !== true) continue;

    for (const block of blocksFor(unit, "onKill")) {
      for (const mech of block.mechanics ?? []) {
        if (mech.type !== "heal") continue;
        const cap = mech.maxTriggers ?? Infinity;
        const used = (unit.passiveState[TRIGGERS_USED] as number) || 0;
        const triggers = Math.min(count, cap - used);
        if (triggers <= 0) continue;

        unit.passiveState[TRIGGERS_USED] = used + triggers;
        unit.passiveState[HEALS_EARNED] =
          ((unit.passiveState[HEALS_EARNED] as number) || 0) + triggers;
        const amount = Math.floor(unit.hp * ((mech.valuePercent ?? 0) / 100)) * triggers;
        const { character, healed } = applyHeal(unit, amount);
        Object.assign(unit, character);
        log(
          `${unit.name}'s ${unit.passive?.name} triggers on a kill${healed > 0 ? ` and restores ${healed} HP` : ""}.`,
        );
      }
    }
  }
}

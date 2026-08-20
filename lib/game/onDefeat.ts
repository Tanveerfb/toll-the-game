import { applyHeal } from "@/lib/game/heal";
import { blocksFor } from "@/lib/game/passiveBlocks";
import type { BattleCharacter } from "@/types/character";

/**
 * `onDefeat` passives — a unit's parting effect on its own team.
 *
 * Run as a **post-pass** over both teams rather than inline at the point of
 * death, because a unit can die in three different places (a skill's damage in
 * `combat.ts`, a damage-over-time tick in `tick.ts`, and recoil) and wiring the
 * same effect into each of those is how one of them ends up missing it. Both
 * callers hand the whole battlefield to `applyDefeatPassives` after their own
 * work is done; this decides who just died and what that costs.
 *
 * Fires exactly once per unit per battle, guarded by a `passiveState` flag —
 * the pass runs many times over a corpse that stays on the field until the
 * turn-start cleanup, so without the guard a dead bruiser would heal its team
 * on every subsequent action.
 *
 * Deliberately applies to the **owner's own team only**. `onDefeat` is a legacy,
 * not a revenge strike: "when this character is defeated, heal all allies" is
 * the shape it exists for. A dying unit that hurts its killer would be a
 * different trigger, and should be added as one rather than folded in here.
 */

const FIRED = "defeatPassiveFired";

/** Mechanic types `onDefeat` knows how to apply. Anything else on the block is
 *  ignored rather than guessed at — an unsupported mechanic is an authoring
 *  question, not something to approximate. */
function applyToAlly(
  ally: BattleCharacter,
  mech: {
    type: string;
    valuePercent?: number;
    duration?: number;
    stat?: string;
    stats?: string[];
    maxHpPercent?: number;
  },
  ownerName: string,
  log: (entry: string) => void,
): void {
  if (mech.type === "heal") {
    // Percent of the ally's OWN max HP — "20% of their respective maxHP", so a
    // tanky ally gets more back than a fragile one from the same entry.
    const amount = Math.floor(ally.hp * ((mech.maxHpPercent ?? 0) / 100));
    if (amount <= 0) return;
    const { character, healed } = applyHeal(ally, amount);
    Object.assign(ally, character);
    if (healed > 0) log(`${ally.name} recovers ${healed} HP (${ownerName}).`);
    return;
  }
  if (mech.type === "buff") {
    ally.buffs.push({
      type: "buff",
      ...(mech.stats ? { stats: mech.stats } : { stat: mech.stat ?? "atk" }),
      valuePercent: mech.valuePercent,
      buffDuration: mech.duration,
      name: ownerName,
    });
  }
}

/**
 * Applies every not-yet-fired `onDefeat` passive on the field.
 *
 * Mutates in place, matching the rest of the engine's post-passes, and returns
 * the number of passives that fired so a caller can tell whether anything
 * happened without diffing the teams.
 */
export function applyDefeatPassives(
  teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
  log: (entry: string) => void,
): number {
  let fired = 0;

  for (const side of ["playerTeam", "enemyTeam"] as const) {
    const team = teams[side];
    // Snapshot the dead first: applying a heal can't resurrect, but taking the
    // list up front keeps the iteration honest if that ever changes.
    const justDied = team.filter(
      (unit) => unit.currentHP <= 0 && unit.passiveState[FIRED] !== true,
    );

    for (const unit of justDied) {
      unit.passiveState[FIRED] = true;
      const blocks = blocksFor(unit, "onDefeat");
      if (blocks.length === 0) continue;

      const name = unit.passive?.name ?? "a parting effect";
      log(`${unit.name} falls — ${name} triggers.`);
      fired += 1;

      // Living allies only. The dying unit does not heal itself, and a corpse
      // is not an ally worth buffing.
      const allies = team.filter((a) => a.currentHP > 0);
      for (const block of blocks) {
        for (const mech of block.mechanics ?? []) {
          for (const ally of allies) {
            applyToAlly(ally, mech, name, log);
          }
        }
      }
    }
  }

  return fired;
}

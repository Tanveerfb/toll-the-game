import { inverseHpPercent, scaleMaxHp } from "@/lib/game/maxHp";
import type { BattleCharacter } from "@/types/character";
import type { StatusEffect } from "@/types/mechanic";

/**
 * [Freeze] and the [Frozen] debuff it leaves (Tanveer, 2026-09-27, defined in
 * one sitting while drafting blue Lyra; recorded as a ruling in
 * docs/HANDOFF.md). Every rule lives here so the engine, the AI, the hand and
 * the duel parser cannot disagree about what a frozen unit may do.
 *
 * His definition, against stun:
 *  - Incapacitates like stun: the unit cannot use skills. It still gains
 *    ultimate gauge, as a stunned unit does.
 *  - Unlike stun, while frozen it gains no new buffs or debuffs other than
 *    Freeze itself. Uncancellable buffs, debuffs and effects still land.
 *  - Landing strips the unit's cancellable buffs, cancellable debuffs and
 *    stances. Uncancellable entries and effects are untouched.
 *  - Debuff Immunity blocks Freeze entirely — the one counter. (So does a
 *    boss's `ccImmune`, which has always covered "stun/freeze".)
 *  - Any damage breaks it: an attack, an attack-debuff or a DoT tick. A tanked
 *    hit dealt nothing, so it does not.
 *  - Cleanse removes it (it is a cancellable debuff). A new Freeze overrides
 *    an existing one, refreshing the duration.
 *
 * Duration ticks like every harmful effect: at the end of the victim's own
 * team turn (ruling #21), so "frozen for 1 turn" costs exactly one turn.
 */

export const FROZEN_NAME = "Frozen";

// Read defensively: the queue's post-pass sees every unit the queue does,
// including the bare fixtures its own tests build without status arrays.
export function isFrozen(unit: Pick<BattleCharacter, "debuffs">): boolean {
  return (unit.debuffs ?? []).some((d) => d.type === "freeze");
}

/** Stunned or frozen: the unit cannot act this turn. */
export function isIncapacitated(unit: Pick<BattleCharacter, "debuffs">): boolean {
  return (unit.debuffs ?? []).some(
    (d) => d.type === "stun" || d.type === "freeze",
  );
}

/** What a unit's incapacitation reads as in a notice or a log line. */
export function incapacitationWord(
  unit: Pick<BattleCharacter, "debuffs">,
): "frozen" | "stunned" {
  return isFrozen(unit) ? "frozen" : "stunned";
}

/**
 * Undo a stripped entry's baked max-HP change, the way `tick.ts` does on
 * expiry. Without this a frozen unit kept the HP of a buff it no longer had.
 */
function unwindHp(unit: BattleCharacter, entry: StatusEffect): void {
  if (typeof entry.hpScalePercent !== "number") return;
  Object.assign(unit, scaleMaxHp(unit, inverseHpPercent(entry.hpScalePercent)));
}

export type FreezeResult = "frozen" | "debuffImmune" | "ccImmune";

/**
 * Freeze `target` for `duration` turns. Mutates in place, like the rest of
 * `executeSkill`'s per-target work.
 */
export function applyFreeze(
  target: BattleCharacter,
  duration: number,
): FreezeResult {
  if (target.buffs.some((b) => b.debuffImmune)) return "debuffImmune";
  if (target.ccImmune) return "ccImmune";

  const keptBuffs: StatusEffect[] = [];
  for (const buff of target.buffs) {
    if (buff.uncancellable) keptBuffs.push(buff);
    else unwindHp(target, buff);
  }
  const keptDebuffs: StatusEffect[] = [];
  for (const debuff of target.debuffs) {
    // An existing Frozen is cancellable, so a refreeze replaces it here.
    if (debuff.uncancellable) keptDebuffs.push(debuff);
    else unwindHp(target, debuff);
  }
  target.buffs = keptBuffs;
  target.debuffs = [
    ...keptDebuffs,
    { type: "freeze", name: FROZEN_NAME, debuffDuration: duration },
  ];
  return "frozen";
}

/**
 * Damage taken breaks Freeze. Returns whether a Freeze was broken, so the
 * caller can say so in the log.
 */
export function breakFreeze(unit: BattleCharacter): boolean {
  if (!isFrozen(unit)) return false;
  unit.debuffs = unit.debuffs.filter((d) => d.type !== "freeze");
  return true;
}

type Teams = { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] };

/**
 * Keeps a frozen unit stripped across a step of the battle.
 *
 * A post-pass rather than a check at every push site: buffs and debuffs are
 * pushed from some thirty places (skills, passives, synergies, boss turns),
 * and a gate at each is how one of them ends up missing it. Instead, any unit
 * that was frozen BEFORE the step and is still frozen AFTER it keeps only what
 * it already had, plus whatever landed that is uncancellable. A unit frozen
 * during the step was stripped by `applyFreeze` itself; a unit whose Freeze
 * broke during the step gains normally, as he ruled.
 *
 * Entries are compared by reference: the engine copies arrays, not entries,
 * so an entry that survived the step is the same object.
 */
export function enforceFrozen(before: Teams, after: Teams): Teams {
  const frozenBefore = new Map<string, Set<StatusEffect>>();
  for (const unit of [...before.playerTeam, ...before.enemyTeam]) {
    if (isFrozen(unit)) {
      frozenBefore.set(unit.instanceId, new Set([...unit.buffs, ...unit.debuffs]));
    }
  }
  if (frozenBefore.size === 0) return after;

  const strip = (team: BattleCharacter[]) =>
    team.map((unit) => {
      const had = frozenBefore.get(unit.instanceId);
      if (!had || !isFrozen(unit)) return unit;
      const keep = (e: StatusEffect) =>
        had.has(e) || e.uncancellable === true || e.type === "freeze";
      const removed = [...unit.buffs, ...unit.debuffs].filter((e) => !keep(e));
      if (removed.length === 0) return unit;
      const next = {
        ...unit,
        buffs: unit.buffs.filter(keep),
        debuffs: unit.debuffs.filter(keep),
      };
      // A max-HP raise was baked when it was pushed; refusing it has to give
      // the HP back too.
      removed.forEach((e) => unwindHp(next, e));
      return next;
    });

  return { playerTeam: strip(after.playerTeam), enemyTeam: strip(after.enemyTeam) };
}

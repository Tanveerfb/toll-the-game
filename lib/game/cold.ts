import { applyFreeze } from "@/lib/game/freeze";
import { findAnyPassiveMechanic } from "@/lib/game/passiveBlocks";
import type { QueueItem } from "@/lib/game/mechanicQueue";
import type { BattleCharacter } from "@/types/character";

/**
 * [Cold] — blue Lyra's Frostline (Tanveer, 2026-09-27; edge cases settled
 * 2026-10-02). His text:
 *
 * > Every time this character attacks — applies a effect [Cold] on attacked
 * > enemy (Max 3 stacks per enemy). Applies the following effects to the enemy
 * > at the end of turn, based on the number of [Cold] stacks present:
 * > 1 stack: Attack and defence 10% down · 2 stacks: disables ultimate moves
 * > for 1 turn · 3 stacks: removes all stacks and then freezes the enemy for
 * > 1 turn.
 *
 * And what he settled around it:
 *  - [Cold] is an EFFECT: uncancellable, not cleansable, ignores Debuff
 *    Immunity. It stays until the top tier spends it or Lyra dies.
 *  - Only a real hit gives a stack — not an evaded attack, not a tanked one.
 *    An AoE gives every enemy it really hits one.
 *  - Tiers stack up and are uncancellable, 1 turn, re-applied at every turn
 *    end while the stacks remain. Debuff Immunity DOES block the tier
 *    effects (his answer, 2026-10-02), as it blocks Freeze.
 *  - At the top tier the stacks are spent, then the freeze applies. An
 *    immune enemy still spends them; the freeze is simply resisted.
 *  - Tiers resolve at the end of Lyra's own team turn, so a freeze lands going
 *    into the enemy's turn and costs them that turn.
 */

export const COLD_NAME = "Cold";

function coldEntryIndex(unit: BattleCharacter, sourceId: string): number {
  return unit.debuffs.findIndex(
    (d) => d.type === "cold" && d.sourceId === sourceId,
  );
}

/** Stacks of `source`'s [Cold] on `unit`. */
export function coldStacksOn(unit: BattleCharacter, sourceId: string): number {
  const entry = unit.debuffs.find(
    (d) => d.type === "cold" && d.sourceId === sourceId,
  );
  return entry?.stacks ?? 0;
}

/**
 * One [Cold] from `source` onto `target`, after a real hit. Mutates `target`.
 * Returns the new stack count, or null when `source` carries no [Cold].
 */
export function applyColdStack(
  source: BattleCharacter,
  target: BattleCharacter,
): number | null {
  const mech = findAnyPassiveMechanic(source, "coldStacks");
  if (!mech) return null;
  const max = mech.maxStacks ?? 3;
  const index = coldEntryIndex(target, source.instanceId);
  if (index === -1) {
    target.debuffs = [
      ...target.debuffs,
      {
        type: "cold",
        name: COLD_NAME,
        stacks: 1,
        uncancellable: true,
        sourceId: source.instanceId,
      },
    ];
    return 1;
  }
  const current = target.debuffs[index].stacks ?? 1;
  const stacks = Math.min(max, current + 1);
  target.debuffs = target.debuffs.map((d, i) =>
    i === index ? { ...d, stacks } : d,
  );
  return stacks;
}

/** Everything `sourceId` was sustaining ends with it: its [Cold] stacks. */
export function clearColdFrom(team: BattleCharacter[], sourceId: string): void {
  for (const unit of team) {
    if (unit.debuffs.some((d) => d.type === "cold" && d.sourceId === sourceId)) {
      unit.debuffs = unit.debuffs.filter(
        (d) => !(d.type === "cold" && d.sourceId === sourceId),
      );
    }
  }
}

/**
 * Registers the end-of-turn tier resolution for a unit carrying `coldTiers`,
 * on its own team's turn-end phase.
 */
export function registerColdTiers(
  character: BattleCharacter,
  registerToQueue: (item: QueueItem) => void,
): void {
  const tiers = findAnyPassiveMechanic(character, "coldTiers");
  if (!tiers) return;
  const passiveName = character.passive?.name ?? COLD_NAME;

  registerToQueue({
    id: `${character.instanceId}_passive_${passiveName}_coldTiers`,
    phase: character.team === "player" ? "OnPlayerTurnEnd" : "OnEnemyTurnEnd",
    sourceInstanceId: character.instanceId,
    mechanicId: `${passiveName} (Cold)`,
    action: async (source, teams, log) => {
      if (source.currentHP <= 0) return teams;
      const oppKey = source.team === "player" ? "enemyTeam" : "playerTeam";
      const statDown = tiers.statDownPercent ?? 10;
      const ultSealAt = tiers.ultSealAt ?? 2;
      const freezeAt = tiers.freezeAt ?? 3;
      const tierDuration = tiers.tierDuration ?? 1;
      const freezeDuration = tiers.freezeDuration ?? 1;

      const opponents = teams[oppKey].map((original) => {
        const stacks = coldStacksOn(original, source.instanceId);
        if (stacks <= 0 || original.currentHP <= 0) return original;
        const unit = {
          ...original,
          buffs: [...original.buffs],
          debuffs: [...original.debuffs],
        };
        const immune = unit.buffs.some((b) => b.debuffImmune);

        if (stacks >= freezeAt) {
          clearColdFrom([unit], source.instanceId);
          const result = applyFreeze(unit, freezeDuration);
          log(
            result === "frozen"
              ? `${unit.name}'s [Cold] sets — Frozen for ${freezeDuration} turn${freezeDuration > 1 ? "s" : ""}.`
              : `${unit.name}'s [Cold] is spent — the freeze is resisted.`,
          );
          return unit;
        }
        if (immune) return unit;

        // This turn's tier effects replace last turn's, rather than stacking.
        unit.debuffs = unit.debuffs.filter(
          (d) => !(d.sourceId === source.instanceId && d.name === passiveName),
        );
        unit.debuffs.push({
          type: "debuff",
          stats: ["atk", "def"],
          valuePercent: statDown,
          debuffDuration: tierDuration,
          uncancellable: true,
          name: passiveName,
          sourceId: source.instanceId,
        });
        if (stacks >= ultSealAt) {
          unit.debuffs.push({
            type: "seal",
            sealType: "ultimate",
            debuffDuration: tierDuration,
            uncancellable: true,
            name: passiveName,
            sourceId: source.instanceId,
          });
        }
        log(
          `${unit.name}'s [Cold] (${stacks}): ATK and DEF -${statDown}%` +
            (stacks >= ultSealAt ? ", ultimate moves disabled" : "") +
            ".",
        );
        return unit;
      });

      return { ...teams, [oppKey]: opponents };
    },
  });
}

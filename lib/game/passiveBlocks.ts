import type { BattleCharacter } from "@/types/character";
import type { Mechanic } from "@/types/mechanic";
import type { Passive, PassiveBlock, PassiveTrigger } from "@/types/passive";

/**
 * One passive, made of blocks — the single reader for every passive in the
 * game (spec: Plans/2026-08-20-passive-structure.md).
 *
 * Before this, a passive had exactly ONE trigger and ONE mechanics array, so
 * "ATK up always, plus more when attacking a [Demon]" could not be authored at
 * all: every call site read `char.passive?.trigger === X` then
 * `char.passive.mechanics`. Those two lines are the whole reason the format was
 * single-condition, and they are what these helpers replace.
 *
 * Reading a block list rather than `.mechanics` is not optional. A site that
 * keeps the old pair sees only the first block and drops the rest without
 * erroring — the same silent-miss shape as the `stats`-array bug family in
 * ruling #55. `tests/passiveBlockReads.test.ts` scans the engine for it.
 */
export function passiveBlocks(passive?: Passive | null): PassiveBlock[] {
  if (!passive) return [];
  if (passive.blocks?.length) return passive.blocks;
  // Single-block shorthand: `{ trigger, mechanics }` IS one block.
  if (passive.trigger) {
    return [{ trigger: passive.trigger, mechanics: passive.mechanics ?? [] }];
  }
  // Trigger-less but carrying mechanics: boss phase passives are read by
  // `activeBossMechanics`, which never looked at the trigger, so several
  // author none at all. They are unconditional — "always" — and the
  // trigger-filtered readers skip them exactly as they did before.
  if (passive.mechanics?.length) {
    return [{ trigger: "always", mechanics: passive.mechanics }];
  }
  return [];
}

type PassiveHolder = { passive?: Passive } | undefined | null;

/** Every block on the unit's passive that fires on `trigger`. */
export function blocksFor(
  unit: PassiveHolder,
  trigger: PassiveTrigger,
): PassiveBlock[] {
  return passiveBlocks(unit?.passive).filter(
    (block) => block.trigger === trigger,
  );
}

/** Whether any block on this passive fires on `trigger`. */
export function hasPassiveTrigger(
  unit: PassiveHolder,
  trigger: PassiveTrigger,
): boolean {
  return blocksFor(unit, trigger).length > 0;
}

/**
 * Mechanics from the blocks matching `trigger`, or from every block when no
 * trigger is given. The trigger-less form is for readers that only care that a
 * mechanic exists somewhere on the kit (stack readouts, the info panel).
 */
export function passiveMechanics(
  unit: PassiveHolder,
  trigger?: PassiveTrigger,
): Mechanic[] {
  const blocks =
    trigger === undefined ? passiveBlocks(unit?.passive) : blocksFor(unit, trigger);
  return blocks.flatMap((block) => block.mechanics ?? []);
}

/** First mechanic of `type` under a block firing on `trigger`. */
export function findPassiveMechanic<T extends Mechanic["type"]>(
  unit: PassiveHolder,
  trigger: PassiveTrigger,
  type: T,
): Extract<Mechanic, { type: T }> | undefined {
  return passiveMechanics(unit, trigger).find(
    (mech): mech is Extract<Mechanic, { type: T }> => mech.type === type,
  );
}

/** First mechanic of `type` anywhere on the passive, whatever its trigger. */
export function findAnyPassiveMechanic<T extends Mechanic["type"]>(
  unit: PassiveHolder,
  type: T,
): Extract<Mechanic, { type: T }> | undefined {
  return passiveMechanics(unit).find(
    (mech): mech is Extract<Mechanic, { type: T }> => mech.type === type,
  );
}

/**
 * Passive mechanics that are actually live for this unit right now — the
 * trigger filter plus the bench rule (ruling 2026-07-24, default-deny: a sub's
 * passive is inert unless `worksFromSub` is true).
 */
export function activePassiveMechanics(
  unit: BattleCharacter | undefined | null,
  trigger: PassiveTrigger,
): Mechanic[] {
  if (!unit) return [];
  if (unit.isSub && unit.passive?.worksFromSub !== true) return [];
  return passiveMechanics(unit, trigger);
}

/**
 * The same flatten for a passive still in raw kit-JSON shape — the catalog,
 * the archive and the damage preview read `CharacterPassiveData`, which is a
 * loose record rather than a typed `Passive`, and they must not miss the
 * mechanics of a block-authored kit either.
 */
export interface RawPassiveLike {
  trigger?: unknown;
  mechanics?: unknown;
  blocks?: unknown;
}

export function rawPassiveMechanics(
  passive: RawPassiveLike | undefined | null,
): Array<Record<string, unknown>> {
  if (!passive) return [];
  const blocks = passive.blocks;
  if (Array.isArray(blocks)) {
    return blocks.flatMap((block) => {
      const mechanics = (block as Record<string, unknown>)?.mechanics;
      return Array.isArray(mechanics)
        ? (mechanics as Array<Record<string, unknown>>)
        : [];
    });
  }
  return Array.isArray(passive.mechanics)
    ? (passive.mechanics as Array<Record<string, unknown>>)
    : [];
}

/**
 * Raw-shape trigger. A block-authored passive has no top-level `trigger`, so
 * display code that labels a passive by its trigger reads the first block's —
 * the same one the shorthand would have carried.
 */
export function rawPassiveTrigger(
  passive: RawPassiveLike | undefined | null,
): string | undefined {
  if (!passive) return undefined;
  if (typeof passive.trigger === "string") return passive.trigger;
  const blocks = passive.blocks;
  if (Array.isArray(blocks)) {
    const first = (blocks[0] as Record<string, unknown>)?.trigger;
    if (typeof first === "string") return first;
  }
  return undefined;
}

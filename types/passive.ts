import type { Mechanic } from "./mechanic";

/**
 * Passive triggers actually consumed by the engine:
 * - Phase-queue passives map through `mapTriggerToPhase` in lib/game/passive.ts
 *   ("onBattleStart", "aura", and the On*Turn* phase names).
 * - Inline combat passives are keyed on the rest inside combat.ts / tick.ts.
 * Kit-authored triggers not in this list are a compile/load error — add the
 * trigger here AND its handling in the engine together.
 */
export const PASSIVE_TRIGGERS = [
  "onBattleStart",
  "aura",
  "always",
  "beforeSkill",
  "afterSkill",
  "onFirstAction",
  "onAllySkill",
  "onAttackReceived",
  "onLethalDamage",
  /** Fires as the owner dies, before the body leaves the field. Its
   *  mechanics apply to the owner's OWN team — a parting gift, not a
   *  revenge strike. Distinct from `onLethalDamage`, which is about
   *  surviving a killing blow rather than failing to. */
  "onDefeat",
  "onDamageDealt",
  "onRoundEnd",
  "onNewTurn",
  "onIgniteConsume",
  "OnPlayerTurnStart",
  "OnPlayerTurnEnd",
  "OnEnemyTurnStart",
  "OnEnemyTurnEnd",
] as const;

/**
 * Derived from the array above so the runtime list and the compile-time union
 * cannot drift. They were separate declarations until 2026-08-21, and adding
 * `onDefeat` to the type while `characterSchema.ts` kept its own copy silently
 * dropped every kit using it from the catalog — no type error, no throw, the
 * character simply did not exist.
 */
export type PassiveTrigger = (typeof PASSIVE_TRIGGERS)[number];

/**
 * One condition heading inside a passive, with its own trigger and mechanics.
 *
 * A character has exactly ONE passive, and that passive is a list of blocks —
 * Tanveer, 2026-08-20: *"Keep it the dokkan way. it basically is a single but
 * possibly long passive."* A Dokkan passive is one named ability with several
 * condition headings ("Basic effect(s)" / "When attacking an Extreme Class
 * enemy"), and ours is the same thing.
 *
 * Nothing reads a block without going through `lib/game/passiveBlocks.ts` —
 * `tests/passiveBlockReads.test.ts` fails the build if an engine file reaches
 * for `.passive.mechanics` directly, because such a site would see only the
 * first block and silently ignore the rest.
 */
export interface PassiveBlock {
  trigger: PassiveTrigger;
  mechanics?: Mechanic[];
  /**
   * The `#` heading this block renders under in the passive's markdown.
   * Unconditional effects use `# Basic effects` — Tanveer, 2026-08-20:
   * *"'always' block can be renamed to 'basic effects' block i guess."*
   */
  heading?: string;
}

export interface Passive {
  name: string;
  description?: string;
  /**
   * Whether the passive stays active from the bench. Default-deny: absent
   * or false means it does NOT work from sub (Tanveer ruling 2026-07-24 —
   * most passives need field presence to interact with enemies/allies).
   * Set true only for passives that just grant buffs/effects with no
   * interaction requirement (e.g. Leorio, Mustafa, Gabrist).
   *
   * Stays per PASSIVE, not per block (Tanveer, 2026-08-20: *"stays per
   * passive."*) — a passive is bench-active or it isn't, and every block
   * inside inherits that.
   */
  worksFromSub?: boolean;

  /**
   * Multi-block form. When present it is the whole passive.
   */
  blocks?: PassiveBlock[];

  /**
   * Single-block shorthand, and what all 27 shipped kits author. Equivalent to
   * `blocks: [{ trigger, mechanics }]` and normalized to exactly that by
   * `passiveBlocks()`. Kept because rewriting every kit JSON would risk a
   * transcription error across the roster for no behaviour gain — the engine
   * sees blocks either way.
   */
  trigger?: PassiveTrigger;
  mechanics?: Mechanic[];
}

import { battleStats } from "@/lib/game/battleStats";
import { BASE_PROGRESSION } from "@/lib/game/progression";
import type { CharacterData } from "@/lib/game/characterCatalog";
import type { BattleCharacter } from "@/types/character";
import type { StageEffect } from "@/types/stageEffects";
import type { TeamPick } from "@/types/teamPick";

/** A player's saved progress for one character, as `playerStore` holds it. */
export interface SavedProgress {
  level: number;
  ascension: number;
  ultLevel: number;
}

export interface BuildUnitInput {
  /** The catalog kit. Loose JSON, validated by the Zod schema at load. */
  raw: CharacterData;
  pick: TeamPick;
  team: "player" | "enemy";
  instanceId: string;
  isSub: boolean;
  /**
   * The save's progress for this unit. Used only where the pick names no
   * level of its own — an authored level always wins, which is how a trial
   * fields a unit at a fixed level whether or not the player owns it.
   * Pass `null` for anything the save does not own (every enemy).
   */
  saved?: SavedProgress | null;
  /** The fight's encounter modifiers (ruling #69). */
  stageEffects?: StageEffect[];
  /**
   * HP carried in from an earlier fight of a run (ruling #103). Absent means
   * full. Clamped to `[1, max]`: a later fight may carry different stage
   * effects and so a different max, and a carried survivor is never handed 0.
   */
  carriedHp?: number;
}

/**
 * The one builder for a battle unit — the battle and the simulator both call
 * it, so a simulated unit and a played one are the same unit.
 *
 * Stats go through `battleStats` (catalog → progression → stage effects), and
 * **the progression is stamped on the unit** (`level`, `ascension`), so a
 * boss entering a later phase can rebuild its stats through the same pipeline
 * rather than falling back to raw JSON.
 *
 * Before 2026-09-26 this logic existed twice — `BattleProvider` and
 * `lib/game/simulate.ts` — and the two had already drifted: the simulator let
 * carried HP reach 0 where the battle floored it at 1, and neither recorded
 * the level a unit was built at, which is why difficulty never reached
 * Molvarr's second phase.
 */
export function buildBattleUnit({
  raw,
  pick,
  team,
  instanceId,
  isSub,
  saved = null,
  stageEffects = [],
  carriedHp,
}: BuildUnitInput): BattleCharacter {
  const progression = {
    level: pick.level ?? saved?.level ?? BASE_PROGRESSION.level,
    ascension: pick.ascension ?? saved?.ascension ?? BASE_PROGRESSION.ascension,
  };
  const stats = battleStats(raw, { progression, stageEffects, side: team });
  const currentHP =
    carriedHp === undefined
      ? stats.hp
      : Math.max(1, Math.min(stats.hp, Math.round(carriedHp)));

  return {
    // Single boundary cast: kit JSON is loose `CharacterData`, validated at
    // load — beyond this point everything is strictly typed.
    ...(raw as unknown as BattleCharacter),
    ...stats,
    instanceId,
    currentAttack: stats.atk,
    currentDefense: stats.def,
    currentHP,
    ultGauge: 0,
    // Carried onto the unit so combat can scale the ultimate and the info
    // panel can show it, rather than re-reading the store mid-battle.
    ultLevel: pick.ultLevel ?? saved?.ultLevel ?? 1,
    level: progression.level,
    ascension: progression.ascension,
    buffs: [],
    debuffs: [],
    passiveState: {},
    team,
    isSub,
  };
}

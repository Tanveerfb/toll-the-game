export const BONUS_CHANCE = 0.1;
export const BASE_SEA_MONSTER_EYE = 1;
export const BASE_CORRODED_SEAWEED = 2;
export const TRAINING_MANUAL_MIN = 3;
export const TRAINING_MANUAL_MAX = 6;
export const COIN_MIN = 2000;
export const COIN_MAX = 10000;
export const GEMS_MIN = 20;
export const GEMS_MAX = 50;
export const PERMANENT_TICKET_MIN = 1;
export const PERMANENT_TICKET_MAX = 3;

export interface WorldBossRewards {
  sea_monster_eye: number;
  corroded_seaweed: number;
  training_manual: number;
  coin: number;
  gems: number;
  permanentTicket: number;
  /** Account XP. Unlike story chapters this pays on EVERY clear, which is what
   *  makes the rank ladder finishable — first clears alone are a finite pool
   *  (Tanveer, 2026-08-11). */
  accountXp: number;
}

/** Molvarr's per-clear reward roll. `rng` is injectable (defaults to
 *  Math.random) so tests can force both the base and +1-bonus branches
 *  deterministically. Gems/permanentTicket are the only real faucet for
 *  either gacha currency right now — see
 *  docs/superpowers/specs/2026-08-01-gacha-design.md's "Faucet" section. */
/**
 * Account XP per boss clear.
 *
 * Chosen against the stamina economy rather than picked from the air: at 40
 * stamina a run and 288 stamina regenerated a day, this is ~7 runs and ~720 XP
 * daily, which reaches the first rank wall in a week, the second in about two
 * months, and rank 60 in roughly a year. At 50 the same climb takes over two
 * years, which is not a ladder, it's a wall.
 */
export const WORLD_BOSS_ACCOUNT_XP = 100;

export function rollWorldBossRewards(rng: () => number = Math.random): WorldBossRewards {
  return {
    accountXp: WORLD_BOSS_ACCOUNT_XP,
    sea_monster_eye: BASE_SEA_MONSTER_EYE + (rng() < BONUS_CHANCE ? 1 : 0),
    corroded_seaweed: BASE_CORRODED_SEAWEED + (rng() < BONUS_CHANCE ? 1 : 0),
    training_manual: TRAINING_MANUAL_MIN + Math.floor(rng() * (TRAINING_MANUAL_MAX - TRAINING_MANUAL_MIN + 1)),
    coin: COIN_MIN + Math.floor(rng() * (COIN_MAX - COIN_MIN + 1)),
    gems: GEMS_MIN + Math.floor(rng() * (GEMS_MAX - GEMS_MIN + 1)),
    permanentTicket:
      PERMANENT_TICKET_MIN + Math.floor(rng() * (PERMANENT_TICKET_MAX - PERMANENT_TICKET_MIN + 1)),
  };
}

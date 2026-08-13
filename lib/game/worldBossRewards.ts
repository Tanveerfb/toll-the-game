import { clampDifficulty, MAX_WORLD_LEVEL } from "@/lib/game/worldLevel";

/**
 * World-boss rewards.
 *
 * **Every fight pays two separate things** (Tanveer, 2026-08-13): a
 * *first-time-only* bundle and a *farmable* roll. They are different lists,
 * not the same list with a flag on it — a first clear is a designed, fixed
 * payout, and rolling its amounts was the bug. A first clear pays **both**;
 * every clear after it pays the farmable roll alone.
 *
 * **Difficulty is content, not a coefficient** (Tanveer, 2026-08-13). Molvarr
 * is several fights, one per world level. Each has its own world-level
 * requirement, its own first-clear bundle paid once, and its own farmable
 * table. There is **no reward multiplier**: *"grindable stuff wouldn't
 * multiply the rewards by world level or anything but higher difficult fights
 * will just give higher quality rewards in general."* A tier pays better
 * because its table is better, and the tables are authored.
 *
 * The knock-on that makes this airtight: clearing a tier is what unlocks
 * grinding it, so nobody can beat WL1 and then farm WL4 — the exploit the
 * multiplier model would have left open.
 */

export interface WorldBossRewards {
  sea_monster_eye: number;
  corroded_seaweed: number;
  training_manual: number;
  training_manual_advanced: number;
  training_manual_premium: number;
  coin: number;
  gems: number;
  permanentTicket: number;
  /** Account XP. Unlike story chapters this pays on EVERY clear, which is what
   *  makes the rank ladder finishable — first clears alone are a finite pool
   *  (Tanveer, 2026-08-11). */
  accountXp: number;
}

/** A `[min, max]` inclusive roll, or a flat amount plus a chance of one more. */
export interface FarmableTable {
  /** `[base, bonusChance]` — base guaranteed, +1 at that probability. */
  sea_monster_eye: [number, number];
  corroded_seaweed: [number, number];
  /** `[min, max]` uniform. */
  training_manual: [number, number];
  training_manual_advanced: [number, number];
  training_manual_premium: [number, number];
  coin: [number, number];
  accountXp: number;
}

export interface BossTier {
  /** World level this tier IS. Also its id suffix — see `tierKey`. */
  difficulty: number;
  /** Account world level needed to attempt it at all. */
  requiredWorldLevel: number;
  /** Paid once, the first time this tier is beaten. Fixed, never rolled. */
  firstClear: WorldBossRewards;
  /** Paid on every clear of this tier, including the first. */
  farmable: FarmableTable;
}

/** Chance of +1 on the two ascension materials, at tier 1. */
export const BONUS_CHANCE = 0.1;
export const BASE_SEA_MONSTER_EYE = 1;
/** Doubled from 2 on 2026-08-13. Ascension wants seaweed at 3.3× / 2.5× / 2.5×
 *  the eye count (lib/game/ascension.ts) but both dropped at a flat 1:2, so
 *  seaweed was the only real gate while eyes piled up unspent. */
export const BASE_CORRODED_SEAWEED = 4;
export const TRAINING_MANUAL_MIN = 3;
export const TRAINING_MANUAL_MAX = 6;
export const COIN_MIN = 2000;
export const COIN_MAX = 10000;

/**
 * Account XP per farmed clear, tier 1.
 *
 * Chosen against the stamina economy rather than picked from the air: at 40
 * stamina a run and 288 stamina regenerated a day, this is ~7 runs and ~720 XP
 * daily, which reaches the first rank wall in a week, the second in about two
 * months, and rank 60 in roughly a year. At 50 the same climb takes over two
 * years, which is not a ladder, it's a wall.
 */
export const WORLD_BOSS_ACCOUNT_XP = 100;

export function emptyRewards(): WorldBossRewards {
  return {
    sea_monster_eye: 0,
    corroded_seaweed: 0,
    training_manual: 0,
    training_manual_advanced: 0,
    training_manual_premium: 0,
    coin: 0,
    gems: 0,
    permanentTicket: 0,
    accountXp: 0,
  };
}

/**
 * Molvarr, tier by tier.
 *
 * **Tier 1 is Tanveer's, authored 2026-08-13.** Tiers 2–4 are PLACEHOLDERS —
 * he has specified the shape ("higher quality rewards in general") but not the
 * numbers, and reward numbers are his. They are deliberately shaped as
 * *better items*, not just bigger ones: the advanced and premium manuals enter
 * the farm at tier 2 and 3, which is what "higher quality" means here rather
 * than "more of the same".
 *
 * `tests/worldBossRewards.test.ts` asserts each tier strictly improves on the
 * one below it — an invariant that survives whatever numbers he lands on.
 */
export const MOLVARR_TIERS: readonly BossTier[] = [
  {
    difficulty: 1,
    requiredWorldLevel: 1,
    firstClear: {
      ...emptyRewards(),
      gems: 50,
      sea_monster_eye: 3,
      corroded_seaweed: 10,
      coin: 50_000,
      accountXp: 50,
      training_manual: 15,
      training_manual_advanced: 10,
      training_manual_premium: 5,
      permanentTicket: 1,
    },
    farmable: {
      sea_monster_eye: [BASE_SEA_MONSTER_EYE, BONUS_CHANCE],
      corroded_seaweed: [BASE_CORRODED_SEAWEED, BONUS_CHANCE],
      training_manual: [TRAINING_MANUAL_MIN, TRAINING_MANUAL_MAX],
      training_manual_advanced: [0, 0],
      training_manual_premium: [0, 0],
      coin: [COIN_MIN, COIN_MAX],
      accountXp: WORLD_BOSS_ACCOUNT_XP,
    },
  },
  {
    difficulty: 2,
    requiredWorldLevel: 2,
    firstClear: {
      ...emptyRewards(),
      gems: 75,
      sea_monster_eye: 5,
      corroded_seaweed: 15,
      coin: 80_000,
      accountXp: 75,
      training_manual: 20,
      training_manual_advanced: 15,
      training_manual_premium: 8,
      permanentTicket: 2,
    },
    farmable: {
      sea_monster_eye: [2, 0.15],
      corroded_seaweed: [6, 0.15],
      training_manual: [4, 8],
      training_manual_advanced: [1, 2],
      training_manual_premium: [0, 0],
      coin: [4000, 14000],
      accountXp: 140,
    },
  },
  {
    difficulty: 3,
    requiredWorldLevel: 3,
    firstClear: {
      ...emptyRewards(),
      gems: 100,
      sea_monster_eye: 8,
      corroded_seaweed: 20,
      coin: 120_000,
      accountXp: 100,
      training_manual: 25,
      training_manual_advanced: 20,
      training_manual_premium: 12,
      permanentTicket: 3,
    },
    farmable: {
      sea_monster_eye: [3, 0.2],
      corroded_seaweed: [8, 0.2],
      training_manual: [6, 10],
      training_manual_advanced: [2, 4],
      training_manual_premium: [1, 1],
      coin: [7000, 20000],
      accountXp: 190,
    },
  },
  {
    difficulty: 4,
    requiredWorldLevel: 4,
    firstClear: {
      ...emptyRewards(),
      gems: 150,
      sea_monster_eye: 12,
      corroded_seaweed: 30,
      coin: 180_000,
      accountXp: 150,
      training_manual: 30,
      training_manual_advanced: 25,
      training_manual_premium: 18,
      permanentTicket: 5,
    },
    farmable: {
      sea_monster_eye: [4, 0.25],
      corroded_seaweed: [10, 0.25],
      training_manual: [8, 14],
      training_manual_advanced: [3, 6],
      training_manual_premium: [1, 2],
      coin: [10000, 28000],
      accountXp: 250,
    },
  },
];

export function getBossTier(difficulty: number): BossTier {
  const wanted = clampDifficulty(difficulty);
  return (
    MOLVARR_TIERS.find((tier) => tier.difficulty === wanted) ?? MOLVARR_TIERS[0]
  );
}

/**
 * A cleared-fight key.
 *
 * Per tier, not per event: clearing tier 1 must not unlock grinding tier 4.
 * That was the hole the old reward-multiplier model would have left open, and
 * closing it is why difficulty became content (Tanveer, 2026-08-13).
 */
export function tierKey(eventId: string, difficulty: number): string {
  return `${eventId}@${clampDifficulty(difficulty)}`;
}

function rollRange([min, max]: [number, number], rng: () => number): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

function rollBonus([base, chance]: [number, number], rng: () => number): number {
  return base + (rng() < chance ? 1 : 0);
}

/**
 * The farmable roll for one tier.
 *
 * Roll order is fixed and documented so a test can map an `rng()` call to a
 * field: eye bonus, seaweed bonus, then each manual tier, then coin.
 */
export function rollFarmableRewards(
  difficulty: number = 1,
  rng: () => number = Math.random,
): WorldBossRewards {
  const { farmable } = getBossTier(difficulty);
  return {
    ...emptyRewards(),
    accountXp: farmable.accountXp,
    sea_monster_eye: rollBonus(farmable.sea_monster_eye, rng),
    corroded_seaweed: rollBonus(farmable.corroded_seaweed, rng),
    training_manual: rollRange(farmable.training_manual, rng),
    training_manual_advanced: rollRange(farmable.training_manual_advanced, rng),
    training_manual_premium: rollRange(farmable.training_manual_premium, rng),
    coin: rollRange(farmable.coin, rng),
  };
}

export function addRewards(
  a: WorldBossRewards,
  b: WorldBossRewards,
): WorldBossRewards {
  const sum = emptyRewards();
  for (const key of Object.keys(sum) as Array<keyof WorldBossRewards>) {
    sum[key] = a[key] + b[key];
  }
  return sum;
}

/**
 * What one clear of one tier pays.
 *
 * `firstClear` defaults to **false** on purpose: an unflagged call is the
 * grind, so a new call site that forgets it under-pays rather than printing a
 * first-clear bundle every run.
 *
 * The bundle is **never scaled** — not by world level, not by anything. Each
 * tier's bundle is authored at the value it should pay (Tanveer, 2026-08-13:
 * *"first clear doesn't need to scale with world level"*).
 */
export function rollWorldBossRewards(
  rng: () => number = Math.random,
  {
    firstClear = false,
    difficulty = 1,
  }: { firstClear?: boolean; difficulty?: number } = {},
): WorldBossRewards {
  const farmed = rollFarmableRewards(difficulty, rng);
  return firstClear
    ? addRewards(getBossTier(difficulty).firstClear, farmed)
    : farmed;
}

/** Every tier the account's world level allows attempting. */
export function attemptableTiers(worldLevelCap: number): BossTier[] {
  return MOLVARR_TIERS.filter(
    (tier) => tier.requiredWorldLevel <= Math.min(worldLevelCap, MAX_WORLD_LEVEL),
  );
}

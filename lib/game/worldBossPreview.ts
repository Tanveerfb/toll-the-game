import { getBossTier, type WorldBossRewards } from "@/lib/game/worldBossRewards";
import { materialLabel } from "@/lib/game/materials";

/**
 * Reward payouts and previews, as rows a list component can render.
 *
 * Lifted out of `app/events/page.tsx` on 2026-09-17 (audit finding C6). These
 * are pure functions over the reward tables with no React in them, and keeping
 * them in a 1,289-line page component meant the story brief could not reach
 * them — which is exactly why `StageBrief.tsx` grew a second, divergent
 * implementation of the same rows.
 */

/**
 * `[iconId, label, amount]`. The id is what `ItemIcon` resolves art from and
 * is empty for a payout with nothing to draw.
 */
export type RewardRow = [string, string, number];

/** The same, with the amount already formatted — ranges can't be numbers. */
export type PreviewRow = [string, string, string];

/**
 * A clear's payout, itemised, zeroes dropped.
 *
 * A boss clear pays SEVEN things. The results screen used to list four of them
 * — no gems, no permanent ticket, no account XP — and
 * `WORLD_BOSS_AND_ASCENSION_PLAN.md` had lost track of the same three, which is
 * how a design doc and a results screen can quietly agree with each other and
 * both be wrong (2026-08-13). Read from the reward object so a new field can't
 * be forgotten twice.
 */
export function rewardRows(rewards: WorldBossRewards): RewardRow[] {
  const rows: RewardRow[] = [
    [
      "sea_monster_eye",
      materialLabel("sea_monster_eye"),
      rewards.sea_monster_eye,
    ],
    [
      "corroded_seaweed",
      materialLabel("corroded_seaweed"),
      rewards.corroded_seaweed,
    ],
    [
      "training_manual",
      materialLabel("training_manual"),
      rewards.training_manual,
    ],
    [
      "training_manual_advanced",
      materialLabel("training_manual_advanced"),
      rewards.training_manual_advanced,
    ],
    [
      "training_manual_premium",
      materialLabel("training_manual_premium"),
      rewards.training_manual_premium,
    ],
    ["coin", "Coin", rewards.coin],
    ["gems", "Gems", rewards.gems],
    ["permanent_ticket", "Permanent Ticket", rewards.permanentTicket],
    // Account XP is a number, not a thing you hold — no icon exists and none
    // should, so its id is empty and `ItemIcon` renders nothing for it.
    ["", "Account XP", rewards.accountXp],
  ];
  return rows.filter(([, , value]) => value > 0);
}

/**
 * One tier's farmable table, as ranges.
 *
 * Built from the tier so it cannot drift from what the fight actually pays.
 * Ranges, not guarantees — the roll happens on victory
 * (`rollWorldBossRewards`), and the brief exists to answer "what am I playing
 * for", which nothing did before.
 */
export function farmablePreview(difficulty: number): PreviewRow[] {
  const { farmable } = getBossTier(difficulty);
  const bonus = ([base, chance]: [number, number]) =>
    chance > 0 ? `${base}–${base + 1}` : `${base}`;
  const range = ([min, max]: [number, number]) =>
    max > min ? `${min.toLocaleString()}–${max.toLocaleString()}` : `${min}`;
  const rows: PreviewRow[] = [
    [
      "sea_monster_eye",
      materialLabel("sea_monster_eye"),
      bonus(farmable.sea_monster_eye),
    ],
    [
      "corroded_seaweed",
      materialLabel("corroded_seaweed"),
      bonus(farmable.corroded_seaweed),
    ],
    [
      "training_manual",
      materialLabel("training_manual"),
      range(farmable.training_manual),
    ],
    [
      "training_manual_advanced",
      materialLabel("training_manual_advanced"),
      range(farmable.training_manual_advanced),
    ],
    [
      "training_manual_premium",
      materialLabel("training_manual_premium"),
      range(farmable.training_manual_premium),
    ],
    ["coin", "Coin", range(farmable.coin)],
    ["", "Account XP", `${farmable.accountXp}`],
  ];
  // A tier that doesn't drop a manual tier shouldn't advertise "0".
  return rows.filter(([, , value]) => value !== "0");
}

/**
 * The one-off bundle for a tier.
 *
 * Fixed amounts, never rolled and never scaled — each tier's bundle is authored
 * at the value it should pay (Tanveer, 2026-08-13: *"first clear doesn't need
 * to scale with world level"*).
 */
export function firstClearPreview(difficulty: number): PreviewRow[] {
  return rewardRows(getBossTier(difficulty).firstClear).map(
    ([id, label, value]): PreviewRow => [id, label, value.toLocaleString()],
  );
}

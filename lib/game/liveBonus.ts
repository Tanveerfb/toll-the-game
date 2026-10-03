import { activeBossMechanics } from "@/lib/game/bossPassives";
import { countDistinctDebuffs, igniteStacksOn } from "@/lib/game/debuffCount";
import type { BattleCharacter } from "@/types/character";
import type { LiveBonusMechanic, StatusEffect } from "@/types/mechanic";

/**
 * Live bonuses - passive stat bonuses that follow something on the opposing
 * side and are recounted, not accumulated (`liveBonus`, types/mechanic.ts).
 *
 * The stat pipeline reads a unit alone (`getEffectiveAttack(unit)`), so it
 * cannot see the enemy team. Rather than thread a team through every reader,
 * each bonus is kept as ONE uncancellable buff entry on its owner, rewritten in
 * place whenever the count could have moved, and the ordinary pipeline reads
 * it like any other buff. Because the entry is **replaced from the current
 * count every time** (never nudged by a delta), the same field always yields
 * the same number, and a cleanse that drops the count drops the bonus with it.
 *
 * Called from the two places teams change: the end of every skill
 * (`executeSkill`) and the end of every phase of the passive queue
 * (`mechanicQueue.process`), which together follow every tick, passive and
 * action in both the battle and the simulator.
 */

type Teams = { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] };

/** The count a mechanic tracks, over the opposing side's living units. */
export function liveCount(
  mech: LiveBonusMechanic,
  opposing: readonly BattleCharacter[],
): number {
  const living = opposing.filter((unit) => unit.currentHP > 0 && !unit.isSub);
  switch (mech.counts) {
    case "enemyDebuffs":
      return living.reduce((sum, unit) => sum + countDistinctDebuffs(unit), 0);
    case "enemyIgniteStacks":
      return living.reduce((sum, unit) => sum + igniteStacksOn(unit), 0);
    case "enemyNamePresent": {
      const needle = (mech.enemyName ?? "").toLowerCase();
      if (!needle) return 0;
      return living.some((unit) => unit.name.toLowerCase().includes(needle))
        ? 1
        : 0;
    }
  }
}

/** The percent a mechanic currently grants: per-count value, clamped. */
export function liveBonusPercent(
  mech: LiveBonusMechanic,
  opposing: readonly BattleCharacter[],
): number {
  const raw = mech.valuePercentPerCount * liveCount(mech, opposing);
  return mech.maxPercent === undefined ? raw : Math.min(raw, mech.maxPercent);
}

/** A unit's `liveBonus` mechanics, with the key each one's entry lives under. */
export function liveBonusMechanics(
  unit: BattleCharacter,
): Array<{ key: string; mech: LiveBonusMechanic }> {
  return activeBossMechanics(unit)
    .filter((m): m is LiveBonusMechanic => m.type === "liveBonus")
    .map((mech, index) => ({ key: `live:${index}`, mech }));
}

function refreshUnit(
  unit: BattleCharacter,
  opposing: readonly BattleCharacter[],
): BattleCharacter {
  const mechanics = liveBonusMechanics(unit);
  if (mechanics.length === 0) return unit;

  // A dead unit or an inert bench passive grants nothing (default-deny, the
  // same rule `registerCharacterPassives` applies).
  const active =
    unit.currentHP > 0 &&
    !(unit.isSub && unit.passive?.worksFromSub !== true);

  let buffs = unit.buffs;
  let changed = false;
  for (const { key, mech } of mechanics) {
    const percent = active ? liveBonusPercent(mech, opposing) : 0;
    const existing = buffs.find((b) => b.liveBonusKey === key);
    if (percent === 0) {
      if (existing) {
        buffs = buffs.filter((b) => b.liveBonusKey !== key);
        changed = true;
      }
      continue;
    }
    if (existing?.valuePercent === percent) continue;
    const entry: StatusEffect = {
      type: "buff",
      stats: mech.stats,
      valuePercent: percent,
      uncancellable: true,
      name: unit.passive?.name,
      liveBonusKey: key,
    };
    buffs = existing
      ? buffs.map((b) => (b.liveBonusKey === key ? entry : b))
      : [...buffs, entry];
    changed = true;
  }
  return changed ? { ...unit, buffs } : unit;
}

/**
 * Rewrites every live-bonus entry from the current field. Returns the same
 * object when nothing changed, so a battle with no live bonus pays one scan.
 */
export function applyLiveBonuses<T extends Teams>(teams: T): T {
  const playerTeam = teams.playerTeam.map((u) =>
    refreshUnit(u, teams.enemyTeam),
  );
  const enemyTeam = teams.enemyTeam.map((u) =>
    refreshUnit(u, teams.playerTeam),
  );
  const same =
    playerTeam.every((u, i) => u === teams.playerTeam[i]) &&
    enemyTeam.every((u, i) => u === teams.enemyTeam[i]);
  return same ? teams : { ...teams, playerTeam, enemyTeam };
}

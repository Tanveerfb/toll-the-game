import type { BattleCharacter } from "@/types/character";

/**
 * Ruling #32: Extort is a linked pair — the thief's self-buff lives only
 * while at least one LIVING enemy still carries a matching Extort debuff
 * (tagged with the thief's sourceId). Death, cleanse, or expiry of the last
 * debuff drops the thief's buff too. Call after any action or tick that
 * can remove debuffs or kill units. Mutates in place.
 */
export function syncExtortLinks(
  playerTeam: BattleCharacter[],
  enemyTeam: BattleCharacter[],
  log: (entry: string) => void,
): void {
  const all = [...playerTeam, ...enemyTeam];
  for (const unit of all) {
    if (!unit.buffs.some((b) => b.name === "Extort")) continue;
    const stillLinked = all.some(
      (other) =>
        other.team !== unit.team &&
        other.currentHP > 0 &&
        other.debuffs.some(
          (d) => d.name === "Extort" && d.sourceId === unit.instanceId,
        ),
    );
    if (!stillLinked) {
      unit.buffs = unit.buffs.filter((b) => b.name !== "Extort");
      log(
        `[System] ${unit.name}'s Extort fades — no extorted target remains.`,
      );
    }
  }
}

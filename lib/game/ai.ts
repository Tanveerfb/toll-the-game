import { BattleCharacter } from "@/types/character";
import { Action } from "@/types/action";
import { SkillCard } from "@/types/skillCard";
import { UltimateCard } from "@/types/ultimateCard";

/** Actions the enemy side takes per enemy turn — any living enemy may act, in any order, no fixed pattern. */
export const ENEMY_ACTIONS_PER_TURN = 3;

/**
 * Picks a single AI action from the current battle state. Call once per
 * enemy action so each decision sees the results of the previous one.
 * Returns null when no enemy can act or no player is alive.
 */
export function getAIMove(
  enemyTeam: BattleCharacter[],
  playerTeam: BattleCharacter[],
): Action | null {
  const alivePlayers = playerTeam.filter((p) => p.currentHP > 0);
  if (alivePlayers.length === 0) return null;

  const actingPool = enemyTeam.filter(
    (e) => e.currentHP > 0 && !e.debuffs.some((d) => d.type === "stun"),
  );
  if (actingPool.length === 0) return null;

  const enemy = actingPool[Math.floor(Math.random() * actingPool.length)];

  // AI Target Selection
  let target = alivePlayers.reduce(
    (lowest, current) =>
      current.currentHP < lowest.currentHP ? current : lowest,
    alivePlayers[0],
  );

  // Taunt override
  const tauntedBy = enemy.debuffs.find((d) => d.type === "taunt" && d.sourceId);
  if (tauntedBy) {
    const tauntTarget = alivePlayers.find(
      (p) => p.instanceId === tauntedBy.sourceId,
    );
    if (tauntTarget) target = tauntTarget;
  }

  let chosenSkill: SkillCard | UltimateCard | null = null;
  let actualTarget = target;

  const getSkillOfType = (type: string) =>
    enemy.skills.find((s) => s.type === type);

  // Priority 1: Heal / Cleanse
  const needsHeal = enemyTeam.some(
    (e) => e.currentHP > 0 && e.currentHP <= e.hp * 0.5,
  );
  const needsCleanse = enemyTeam.some(
    (e) => e.currentHP > 0 && e.debuffs.length > 0,
  );

  if (needsHeal || needsCleanse) {
    const healSkill = getSkillOfType("heal") || getSkillOfType("cleanse");
    if (healSkill) {
      chosenSkill = healSkill;
      // Target the ally that needs heal most
      actualTarget = enemyTeam
        .filter((e) => e.currentHP > 0)
        .reduce((lowest, current) =>
          current.currentHP < lowest.currentHP ? current : lowest,
        );
    }
  }

  // Priority 2: Ultimate
  if (!chosenSkill && enemy.ultimate && enemy.ultGauge >= 5) {
    chosenSkill = enemy.ultimate;
  }

  // Priority 3: Buff / Debuff
  if (!chosenSkill) {
    const buffSkill = getSkillOfType("buff");
    const debuffSkill = getSkillOfType("debuff");

    if (buffSkill) {
      chosenSkill = buffSkill;
      actualTarget = enemy; // Target self/allies for buff
    } else if (debuffSkill) {
      chosenSkill = debuffSkill;
    }
  }

  // Priority 4: Attack
  if (!chosenSkill) {
    const attackSkill = getSkillOfType("attack");
    if (attackSkill) chosenSkill = attackSkill;
  }

  // Priority 5: Stance
  if (!chosenSkill) {
    const stanceSkill = getSkillOfType("stance");
    if (stanceSkill) {
      chosenSkill = stanceSkill;
      actualTarget = enemy;
    }
  }

  // Fallback
  if (!chosenSkill) chosenSkill = enemy.skills[0];

  return {
    sourceInstanceId: enemy.instanceId,
    skill: chosenSkill,
    targetInstanceId: actualTarget.instanceId,
  };
}

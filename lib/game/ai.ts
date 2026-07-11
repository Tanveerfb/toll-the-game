import { BattleCharacter } from "@/types/character";
import { Action } from "@/types/action";
import { SkillCard } from "@/types/skillCard";
import { UltimateCard } from "@/types/ultimateCard";

/** Cap on actions the enemy side takes per enemy turn — any living enemy may act, in any order, no fixed pattern. */
export const ENEMY_ACTIONS_PER_TURN = 3;

/**
 * Ruling #39 (amends #4): the enemy side gets 1 action per living field
 * member, capped at ENEMY_ACTIONS_PER_TURN. Subs don't grant actions.
 */
export function enemyActionsForTurn(enemyTeam: BattleCharacter[]): number {
  const livingFieldMembers = enemyTeam.filter(
    (e) => e.currentHP > 0 && !e.isSub,
  ).length;
  return Math.min(ENEMY_ACTIONS_PER_TURN, livingFieldMembers);
}

/**
 * Picks a single AI action from the current battle state. Call once per
 * enemy action so each decision sees the results of the previous one.
 * Returns null when no enemy can act or no player is alive.
 */
export function getAIMove(
  enemyTeam: BattleCharacter[],
  playerTeam: BattleCharacter[],
): Action | null {
  // Subs cannot act or be targeted
  const alivePlayers = playerTeam.filter((p) => p.currentHP > 0 && !p.isSub);
  if (alivePlayers.length === 0) return null;

  const actingPool = enemyTeam.filter(
    (e) =>
      e.currentHP > 0 &&
      !e.isSub &&
      !e.debuffs.some((d) => d.type === "stun"),
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

  // Attack Seal blocks attack-type skills (ultimates and damaging
  // debuff-type skills stay legal)
  const attackSealed = enemy.debuffs.some(
    (d) => d.type === "seal" && d.sealType === "attack",
  );
  const getSkillOfType = (type: string) =>
    enemy.skills.find(
      (s) => s.type === type && !(attackSealed && s.type === "attack"),
    );

  // Priority 1: Heal / Cleanse
  const needsHeal = enemyTeam.some(
    (e) => e.currentHP > 0 && e.currentHP <= e.hp * 0.5,
  );
  // Ruling #30: uncancellable entries are "effects" — nothing to cleanse
  const needsCleanse = enemyTeam.some(
    (e) => e.currentHP > 0 && e.debuffs.some((d) => !d.uncancellable),
  );

  if (needsHeal || needsCleanse) {
    const healSkill = getSkillOfType("heal") || getSkillOfType("cleanse");
    if (healSkill) {
      chosenSkill = healSkill;
      // Target the on-field ally that needs heal most
      actualTarget = enemyTeam
        .filter((e) => e.currentHP > 0 && !e.isSub)
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

  // Fallback — first skill that isn't sealed, else skill 0 (executeSkill
  // fizzles sealed casts safely)
  if (!chosenSkill) {
    chosenSkill =
      enemy.skills.find(
        (s) => !(attackSealed && s.type === "attack"),
      ) || enemy.skills[0];
  }

  return {
    sourceInstanceId: enemy.instanceId,
    skill: chosenSkill,
    targetInstanceId: actualTarget.instanceId,
  };
}

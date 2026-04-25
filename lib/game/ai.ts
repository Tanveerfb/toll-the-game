import { BattleCharacter } from "@/types/character";
import { Action, TurnActions } from "@/types/action";
import { SkillCard } from "@/types/skillCard";
import { UltimateCard } from "@/types/ultimateCard";

export function getAIMoves(enemyTeam: BattleCharacter[], playerTeam: BattleCharacter[]): TurnActions {
  const actions: TurnActions = [];

  const alivePlayers = playerTeam.filter(p => p.currentHP > 0);
  if (alivePlayers.length === 0) return actions;

  for (const enemy of enemyTeam) {
    if (enemy.currentHP <= 0) continue;
    if (enemy.debuffs.some(d => d.type === "stun")) continue;

    // AI Target Selection
    let target = alivePlayers.reduce((lowest, current) => 
      (current.currentHP < lowest.currentHP) ? current : lowest
    , alivePlayers[0]);

    // Taunt override
    const tauntedBy = enemy.debuffs.find(d => d.type === "taunt" && d.sourceId);
    if (tauntedBy) {
        const tauntTarget = alivePlayers.find(p => p.instanceId === tauntedBy.sourceId);
        if (tauntTarget) target = tauntTarget;
    }

    let chosenSkill: SkillCard | UltimateCard | null = null;
    let actualTarget = target;

    const getSkillOfType = (type: string) => enemy.skills.find(s => s.type === type);

    // Priority 1: Heal / Cleanse
    const needsHeal = enemyTeam.some(e => e.currentHP > 0 && e.currentHP <= (e.hp * 0.5));
    const needsCleanse = enemyTeam.some(e => e.currentHP > 0 && e.debuffs.length > 0);
    
    if (needsHeal || needsCleanse) {
        const healSkill = getSkillOfType("heal") || getSkillOfType("cleanse");
        if (healSkill) {
            chosenSkill = healSkill;
            // Target the ally that needs heal most
            actualTarget = enemyTeam.filter(e => e.currentHP > 0).reduce((lowest, current) => 
                (current.currentHP < lowest.currentHP) ? current : lowest
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

    actions.push({
      sourceInstanceId: enemy.instanceId,
      skill: chosenSkill,
      targetInstanceId: actualTarget.instanceId
    });
  }

  return actions;
}

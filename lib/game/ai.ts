import { BattleCharacter } from "@/types/character";
import { Action, TurnActions } from "@/types/action";
import { SkillCard } from "@/types/skillCard";
import { UltimateCard } from "@/types/ultimateCard";

export function getAIMoves(enemyTeam: BattleCharacter[], playerTeam: BattleCharacter[]): TurnActions {
  const actions: TurnActions = [];

  const alivePlayers = playerTeam.filter(p => p.currentHP > 0);
  if (alivePlayers.length === 0) return actions;

  // AI Target Selection: lowest HP player
  const target = alivePlayers.reduce((lowest, current) => 
    (current.currentHP < lowest.currentHP) ? current : lowest
  , alivePlayers[0]);

  for (const enemy of enemyTeam) {
    if (enemy.currentHP <= 0) continue;

    // AI Skill Selection Priority
    // 1. Ultimate (if gauge full)
    // 2. Attack
    // (Stub for heal/buff logic for now)
    
    let chosenSkill: SkillCard | UltimateCard = enemy.skills[0]; // Default to first skill

    if (enemy.ultimate && enemy.ultGauge >= 100) { // Assuming 100 is full
      chosenSkill = enemy.ultimate;
    } else {
        // Just use an attack skill if available
        const attackSkill = enemy.skills.find(s => s.type === "attack");
        if (attackSkill) {
            chosenSkill = attackSkill;
        }
    }

    actions.push({
      sourceInstanceId: enemy.instanceId,
      skill: chosenSkill,
      targetInstanceId: target.instanceId
    });
  }

  return actions;
}

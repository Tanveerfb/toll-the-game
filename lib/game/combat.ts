import { BattleCharacter } from "@/types/character";
import { Action } from "@/types/action";
import { calculateDamage } from "./damage";
import { SkillCard } from "@/types/skillCard";
import { UltimateCard } from "@/types/ultimateCard";
import { Mechanic } from "@/types/mechanic";

function getSkillDamageMultiplier(skill: SkillCard | UltimateCard): number {
  if (skill.type === "ultimate") {
    return (skill as UltimateCard).damage / 100;
  } else {
    // Defaulting to rank 1 (index 0) for now. Future: accept rank in Action.
    return (skill as SkillCard).damageRanked[0] / 100;
  }
}

// Helper to normalize ranked mechanics values
function normalizeMechanic(mechanic: any, rankIndex: number = 0): Mechanic {
  const norm = { ...mechanic } as Mechanic;
  if (norm.valueRanked) {
    norm.value = norm.valueRanked[rankIndex];
  }
  if (norm.stacksRanked) {
    norm.stacks = norm.stacksRanked[rankIndex];
  }
  return norm;
}

export function executeSkill(
  action: Action,
  teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
  log: (entry: string) => void,
  actionIndex: number = 0
): { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] } {
  const allCharacters = [...teams.playerTeam, ...teams.enemyTeam];
  const source = allCharacters.find(c => c.instanceId === action.sourceInstanceId);
  const primaryTarget = allCharacters.find(c => c.instanceId === action.targetInstanceId);

  if (!source || source.currentHP <= 0 || !primaryTarget) {
    return teams;
  }

  const updatedTeams = {
    playerTeam: teams.playerTeam.map(c => ({...c, buffs: [...c.buffs], debuffs: [...c.debuffs], passiveState: {...c.passiveState}})),
    enemyTeam: teams.enemyTeam.map(c => ({...c, buffs: [...c.buffs], debuffs: [...c.debuffs], passiveState: {...c.passiveState}}))
  };

  const getUpdatedChar = (id: string) => 
    updatedTeams.playerTeam.find(c => c.instanceId === id) || 
    updatedTeams.enemyTeam.find(c => c.instanceId === id);

  const updatedSource = getUpdatedChar(source.instanceId)!;
  
  // -- PASSIVE TRIGGER: onFirstAction (Lyra)
  if (updatedSource.passive && updatedSource.passive.trigger === "onFirstAction") {
    if (actionIndex === 0 && !updatedSource.passiveState.firstActionTriggeredThisTurn) {
      log(`${updatedSource.name}'s passive '${updatedSource.passive.name}' triggered!`);
      updatedSource.buffs.push({
        type: "buff",
        stat: "def",
        valuePercent: 50,
        buffDuration: 1,
        unstackable: true,
        uncancellable: true
      });
      updatedSource.passiveState.firstActionTriggeredThisTurn = true;
    }
  }

  const skillMechanics = (action.skill as any).mechanics 
    ? ((action.skill as any).mechanics as any[]).map(m => normalizeMechanic(m, 0)) 
    : [];

  const isAoe = skillMechanics.some(m => m.type === "aoe");
  
  // Determine targets
  let targets: BattleCharacter[] = [];
  if (isAoe) {
     targets = source.team === "player" ? updatedTeams.enemyTeam : updatedTeams.playerTeam;
     targets = targets.filter(t => t.currentHP > 0);
     log(`${source.name} uses ${action.skill.skillName} (AoE)!`);
  } else {
     targets = [getUpdatedChar(primaryTarget.instanceId)!];
     log(`${source.name} uses ${action.skill.skillName} on ${primaryTarget.name}!`);
  }

  // Pre-calculate base stat
  const statMulti = action.skill.statMultiplier;
  let baseStat = 0;
  if (statMulti === 'atk') baseStat = updatedSource.currentAttack;
  else if (statMulti === 'def') baseStat = updatedSource.currentDefense;
  else if (statMulti === 'hp') baseStat = updatedSource.currentHP;
  
  const skillMultiplier = getSkillDamageMultiplier(action.skill);
  let baseDamage = baseStat * skillMultiplier;

  // -- PASSIVE TRIGGER & MECHANICS PRE-ATTACK (Consume Ignite for Tao)
  const consumeIgniteMech = skillMechanics.find(m => m.type === "consumeIgnite");
  if (consumeIgniteMech) {
    let totalIgnitesConsumed = 0;
    targets.forEach(t => {
      const igniteIdx = t.debuffs.findIndex(d => d.type === "ignite");
      if (igniteIdx !== -1) {
        totalIgnitesConsumed += t.debuffs[igniteIdx].stacks || 1;
        t.debuffs.splice(igniteIdx, 1);
      }
    });

    if (totalIgnitesConsumed > 0) {
      log(`${updatedSource.name} consumed ${totalIgnitesConsumed} Ignite stacks!`);
      if (consumeIgniteMech.effect === "buffAtk") {
         const buffAmount = (consumeIgniteMech.valuePerStackPercent || 0) * totalIgnitesConsumed;
         updatedSource.currentAttack += Math.floor(updatedSource.currentAttack * (buffAmount / 100));
         log(`${updatedSource.name} gained ${buffAmount}% ATK!`);
         if (statMulti === 'atk') baseDamage = updatedSource.currentAttack * skillMultiplier;
      }

      // Check Master Tao's passive
      if (updatedSource.passive && updatedSource.passive.trigger === "onIgniteConsume") {
         const passiveMech = updatedSource.passive.mechanics?.find((m: any) => m.type === "heal");
         if (passiveMech) {
            const currentCumulated = (updatedSource.passiveState.cumulatedIgnites as number) || 0;
            const newCumulated = currentCumulated + totalIgnitesConsumed;
            const triggerCount = Math.floor(newCumulated / passiveMech.conditionStacks);
            const remainder = newCumulated % passiveMech.conditionStacks;
            updatedSource.passiveState.cumulatedIgnites = remainder;

            let pastTriggers = (updatedSource.passiveState.healTriggers as number) || 0;
            for (let i=0; i<triggerCount; i++) {
               if (pastTriggers < passiveMech.maxTriggers) {
                 const healAmount = Math.floor(updatedSource.hp * (passiveMech.valuePercent / 100));
                 updatedSource.currentHP = Math.min(updatedSource.hp, updatedSource.currentHP + healAmount);
                 pastTriggers++;
                 log(`Healing Flames triggers! ${updatedSource.name} restores ${healAmount} HP! (${pastTriggers}/${passiveMech.maxTriggers})`);
               }
            }
            updatedSource.passiveState.healTriggers = pastTriggers;
         }
      }
    }
  }

  // Check Duke's Passive Empowerment BEFORE attack
  if (updatedSource.passive && updatedSource.passive.trigger === "afterSkill") {
    const ruinStacks = (updatedSource.passiveState.flowingRuinStacks as number) || 0;
    if (ruinStacks >= 3) {
      log(`${updatedSource.name} consumes Flowing Ruin empowerment! Damage increased by 50%!`);
      baseDamage = baseDamage * 1.5;
      updatedSource.passiveState.empowermentActive = true;
      updatedSource.passiveState.flowingRuinStacks = 0; // Consume
    }
  }

  // Process attack/ultimate
  const isAttack = action.skill.type === "attack" || action.skill.type === "ultimate";
  
  targets.forEach(updatedTarget => {
    if (updatedTarget.currentHP <= 0) return;

    if (isAttack) {
      const damage = calculateDamage({
        baseDamage,
        skillMechanics,
        target: updatedTarget
      });

      const finalDamage = Math.floor(damage);
      updatedTarget.currentHP = Math.max(0, updatedTarget.currentHP - finalDamage);
      log(`${updatedTarget.name} takes ${finalDamage} damage!`);

      // Apply skill mechanics (Debuffs like Decay, Ignite)
      skillMechanics.forEach(mech => {
        if (mech.type === "decay") {
          const decayDmg = Math.floor(finalDamage * ((mech.damagePercent || 10) / 100));
          updatedTarget.debuffs.push({
            type: "decay",
            stacks: mech.stacks,
            debuffDuration: mech.duration,
            capturedDamage: decayDmg
          });
          log(`${updatedTarget.name} is afflicted with Decay! (${decayDmg} dmg/turn)`);
        }
        if (mech.type === "ignite") {
          const existing = updatedTarget.debuffs.find(d => d.type === "ignite");
          if (existing) {
             existing.stacks = (existing.stacks || 1) + (mech.stacks || 1);
          } else {
             updatedTarget.debuffs.push({
               type: "ignite",
               stacks: mech.stacks,
               debuffDuration: 3 // assumed default
             });
          }
          log(`${updatedTarget.name} is Ignited!`);
        }
      });

      // Apply Duke's empowerment debuff
      if (updatedSource.passiveState.empowermentActive) {
         updatedTarget.debuffs.push({
           type: "debuff",
           stat: "atk",
           valuePercent: -20,
           debuffDuration: 2
         });
         log(`${updatedTarget.name}'s ATK reduced by Flowing Ruin!`);
      }

      if (updatedTarget.currentHP === 0) {
        log(`${updatedTarget.name} has been defeated!`);
      }
    } else if (action.skill.type === "heal") {
      const healAmount = Math.floor(baseDamage);
      updatedTarget.currentHP = Math.min(updatedTarget.hp, updatedTarget.currentHP + healAmount);
      log(`${updatedTarget.name} heals for ${healAmount} HP!`);
    }
  });

  // -- PASSIVE TRIGGER: afterSkill (Duke)
  if (updatedSource.passive && updatedSource.passive.trigger === "afterSkill") {
     if (updatedSource.passiveState.empowermentActive) {
         updatedSource.passiveState.empowermentActive = false; // reset
     } else {
         const currentStacks = (updatedSource.passiveState.flowingRuinStacks as number) || 0;
         updatedSource.passiveState.flowingRuinStacks = currentStacks + 1;
         log(`${updatedSource.name} gains a Flowing Ruin stack! (${updatedSource.passiveState.flowingRuinStacks}/3)`);
     }
  }

  return updatedTeams;
}

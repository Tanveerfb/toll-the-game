import { BattleCharacter } from "@/types/character";
import { QueueItem } from "@/hooks/MechanicProvider";
import { BattlePhase } from "@/types/mechanic";

type RegisterFn = (item: QueueItem) => void;

function mapTriggerToPhase(trigger: string): BattlePhase | null {
  const map: Record<string, BattlePhase> = {
    "onBattleStart": "OnBattleStart",
    "aura": "OnBattleStart",
    "OnPlayerTurnEnd": "OnPlayerTurnEnd",
    "OnEnemyTurnEnd": "OnEnemyTurnEnd",
    "OnPlayerTurnStart": "OnPlayerTurnStart",
    "OnEnemyTurnStart": "OnEnemyTurnStart"
  };
  return map[trigger] || null;
}

export function registerCharacterPassives(character: BattleCharacter, registerToQueue: RegisterFn) {
  if (!character.passive) return;

  const phase = mapTriggerToPhase(character.passive.trigger);

  if (phase) {
    registerToQueue({
      id: `${character.instanceId}_passive_${character.passive.name}`,
      phase: phase,
      sourceInstanceId: character.instanceId,
      mechanicId: character.passive.name,
      action: async (source, teams, log) => {
        
        const teamKey = source.team === "player" ? "playerTeam" : "enemyTeam";
        const mutateTeam = [...teams[teamKey]];
        let changed = false;

        source.passive?.mechanics?.forEach((mech: any) => {
          if (mech.type === "synergy") {
            const count = mech.conditionTags ? mutateTeam.filter(c => c.tags?.some(t => mech.conditionTags.includes(t))).length : 1;
            
            mutateTeam.forEach((ally, idx) => {
              let applies = false;
              if (mech.conditionColors && mech.conditionColors.includes(ally.color)) applies = true;
              if (mech.conditionTags && ally.tags?.some(t => mech.conditionTags.includes(t))) applies = true;
              
              if (applies) {
                const multiplier = mech.conditionTags ? count : 1;
                const totalPercent = mech.valuePercent * multiplier;
                
                const buff = {
                  type: (mech.stat === "damageDealt" ? "amplify" : "buff") as any,
                  stat: mech.stat,
                  valuePercent: totalPercent,
                  uncancellable: true,
                  name: `${source.passive!.name}`
                } as any;
                
                const t = { ...mutateTeam[idx], buffs: [...mutateTeam[idx].buffs, buff] };
                if (mech.stat === "all") {
                  t.currentAttack += Math.floor(t.atk * (totalPercent/100));
                  t.currentDefense += Math.floor(t.def * (totalPercent/100));
                  const hpBoost = Math.floor(t.hp * (totalPercent/100));
                  t.hp += hpBoost;
                  t.currentHP += hpBoost;
                } else if (mech.stat === "def") {
                  t.currentDefense += Math.floor(t.def * (totalPercent/100));
                } else if (mech.stat === "hp") {
                  const hpBoost = Math.floor(t.hp * (totalPercent/100));
                  t.hp += hpBoost;
                  t.currentHP += hpBoost;
                }
                mutateTeam[idx] = t;
                changed = true;
                log(`${ally.name} gained ${totalPercent}% ${mech.stat} from ${source.name}'s ${source.passive!.name}!`);
              }
            });
          }

          if (mech.type === "aura" && mech.conditionNoDeadAllies) {
            mutateTeam.forEach((ally, idx) => {
              const buff = {
                type: "buff" as any, stat: mech.stat, valuePercent: mech.valuePercent, uncancellable: true, name: source.passive!.name
              } as any;
              const t = { ...mutateTeam[idx], buffs: [...mutateTeam[idx].buffs, buff] };
              if (mech.stat === "hp") {
                const hpBoost = Math.floor(t.hp * (mech.valuePercent/100));
                t.hp += hpBoost;
                t.currentHP += hpBoost;
              }
              mutateTeam[idx] = t;
              changed = true;
              log(`${ally.name} gained ${mech.valuePercent}% ${mech.stat} from ${source.name}'s Aura!`);
            });
          }
        });

        if (changed) {
          return { ...teams, [teamKey]: mutateTeam };
        }
        return teams;
      }
    });
  }
}

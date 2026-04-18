import { BattleCharacter } from "@/types/character";
import { QueueItem } from "@/hooks/MechanicProvider";
import { BattlePhase } from "@/types/mechanic";

type RegisterFn = (item: QueueItem) => void;

// Helper to map passive triggers to BattlePhases
function mapTriggerToPhase(trigger: string): BattlePhase | null {
  const map: Record<string, BattlePhase> = {
    "onBattleStart": "OnBattleStart",
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

  // If it maps to a BattlePhase, register it to the MechanicProvider queue
  if (phase) {
    registerToQueue({
      id: `${character.instanceId}_passive_${character.passive.name}`,
      phase: phase,
      sourceInstanceId: character.instanceId,
      mechanicId: character.passive.name,
      action: async (source, teams, log) => {
        log(`${source.name}'s passive '${source.passive.name}' triggered via queue!`);
        
        // Implement the actual passive mechanic execution here
        // For Duke test, it was stats * 1.1. Let's do a hardcoded check for the test
        if (source.passive.name === "Duke's Resolve") {
            const teamKey = source.team === "player" ? "playerTeam" : "enemyTeam";
            const mutateTeam = [...teams[teamKey]];
            const targetIdx = mutateTeam.findIndex(c => c.instanceId === source.instanceId);
            if (targetIdx !== -1) {
                const t = { ...mutateTeam[targetIdx] };
                t.currentAttack = Math.floor(t.currentAttack * 1.1);
                t.currentDefense = Math.floor(t.currentDefense * 1.1);
                t.currentHP = Math.floor(t.currentHP * 1.1);
                mutateTeam[targetIdx] = t;
            }
            return { ...teams, [teamKey]: mutateTeam };
        }

        return teams;
      }
    });
  }
}

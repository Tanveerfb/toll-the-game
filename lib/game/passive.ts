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

  // Synergy/aura mechanics are battle-start effects even when the passive's
  // main trigger is combat-time (e.g. Batra's beforeSkill HP consume, Seras's
  // onAttackReceived Charged) -- without this fallback they never register.
  const hasBattleStartMechanics = character.passive.mechanics?.some(
    (m: any) => m.type === "synergy" || m.type === "aura",
  );
  const phase =
    mapTriggerToPhase(character.passive.trigger) ??
    (hasBattleStartMechanics ? "OnBattleStart" : null);

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
                // flatBonus: fixed % per carrier (Seras). Default: scales
                // with the number of tag carriers on the team (Batra).
                const multiplier =
                  mech.conditionTags && !mech.flatBonus ? count : 1;
                const totalPercent = mech.valuePercent * multiplier;
                
                const buff = {
                  type: (mech.stat === "damageDealt" ? "amplify" : "buff") as any,
                  stat: mech.stat,
                  valuePercent: totalPercent,
                  uncancellable: true,
                  preApplied: true,
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

  registerTurnRamp(character, registerToQueue);
  registerMaxHpShred(character, registerToQueue);
}

// Giant's Will (Diane): +valuePercent base ATK at the start of each of her
// team's turns AFTER the first, up to maxStacks. Uncancellable.
function registerTurnRamp(character: BattleCharacter, registerToQueue: RegisterFn) {
  const mech = character.passive?.mechanics?.find(
    (m: any) => m.type === "turnRamp",
  );
  if (!mech) return;

  registerToQueue({
    id: `${character.instanceId}_passive_${character.passive!.name}_turnRamp`,
    phase: character.team === "player" ? "OnPlayerTurnStart" : "OnEnemyTurnStart",
    sourceInstanceId: character.instanceId,
    mechanicId: `${character.passive!.name} (ramp)`,
    action: async (source, teams, log) => {
      const teamKey = source.team === "player" ? "playerTeam" : "enemyTeam";
      const team = [...teams[teamKey]];
      const idx = team.findIndex((c) => c.instanceId === source.instanceId);
      if (idx === -1 || team[idx].currentHP <= 0) return teams;

      const self = {
        ...team[idx],
        buffs: [...team[idx].buffs],
        passiveState: { ...team[idx].passiveState },
      };

      // "for each turn passed" — the first turn hasn't passed yet
      if (!self.passiveState.turnRampStarted) {
        self.passiveState.turnRampStarted = true;
        team[idx] = self;
        return { ...teams, [teamKey]: team };
      }

      const maxStacks = mech.maxStacks ?? 5;
      const stacks = (self.passiveState.turnRampStacks as number) || 0;
      if (stacks >= maxStacks) return teams;

      const percent = mech.valuePercent ?? 15;
      self.passiveState.turnRampStacks = stacks + 1;
      self.currentAttack += Math.floor(self.atk * (percent / 100));

      // Single display badge, updated in place (preApplied: gain is baked)
      const badgeName = character.passive!.name;
      const badgeIdx = self.buffs.findIndex((b) => b.name === badgeName);
      const badge = {
        type: "buff" as const,
        stat: "atk",
        valuePercent: percent * (stacks + 1),
        uncancellable: true,
        preApplied: true,
        name: badgeName,
      };
      if (badgeIdx === -1) self.buffs.push(badge);
      else self.buffs[badgeIdx] = badge;

      log(
        `${self.name}'s ${badgeName}: ATK +${percent}% (${stacks + 1}/${maxStacks}).`,
      );
      team[idx] = self;
      return { ...teams, [teamKey]: team };
    },
  });
}

// Extort Life (Ban): at the end of each full round — if he took NO damage
// since the last check, all enemies' max HP drops by valuePercent per stack
// (max maxStacks, uncancellable). Taking damage fully reverts the shred and
// resets the stacks (Tanveer ruling: full revert; no free heal on revert,
// current HP just re-clamps under the restored max).
function registerMaxHpShred(character: BattleCharacter, registerToQueue: RegisterFn) {
  const mech = character.passive?.mechanics?.find(
    (m: any) => m.type === "maxHpShred",
  );
  if (!mech) return;

  registerToQueue({
    id: `${character.instanceId}_passive_${character.passive!.name}_shred`,
    phase: "OnEnemyTurnEnd",
    sourceInstanceId: character.instanceId,
    mechanicId: `${character.passive!.name} (shred)`,
    action: async (source, teams, log) => {
      const teamKey = source.team === "player" ? "playerTeam" : "enemyTeam";
      const oppKey = source.team === "player" ? "enemyTeam" : "playerTeam";
      const team = [...teams[teamKey]];
      const opponents = [...teams[oppKey]];
      const idx = team.findIndex((c) => c.instanceId === source.instanceId);
      if (idx === -1 || team[idx].currentHP <= 0) return teams;

      const self = {
        ...team[idx],
        passiveState: { ...team[idx].passiveState },
      };
      const tookDamage = !!self.passiveState.tookDamageThisRound;
      self.passiveState.tookDamageThisRound = false;

      const maxStacks = mech.maxStacks ?? 5;
      const percent = mech.valuePercent ?? 8;
      const stacks = (self.passiveState.maxHpShredStacks as number) || 0;

      if (tookDamage) {
        if (stacks > 0) {
          self.passiveState.maxHpShredStacks = 0;
          for (let i = 0; i < opponents.length; i++) {
            const opp = {
              ...opponents[i],
              passiveState: { ...opponents[i].passiveState },
            };
            const base = opp.passiveState.maxHpShredBaseHp as
              | number
              | undefined;
            if (base) {
              opp.hp = base;
              delete opp.passiveState.maxHpShredBaseHp;
            }
            opponents[i] = opp;
          }
          log(
            `${self.name}'s ${character.passive!.name} resets — enemy max HP restored.`,
          );
        }
      } else if (stacks < maxStacks) {
        self.passiveState.maxHpShredStacks = stacks + 1;
        const totalPercent = percent * (stacks + 1);
        for (let i = 0; i < opponents.length; i++) {
          const opp = {
            ...opponents[i],
            passiveState: { ...opponents[i].passiveState },
          };
          if (opp.currentHP <= 0) continue;
          const base =
            (opp.passiveState.maxHpShredBaseHp as number | undefined) ?? opp.hp;
          opp.passiveState.maxHpShredBaseHp = base;
          opp.hp = Math.max(1, Math.floor(base * (1 - totalPercent / 100)));
          opp.currentHP = Math.min(opp.currentHP, opp.hp);
          opponents[i] = opp;
        }
        log(
          `${self.name}'s ${character.passive!.name}: all enemies' max HP -${totalPercent}% (${stacks + 1}/${maxStacks}).`,
        );
      }

      team[idx] = self;
      return { ...teams, [teamKey]: team, [oppKey]: opponents };
    },
  });
}

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
    return (skill as SkillCard).damageRanked[0] / 100;
  }
}

function normalizeMechanic(mechanic: any, rankIndex: number = 0): Mechanic {
  const norm = { ...mechanic } as Mechanic;
  if (norm.valueRanked) norm.value = norm.valueRanked[rankIndex];
  if (norm.stacksRanked) norm.stacks = norm.stacksRanked[rankIndex];
  if (norm.durationRanked) norm.duration = norm.durationRanked[rankIndex];
  return norm;
}

function formatTurns(duration?: number): string {
  if (!duration || duration <= 0) return "";
  return ` for ${duration} turn${duration > 1 ? "s" : ""}`;
}

function toPercentText(value?: number): string {
  if (typeof value !== "number") return "";
  return `${value}% `;
}

export function executeSkill(
  action: Action,
  teams: { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] },
  log: (entry: string) => void,
  actionIndex: number = 0,
): { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] } {
  const allCharacters = [...teams.playerTeam, ...teams.enemyTeam];
  const source = allCharacters.find(
    (c) => c.instanceId === action.sourceInstanceId,
  );
  const primaryTarget = allCharacters.find(
    (c) => c.instanceId === action.targetInstanceId,
  );

  if (!source || source.currentHP <= 0 || !primaryTarget) {
    return teams;
  }

  const updatedTeams = {
    playerTeam: teams.playerTeam.map((c) => ({
      ...c,
      buffs: [...c.buffs],
      debuffs: [...c.debuffs],
      passiveState: { ...c.passiveState },
    })),
    enemyTeam: teams.enemyTeam.map((c) => ({
      ...c,
      buffs: [...c.buffs],
      debuffs: [...c.debuffs],
      passiveState: { ...c.passiveState },
    })),
  };

  const getUpdatedChar = (id: string) =>
    updatedTeams.playerTeam.find((c) => c.instanceId === id) ||
    updatedTeams.enemyTeam.find((c) => c.instanceId === id);

  const updatedSource = getUpdatedChar(source.instanceId)!;

  // -- STUN CHECK
  if (updatedSource.debuffs.some((d) => d.type === "stun")) {
    log(`[Action] ${updatedSource.name} could not act due to stun.`);
    return updatedTeams;
  }

  // -- PRE-SKILL PASSIVES (Batra's HP consume)
  if (
    updatedSource.passive &&
    updatedSource.passive.trigger === "beforeSkill"
  ) {
    const consumeMech = updatedSource.passive.mechanics?.find(
      (m: any) => m.type === "consumeHpPercent",
    );
    if (consumeMech) {
      const consumeAmt = Math.floor(
        updatedSource.hp * (consumeMech.valuePercent / 100),
      );
      updatedSource.currentHP = Math.max(
        1,
        updatedSource.currentHP - consumeAmt,
      );
      log(`${updatedSource.name} consumes ${consumeAmt} HP for their skill!`);
    }
  }

  // -- PASSIVE TRIGGER: onFirstAction (Lyra)
  if (
    updatedSource.passive &&
    updatedSource.passive.trigger === "onFirstAction"
  ) {
    if (
      actionIndex === 0 &&
      !updatedSource.passiveState.firstActionTriggeredThisTurn
    ) {
      log(
        `${updatedSource.name}'s passive '${updatedSource.passive.name}' triggered!`,
      );
      updatedSource.buffs.push({
        type: "buff",
        stat: "def",
        valuePercent: 50,
        buffDuration: 1,
        unstackable: true,
        uncancellable: true,
      });
      updatedSource.passiveState.firstActionTriggeredThisTurn = true;
    }
  }

  // -- ALLY SKILL USE TRACKER (Yalina Momentum)
  const sourceTeam =
    source.team === "player" ? updatedTeams.playerTeam : updatedTeams.enemyTeam;
  sourceTeam.forEach((ally) => {
    if (
      ally.instanceId !== updatedSource.instanceId &&
      ally.passive?.trigger === "onAllySkill"
    ) {
      const mech = ally.passive.mechanics?.find(
        (m: any) => m.type === "momentumStacks",
      );
      if (mech) {
        const currentStacks = (ally.passiveState.momentumStacks as number) || 0;
        if (currentStacks < mech.maxStacks) {
          ally.passiveState.momentumStacks = currentStacks + 1;
          log(
            `${ally.name} gains Momentum! (${ally.passiveState.momentumStacks}/${mech.maxStacks})`,
          );
        }
      }
    }
  });

  const skillMechanics = (action.skill as any).mechanics
    ? ((action.skill as any).mechanics as any[]).map((m) =>
        normalizeMechanic(m, 0),
      )
    : [];

  const isAoe = skillMechanics.some(
    (m) => m.type === "aoe" || (m.type === "aoeRanked" && m.ranks?.[0]),
  );
  const isAttack =
    action.skill.type === "attack" || action.skill.type === "ultimate";
  const isHealOrBuff =
    action.skill.type === "heal" ||
    action.skill.type === "buff" ||
    action.skill.type === "stance";

  // Determine targets
  let targets: BattleCharacter[] = [];
  const enemyTeamForSource =
    source.team === "player" ? updatedTeams.enemyTeam : updatedTeams.playerTeam;
  const alliedTeamForSource =
    source.team === "player" ? updatedTeams.playerTeam : updatedTeams.enemyTeam;

  if (isAoe) {
    targets = isHealOrBuff ? alliedTeamForSource : enemyTeamForSource;
    targets = targets.filter((t) => t.currentHP > 0);
  } else {
    let actualTarget = getUpdatedChar(primaryTarget.instanceId)!;
    // Taunt override for single-target attacks
    if (isAttack) {
      const tauntedBy = updatedSource.debuffs.find(
        (d) => d.type === "taunt" && d.sourceId,
      );
      if (tauntedBy) {
        const tauntTarget = getUpdatedChar(tauntedBy.sourceId);
        if (tauntTarget && tauntTarget.currentHP > 0) {
          actualTarget = tauntTarget;
          log(
            `[Action] ${updatedSource.name} was taunted and redirected to ${tauntTarget.name}.`,
          );
        }
      }
    }
    targets = [actualTarget];
  }

  // Pre-calculate base stat
  const statMulti = action.skill.statMultiplier;
  let baseStat = 0;
  if (statMulti === "atk") baseStat = updatedSource.currentAttack;
  else if (statMulti === "def") baseStat = updatedSource.currentDefense;
  else if (statMulti === "hp") baseStat = updatedSource.hp; // Max HP scaling per user comment

  const skillMultiplier = getSkillDamageMultiplier(action.skill);
  let baseDamage = baseStat * skillMultiplier;

  // -- DYNAMIC DAMAGE MULTIPLIERS
  const spiteMech = skillMechanics.find((m) => m.type === "spite");
  if (spiteMech && isAttack) {
    const missingHpPercent =
      100 - (updatedSource.currentHP / updatedSource.hp) * 100;
    const multiplier = 1 + (missingHpPercent * 2) / 100;
    baseDamage *= multiplier;
    log(
      `${updatedSource.name} deals ${Math.floor((multiplier - 1) * 100)}% bonus Spite damage!`,
    );
  }

  const concentrateMech = skillMechanics.find((m) => m.type === "concentrate");
  if (concentrateMech && isAttack && isAoe) {
    const aliveEnemies = targets.length;
    let multiplier = 1.0;
    if (aliveEnemies === 1) multiplier = 1.5;
    else if (aliveEnemies === 2) multiplier = 1.2;
    else if (aliveEnemies === 3) multiplier = 1.1;
    baseDamage *= multiplier;
    log(
      `${updatedSource.name} concentrates attack (+${Math.floor((multiplier - 1) * 100)}% dmg)!`,
    );
  }

  const amplifyMech = skillMechanics.find((m) => m.type === "amplify");
  if (amplifyMech && isAttack) {
    const buffCount = updatedSource.buffs.length;
    const multiplier = 1 + (buffCount * (amplifyMech.valuePercent || 10)) / 100;
    baseDamage *= multiplier;
    log(
      `${updatedSource.name} amplifies attack (+${Math.floor((multiplier - 1) * 100)}% dmg)!`,
    );
  }

  // Yalina Momentum passive damage boost
  if (
    updatedSource.passive &&
    updatedSource.passive.trigger === "onAllySkill" &&
    isAttack
  ) {
    const stacks = (updatedSource.passiveState.momentumStacks as number) || 0;
    if (stacks > 0) {
      const mech = updatedSource.passive.mechanics?.find(
        (m: any) => m.type === "momentumStacks",
      );
      if (mech) {
        const bonus = stacks * mech.valuePercent;
        baseDamage *= 1 + bonus / 100;
        log(`${updatedSource.name} uses Momentum for +${bonus}% damage!`);
        updatedSource.passiveState.momentumStacks = 0; // Clear stacks
      }
    }
  }

  // -- CONSUME IGNITE (Tao)
  const consumeIgniteMech = skillMechanics.find(
    (m) => m.type === "consumeIgnite",
  );
  if (consumeIgniteMech) {
    let totalIgnitesConsumed = 0;
    targets.forEach((t) => {
      const igniteIdx = t.debuffs.findIndex((d) => d.type === "ignite");
      if (igniteIdx !== -1) {
        totalIgnitesConsumed += t.debuffs[igniteIdx].stacks || 1;
        t.debuffs.splice(igniteIdx, 1);
      }
    });

    if (totalIgnitesConsumed > 0) {
      log(
        `${updatedSource.name} consumed ${totalIgnitesConsumed} Ignite stacks!`,
      );
      if (consumeIgniteMech.effect === "buffAtk") {
        const buffAmount =
          (consumeIgniteMech.valuePerStackPercent || 0) * totalIgnitesConsumed;
        updatedSource.currentAttack += Math.floor(
          updatedSource.currentAttack * (buffAmount / 100),
        );
        log(`${updatedSource.name} gained ${buffAmount}% ATK!`);
        if (statMulti === "atk")
          baseDamage = updatedSource.currentAttack * skillMultiplier;
      }
    }
  }

  // Process attack/ultimate/heal/buff
  let totalDamageDealt = 0;

  targets.forEach((updatedTarget) => {
    if (updatedTarget.currentHP <= 0) return;

    const targetEffects: string[] = [];
    let dealtDamage = 0;
    let healedAmount = 0;

    if (isAttack) {
      const damage = calculateDamage({
        baseDamage,
        skillMechanics,
        target: updatedTarget,
      });

      const finalDamage = Math.floor(damage);
      dealtDamage = finalDamage;
      totalDamageDealt += finalDamage;

      const newHp = updatedTarget.currentHP - finalDamage;

      // -- LETHAL DAMAGE SURVIVAL (Sara)
      if (
        newHp <= 0 &&
        updatedTarget.passive &&
        updatedTarget.passive.trigger === "onLethalDamage"
      ) {
        if (
          !updatedTarget.passiveState.lethalSurvived &&
          updatedTarget.currentHP >= updatedTarget.hp * 0.3
        ) {
          const healMech = updatedTarget.passive.mechanics?.find(
            (m: any) => m.type === "surviveLethal",
          );
          if (healMech) {
            const healAmount = Math.floor(
              finalDamage * (healMech.healDamagePercent / 100),
            );
            updatedTarget.currentHP = Math.max(1, healAmount);
            updatedTarget.passiveState.lethalSurvived = true;
            targetEffects.push(
              `triggered Nine Lives and healed ${healAmount} HP`,
            );
          } else {
            updatedTarget.currentHP = 0;
          }
        } else {
          updatedTarget.currentHP = 0;
        }
      } else {
        updatedTarget.currentHP = Math.max(0, newHp);
      }

      // Apply skill mechanics (Debuffs)
      skillMechanics.forEach((mech) => {
        if (mech.type === "decay") {
          const decayDmg = Math.floor(
            finalDamage * ((mech.damagePercent || 10) / 100),
          );
          updatedTarget.debuffs.push({
            type: "decay",
            stacks: mech.stacks,
            debuffDuration: mech.duration,
            capturedDamage: decayDmg,
          });
          targetEffects.push(`applied decay${formatTurns(mech.duration)}`);
        }
        if (mech.type === "ignite") {
          const existing = updatedTarget.debuffs.find(
            (d) => d.type === "ignite",
          );
          if (existing)
            existing.stacks = (existing.stacks || 1) + (mech.stacks || 1);
          else
            updatedTarget.debuffs.push({
              type: "ignite",
              stacks: mech.stacks,
              debuffDuration: mech.duration || 3,
            });
          targetEffects.push(
            `applied ignite (${mech.stacks || 1} stack${(mech.stacks || 1) > 1 ? "s" : ""})${formatTurns(mech.duration || 3)}`,
          );
        }
        if (mech.type === "lowerUltGauge") {
          const reducedBy = mech.value || 1;
          updatedTarget.ultGauge = Math.max(
            0,
            updatedTarget.ultGauge - reducedBy,
          );
          targetEffects.push(`reduced ultimate gauge by ${reducedBy}`);
        }
        if (mech.type === "stun") {
          updatedTarget.debuffs.push({
            type: "stun",
            debuffDuration: mech.duration || 1,
          });
          targetEffects.push(`applied stun${formatTurns(mech.duration || 1)}`);
        }
        if (mech.type === "cancelBuffs") {
          updatedTarget.buffs = [];
          targetEffects.push("cancelled buffs");
        }
        if (mech.type === "cancelStances") {
          updatedTarget.buffs = updatedTarget.buffs.filter(
            (b) => b.type !== "stance",
          );
          targetEffects.push("cancelled stances");
        }
        if (mech.type === "debuff") {
          updatedTarget.debuffs.push({
            type: "debuff",
            stat: mech.stat,
            valuePercent: mech.valuePercent || mech.value,
            debuffDuration: mech.duration,
          });
          targetEffects.push(
            `lowered ${mech.stat || "stat"} by ${toPercentText(mech.valuePercent || mech.value)}${formatTurns(mech.duration)}`.trim(),
          );
        }
        if (mech.type === "taunt") {
          // Applied to enemy, overriding their target
          updatedTarget.debuffs.push({
            type: "taunt",
            debuffDuration: mech.duration,
            sourceId: updatedSource.instanceId,
          });
          targetEffects.push(`applied taunt${formatTurns(mech.duration)}`);
        }
      });

      if (updatedTarget.currentHP === 0) {
        targetEffects.push("defeated");
      }
    } else if (action.skill.type === "heal") {
      const healAmount = Math.floor(baseDamage);
      healedAmount = healAmount;
      updatedTarget.currentHP = Math.min(
        updatedTarget.hp,
        updatedTarget.currentHP + healAmount,
      );
    }

    // Friendly buffs/cleanses applied even if it's an attack (if targetSelf is true or targets are allies)
    skillMechanics.forEach((mech) => {
      if (mech.type === "cleanse" && isHealOrBuff) {
        updatedTarget.debuffs = [];
        targetEffects.push("cleansed all debuffs");
      }
      if (
        (mech.type === "buff" || mech.type === "stance") &&
        (!mech.targetSelf ||
          updatedTarget.instanceId === updatedSource.instanceId)
      ) {
        updatedTarget.buffs.push({
          type: mech.type,
          stat: mech.stat,
          valuePercent: mech.valuePercent || mech.value,
          buffDuration: mech.duration,
        });
        targetEffects.push(
          `applied ${mech.type} to ${mech.stat || "stat"} by ${toPercentText(mech.valuePercent || mech.value)}${formatTurns(mech.duration)}`.trim(),
        );
      }
    });

    if (isAttack) {
      log(
        `[Action] ${updatedSource.name} used ${action.skill.skillName} and dealt ${dealtDamage} damage to ${updatedTarget.name}${targetEffects.length > 0 ? ` causing ${targetEffects.join(", ")}` : ""}.`,
      );
    } else if (action.skill.type === "heal") {
      log(
        `[Action] ${updatedSource.name} used ${action.skill.skillName} and restored ${healedAmount} HP to ${updatedTarget.name}${targetEffects.length > 0 ? ` causing ${targetEffects.join(", ")}` : ""}.`,
      );
    } else {
      log(
        `[Action] ${updatedSource.name} used ${action.skill.skillName} on ${updatedTarget.name}${targetEffects.length > 0 ? ` causing ${targetEffects.join(", ")}` : "."}`,
      );
    }
  });

  // -- POST-DAMAGE PASSIVES
  if (
    totalDamageDealt > 0 &&
    updatedSource.passive &&
    updatedSource.passive.trigger === "onDamageDealt"
  ) {
    const lifestealMech = updatedSource.passive.mechanics?.find(
      (m: any) => m.type === "healLifesteal",
    );
    if (
      lifestealMech &&
      updatedSource.currentHP <
        updatedSource.hp * (lifestealMech.hpConditionPercent / 100)
    ) {
      const heal = Math.floor(
        totalDamageDealt * (lifestealMech.lifestealPercent / 100),
      );
      updatedSource.currentHP = Math.min(
        updatedSource.hp,
        updatedSource.currentHP + heal,
      );
      log(`${updatedSource.name}'s Vampiric Roots restores ${heal} HP!`);
    }
  }

  // Duke empowerment
  if (updatedSource.passive && updatedSource.passive.trigger === "afterSkill") {
    const currentStacks =
      (updatedSource.passiveState.flowingRuinStacks as number) || 0;
    updatedSource.passiveState.flowingRuinStacks = currentStacks + 1;
  }

  return updatedTeams;
}

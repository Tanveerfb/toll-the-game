import { BattleCharacter } from "@/types/character";
import { Action } from "@/types/action";
import { calculateDamage } from "./damage";
import { getEvadeChance } from "./evade";
import { trySurviveLethal } from "./lethal";
import { syncExtortLinks } from "./effects";
import { getEffectiveAttack, getEffectiveDefense } from "./stats";
import { SkillCard } from "@/types/skillCard";
import { UltimateCard } from "@/types/ultimateCard";
import {
  BuffMechanic,
  ConditionalBuffMechanic,
  Mechanic,
} from "@/types/mechanic";
import type {
  BattleEventEmitter,
  BattleEventTarget,
  BattleEventCounter,
} from "@/types/battleEvent";

// Crit chance in percent — base 0 for everyone (same rule as evade). A crit
// applies the full CRITICAL package (50% DEF ignore, type-immune, +50% dmg).
// Currently sourced from Deathblow-style passives: +critPerStepPercent per
// hpStepPercent of max HP lost.
export function getCritChance(char: BattleCharacter): number {
  let chance = 0;
  const deathblow = char.passive?.mechanics?.find(
    (m) => m.type === "deathblow",
  );
  if (deathblow && !char.isSub) {
    const lostPercent = (1 - char.currentHP / char.hp) * 100;
    const steps = Math.floor(lostPercent / (deathblow.hpStepPercent ?? 3));
    chance += steps * (deathblow.critPerStepPercent ?? 2);
  }
  return chance;
}

// Charged-style passive (Seras): the unit gains a stack whenever it receives
// or evades an attack; each stack adds ATK/DEF now and evade chance via
// getEvadeChance.
function gainChargedStack(char: BattleCharacter, log: (e: string) => void) {
  if (char.passive?.trigger !== "onAttackReceived") return;
  const mech = char.passive.mechanics?.find(
    (m) => m.type === "chargedStacks",
  );
  if (!mech) return;
  const maxStacks = mech.maxStacks ?? 5;
  const current = (char.passiveState.chargedStacks as number) || 0;
  if (current >= maxStacks) return;
  char.passiveState.chargedStacks = current + 1;
  char.currentAttack += Math.floor(
    char.atk * ((mech.atkPerStackPercent ?? 5) / 100),
  );
  char.currentDefense += Math.floor(
    char.def * ((mech.defPerStackPercent ?? 5) / 100),
  );
  log(
    `${char.name} gains a Charged stack (${current + 1}/${maxStacks})!`,
  );
}

// Rookie Hunter / Prodigy Assassin (Gon/Killua): after receiving N attacks
// in battle (evades count — same rule as Charged), permanently shift stats
// by a signed % of base. Fires once; baked into current stats so it can't
// be cleansed or cancelled.
function gainAttackReceivedShift(
  char: BattleCharacter,
  log: (e: string) => void,
) {
  if (char.passive?.trigger !== "onAttackReceived") return;
  const mech = char.passive.mechanics?.find(
    (m) => m.type === "statShiftAfterAttacks",
  );
  if (!mech) return;
  if (char.isSub && char.passive.worksFromSub === false) return;
  if (char.passiveState.statShiftTriggered) return;

  const required = mech.attacksRequired ?? 10;
  const count = ((char.passiveState.attacksReceived as number) || 0) + 1;
  char.passiveState.attacksReceived = count;
  if (count < required) return;

  char.passiveState.statShiftTriggered = true;
  // trunc, not floor — floor turns -47.5 into -48 and over-penalizes
  const atkShift = Math.trunc(char.atk * ((mech.atkShiftPercent ?? 0) / 100));
  const defShift = Math.trunc(char.def * ((mech.defShiftPercent ?? 0) / 100));
  char.currentAttack = Math.max(0, char.currentAttack + atkShift);
  char.currentDefense = Math.max(0, char.currentDefense + defShift);
  char.buffs.push({
    type: "buff",
    stat: "all",
    uncancellable: true,
    preApplied: true,
    name: char.passive.name,
  });
  log(
    `${char.name}'s ${char.passive.name} activates! ATK ${atkShift >= 0 ? "+" : ""}${atkShift}, DEF ${defShift >= 0 ? "+" : ""}${defShift}.`,
  );
}

// Everything that reacts to "receiving an attack" (hit OR evade)
function handleAttackReceived(char: BattleCharacter, log: (e: string) => void) {
  gainChargedStack(char, log);
  gainAttackReceivedShift(char, log);
}

// Returns the damage percent (e.g. 205 for 205%). Callers multiply the stat
// first, then divide by 100 — dividing first introduces float error
// (100 * (205/100) === 204.999…, which floors to 204).
function getSkillDamagePercent(
  skill: SkillCard | UltimateCard,
  rankIndex: number,
): number {
  if (skill.type === "ultimate") {
    return (skill as UltimateCard).damage;
  } else {
    return (skill as SkillCard).damageRanked[rankIndex];
  }
}

function normalizeMechanic(mechanic: Mechanic, rankIndex: number = 0): Mechanic {
  const norm = { ...mechanic };
  if (norm.valueRanked) norm.value = norm.valueRanked[rankIndex];
  if (norm.stacksRanked) norm.stacks = norm.stacksRanked[rankIndex];
  if (norm.durationRanked) norm.duration = norm.durationRanked[rankIndex];
  if (norm.counterDamagePercentRanked)
    norm.counterDamagePercent = norm.counterDamagePercentRanked[rankIndex];
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
  // Injectable randomness so evade rolls are deterministic in tests
  rng: () => number = Math.random,
  // Structured event stream for the UI animation sequencer (optional —
  // engine behavior is identical without it)
  emit?: BattleEventEmitter,
): { playerTeam: BattleCharacter[]; enemyTeam: BattleCharacter[] } {
  const allCharacters = [...teams.playerTeam, ...teams.enemyTeam];
  const source = allCharacters.find(
    (c) => c.instanceId === action.sourceInstanceId,
  );

  // Enemy targeting is optional (ruling 2026-07-12): a card queued without a
  // marked enemy picks a random living field enemy at execution time. Taunt
  // redirects still apply afterwards. AoE is unaffected — the random pick is
  // just the anchor target.
  let targetInstanceId = action.targetInstanceId;
  const needsEnemyTarget = ["attack", "debuff", "disable", "ultimate"].includes(
    action.skill.type,
  );
  if (!targetInstanceId && needsEnemyTarget && source) {
    const opposingTeam =
      source.team === "player" ? teams.enemyTeam : teams.playerTeam;
    const pool = opposingTeam.filter((c) => c.currentHP > 0 && !c.isSub);
    if (pool.length > 0) {
      targetInstanceId = pool[Math.floor(rng() * pool.length)].instanceId;
    }
  }

  const primaryTarget = allCharacters.find(
    (c) => c.instanceId === targetInstanceId,
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

  // -- SEAL CHECK (defense in depth — the UI/AI should not offer sealed
  // skills, but never let one through). Attack Seal blocks attack-type
  // skills only; ultimates and damaging debuff skills stay usable.
  if (
    action.skill.type === "attack" &&
    updatedSource.debuffs.some(
      (d) => d.type === "seal" && d.sealType === "attack",
    )
  ) {
    log(
      `[Action] ${updatedSource.name}'s attack skills are sealed — ${action.skill.skillName} fizzles.`,
    );
    return updatedTeams;
  }

  // -- PRE-SKILL PASSIVES (Batra's HP consume)
  if (
    updatedSource.passive &&
    updatedSource.passive.trigger === "beforeSkill"
  ) {
    const consumeMech = updatedSource.passive.mechanics?.find(
      (m) => m.type === "consumeHpPercent",
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

  // -- ALLY SKILL USE TRACKER (Yalina Momentum) — ruling #34: every card her
  // team plays grants a stack, INCLUDING her own, but only while she is on
  // the field (not benched) and alive
  const sourceTeam =
    source.team === "player" ? updatedTeams.playerTeam : updatedTeams.enemyTeam;
  sourceTeam.forEach((ally) => {
    if (
      !ally.isSub &&
      ally.currentHP > 0 &&
      ally.passive?.trigger === "onAllySkill"
    ) {
      const mech = ally.passive.mechanics?.find(
        (m) => m.type === "momentumStacks",
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

  const rankIndex = (action.rank ?? 1) - 1;
  const skillMechanics = (action.skill.mechanics ?? []).map((m) =>
    normalizeMechanic(m, rankIndex),
  );

  const isAoe = skillMechanics.some(
    (m) => m.type === "aoe" || (m.type === "aoeRanked" && m.ranks?.[rankIndex]),
  );
  const isHealOrBuff =
    action.skill.type === "heal" ||
    action.skill.type === "buff" ||
    action.skill.type === "stance";
  // A skill deals damage whenever its numbers say so, regardless of type —
  // e.g. debuff-type skills with damageRanked > 0 hit AND debuff. Heal-type
  // skills reuse damageRanked as the heal amount, so they are excluded.
  const isAttack =
    action.skill.type === "attack" ||
    action.skill.type === "ultimate" ||
    (!isHealOrBuff &&
      getSkillDamagePercent(action.skill, (action.rank ?? 1) - 1) > 0);
  // Offensive skills apply their hostile mechanics even when damage is 0
  // (e.g. Draw Fire: 0 damage, taunts all enemies).
  const isOffensive =
    isAttack ||
    action.skill.type === "debuff" ||
    action.skill.type === "disable";

  // Determine targets
  let targets: BattleCharacter[] = [];
  const enemyTeamForSource =
    source.team === "player" ? updatedTeams.enemyTeam : updatedTeams.playerTeam;
  const alliedTeamForSource =
    source.team === "player" ? updatedTeams.playerTeam : updatedTeams.enemyTeam;

  if (isAoe) {
    targets = isHealOrBuff ? alliedTeamForSource : enemyTeamForSource;
    // Sub (bench) units cannot be targeted
    targets = targets.filter((t) => t.currentHP > 0 && !t.isSub);
  } else {
    let actualTarget = getUpdatedChar(primaryTarget.instanceId)!;
    // Taunt override for single-target offensive skills
    if (isOffensive) {
      const tauntedBy = updatedSource.debuffs.find(
        (d) => d.type === "taunt" && d.sourceId,
      );
      if (tauntedBy?.sourceId) {
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

  // Self-targeted buffs apply BEFORE the damage calc (Tanveer ruling:
  // "buff first, hit boosted" — Gon's Jajanken Rock benefits from its own
  // +30% ATK). They apply to the source regardless of who the skill targets
  // (e.g. Draw Fire taunts enemies while buffing Yalina herself).
  skillMechanics.forEach((mech) => {
    if ((mech.type === "buff" || mech.type === "stance") && mech.targetSelf) {
      updatedSource.buffs.push({
        type: mech.type,
        stat: mech.stat,
        // Counter stances carry no stat percent — their number is the
        // counter damage, not a stat modifier
        valuePercent: mech.counterDamagePercent
          ? undefined
          : mech.valuePercent || mech.value,
        counterDamagePercent: mech.counterDamagePercent,
        name: mech.name,
        buffDuration: mech.duration,
        unstackable: mech.unstackable,
        uncancellable: mech.uncancellable,
      });
      log(
        `[Action] ${updatedSource.name} gained ${mech.type} to ${mech.stat || "stat"} by ${toPercentText(mech.valuePercent || mech.value)}${formatTurns(mech.duration)}`.trim() +
          ".",
      );
    }
  });

  // Pre-calculate base stat — effective values honor stat buffs/debuffs
  const statMulti = action.skill.statMultiplier;
  let baseStat = 0;
  if (statMulti === "atk") baseStat = getEffectiveAttack(updatedSource);
  else if (statMulti === "def") baseStat = getEffectiveDefense(updatedSource);
  else if (statMulti === "hp") baseStat = updatedSource.hp; // Max HP scaling per user comment

  const skillDamagePercent = getSkillDamagePercent(action.skill, rankIndex);
  let baseDamage = (baseStat * skillDamagePercent) / 100;

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

  // Deathblow (Meliodas): +damagePerStepPercent per hpStepPercent of max HP
  // lost. Inactive from the sub position by design.
  const deathblowMech = updatedSource.passive?.mechanics?.find(
    (m) => m.type === "deathblow",
  );
  if (deathblowMech && !updatedSource.isSub && isAttack) {
    const lostPercent =
      (1 - updatedSource.currentHP / updatedSource.hp) * 100;
    const steps = Math.floor(lostPercent / (deathblowMech.hpStepPercent ?? 3));
    const bonus = steps * (deathblowMech.damagePerStepPercent ?? 2);
    if (bonus > 0) {
      baseDamage *= 1 + bonus / 100;
      log(`${updatedSource.name}'s Deathblow adds +${bonus}% damage!`);
    }
  }

  const amplifyMech = skillMechanics.find((m) => m.type === "amplify");
  if (amplifyMech && isAttack) {
    // Ruling #30: uncancellable "effects" don't count as buffs for Amplify
    const buffCount = updatedSource.buffs.filter(
      (b) => !b.uncancellable,
    ).length;
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
        (m) => m.type === "momentumStacks",
      );
      if (mech) {
        const bonus = stacks * mech.valuePercent;
        baseDamage *= 1 + bonus / 100;
        log(`${updatedSource.name} uses Momentum for +${bonus}% damage!`);
        updatedSource.passiveState.momentumStacks = 0; // Clear stacks
      }
    }
  }

  // -- FLOWING RUIN CONSUME (Duke) — at conditionStacks, this action consumes
  // all stacks for bonus damage and applies an ATK debuff to every target hit
  let flowingRuinMech: ConditionalBuffMechanic | undefined;
  if (updatedSource.passive?.trigger === "afterSkill" && isAttack) {
    const mech = updatedSource.passive.mechanics?.find(
      (m): m is ConditionalBuffMechanic =>
        m.type === "conditionalBuff" && Boolean(m.conditionStacks),
    );
    const stacks =
      (updatedSource.passiveState.flowingRuinStacks as number) || 0;
    if (mech?.conditionStacks && stacks >= mech.conditionStacks) {
      flowingRuinMech = mech;
      updatedSource.passiveState.flowingRuinStacks = 0;
      const bonus = mech.damageBonusPercent ?? 50;
      baseDamage *= 1 + bonus / 100;
      log(
        `${updatedSource.name}'s ${updatedSource.passive.name} empowers this attack (+${bonus}% damage)!`,
      );
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
          baseDamage =
            (updatedSource.currentAttack * skillDamagePercent) / 100;
      }
    }
  }

  // Structured event payload built alongside the log entries
  const eventTargets: BattleEventTarget[] = [];
  const eventCounters: BattleEventCounter[] = [];

  // Process attack/ultimate/heal/buff
  let totalDamageDealt = 0;
  // Extort accumulates flat steals across all targets, applied once after
  // the loop (refresh semantics — never stacks with a previous Extort)
  const extortGains = { atk: 0, def: 0, duration: undefined as number | undefined };

  // Ruling #38: Extort never stacks — a recast OVERWRITES the previous
  // Extort entirely, even if the old steal was more potent. Strip this
  // thief's old Extort debuffs from every opposing unit before applying
  // the new ones (the self-buff is rebuilt after the target loop).
  if (skillMechanics.some((m) => m.type === "extort")) {
    const opposition =
      updatedSource.team === "player"
        ? updatedTeams.enemyTeam
        : updatedTeams.playerTeam;
    opposition.forEach((opp) => {
      opp.debuffs = opp.debuffs.filter(
        (d) => !(d.name === "Extort" && d.sourceId === updatedSource.instanceId),
      );
    });
  }

  targets.forEach((updatedTarget) => {
    if (updatedTarget.currentHP <= 0) return;

    // -- EVADE ROLL — an evaded attack deals no damage and applies none of
    // its hostile effects; evading still counts as "receiving an attack"
    // for Charged-style passives
    if (isAttack && updatedTarget.team !== updatedSource.team) {
      const evadeChance = getEvadeChance(updatedTarget);
      if (evadeChance > 0 && rng() * 100 < evadeChance) {
        log(
          `[Action] ${updatedTarget.name} evaded ${updatedSource.name}'s ${action.skill.skillName}!`,
        );
        eventTargets.push({
          instanceId: updatedTarget.instanceId,
          name: updatedTarget.name,
          evaded: true,
        });
        handleAttackReceived(updatedTarget, log);
        return;
      }
    }

    const targetEvent: BattleEventTarget = {
      instanceId: updatedTarget.instanceId,
      name: updatedTarget.name,
      hpBefore: updatedTarget.currentHP,
    };
    const targetEffects: string[] = [];
    let dealtDamage = 0;
    let healedAmount = 0;

    // Cancels resolve BEFORE damage (Evil Spirit order: strip stances and
    // buffs, then hit) — canceling a counter stance prevents the counter.
    // Uncancellable effects (synergy badges, ramp stacks) survive.
    // Ruling #31: cancelling a unit's stances also drops the taunts it
    // authored — attackers are no longer redirected to it.
    if (isOffensive) {
      const clearTauntsAuthoredByTarget = () => {
        let cleared = false;
        [...updatedTeams.playerTeam, ...updatedTeams.enemyTeam].forEach(
          (unit) => {
            const before = unit.debuffs.length;
            unit.debuffs = unit.debuffs.filter(
              (d) =>
                !(
                  d.type === "taunt" &&
                  d.sourceId === updatedTarget.instanceId
                ),
            );
            if (unit.debuffs.length !== before) cleared = true;
          },
        );
        if (cleared) targetEffects.push("broke the taunt");
      };
      if (skillMechanics.some((m) => m.type === "cancelBuffs")) {
        updatedTarget.buffs = updatedTarget.buffs.filter(
          (b) => b.uncancellable,
        );
        clearTauntsAuthoredByTarget();
        targetEffects.push("cancelled buffs");
      } else if (skillMechanics.some((m) => m.type === "cancelStances")) {
        updatedTarget.buffs = updatedTarget.buffs.filter(
          (b) => b.type !== "stance" || b.uncancellable,
        );
        clearTauntsAuthoredByTarget();
        targetEffects.push("cancelled stances");
      }
    }

    if (isAttack) {
      // Crit roll — a proc applies the full CRITICAL package. Skills that
      // are already CRITICAL don't double-dip.
      const critChance = getCritChance(updatedSource);
      const didCrit =
        critChance > 0 &&
        !skillMechanics.some((m) => m.type === "critical") &&
        rng() * 100 < critChance;
      if (didCrit) {
        targetEffects.push("a CRITICAL hit");
        targetEvent.crit = true;
      }

      const damage = calculateDamage({
        baseDamage,
        skillMechanics: didCrit
          ? [...skillMechanics, { type: "critical" }]
          : skillMechanics,
        target: updatedTarget,
        attackerColor: updatedSource.color,
        attacker: updatedSource,
      });

      const finalDamage = Math.floor(damage);
      dealtDamage = finalDamage;
      totalDamageDealt += finalDamage;
      targetEvent.damage = finalDamage;

      const newHp = updatedTarget.currentHP - finalDamage;

      // -- LETHAL DAMAGE SURVIVAL (Sara) — shared with DoT deaths in tick.ts
      if (newHp <= 0) {
        const healAmount = trySurviveLethal(updatedTarget, finalDamage);
        if (healAmount !== null) {
          targetEvent.survivedLethal = true;
          targetEffects.push(
            `triggered ${updatedTarget.passive?.name ?? "lethal survival"}, healed ${healAmount} HP and lost all buffs and debuffs`,
          );
        } else {
          updatedTarget.currentHP = 0;
        }
      } else {
        updatedTarget.currentHP = Math.max(0, newHp);
      }

      // Receiving an attack (and surviving it) feeds on-attack-received
      // passives (Charged stacks, Rookie Hunter counters)
      if (updatedTarget.currentHP > 0) {
        handleAttackReceived(updatedTarget, log);
      }

      // Damage-taken bookkeeping (Extort Life reset is resolved at round end)
      if (dealtDamage > 0) {
        updatedTarget.passiveState.tookDamageThisRound = true;
      }
    } else if (action.skill.type === "heal") {
      const healAmount = Math.floor(baseDamage);
      healedAmount = healAmount;
      targetEvent.heal = healAmount;
      updatedTarget.currentHP = Math.min(
        updatedTarget.hp,
        updatedTarget.currentHP + healAmount,
      );
    }

    // Hostile mechanics apply for offensive skills even at 0 damage
    if (isOffensive) {
      // Apply skill mechanics (Debuffs)
      skillMechanics.forEach((mech) => {
        if (mech.type === "shock") {
          // Independent DoT per application, valued off THIS hit's damage
          // (e.g. 100 dealt -> 30 per turn for 4 turns). Removable debuff.
          const shockDmg = Math.floor(
            dealtDamage * ((mech.damagePercent || 30) / 100),
          );
          if (shockDmg > 0) {
            updatedTarget.debuffs.push({
              type: "damageOverTime",
              name: "Shock",
              value: shockDmg,
              debuffDuration: mech.duration || 4,
            });
            targetEffects.push(
              `applied Shock (${shockDmg}/turn)${formatTurns(mech.duration || 4)}`,
            );
          }
        }
        if (mech.type === "decay") {
          const decayDmg = Math.floor(
            dealtDamage * ((mech.damagePercent || 10) / 100),
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
          // Rank-conditional via durationRanked (e.g. [0,1,2]): 0 = inactive
          const stunDuration = mech.duration ?? 1;
          if (stunDuration > 0) {
            updatedTarget.debuffs.push({
              type: "stun",
              debuffDuration: stunDuration,
            });
            targetEffects.push(`applied stun${formatTurns(stunDuration)}`);
          }
        }
        if (mech.type === "bleed") {
          // Same machinery as Shock: independent DoT per application,
          // valued off THIS hit's damage. Removable debuff.
          const bleedDmg = Math.floor(
            dealtDamage * ((mech.damagePercent || 90) / 100),
          );
          const bleedDuration = mech.duration ?? 1;
          if (bleedDmg > 0 && bleedDuration > 0) {
            updatedTarget.debuffs.push({
              type: "damageOverTime",
              name: "Bleed",
              value: bleedDmg,
              debuffDuration: bleedDuration,
            });
            targetEffects.push(
              `applied Bleed (${bleedDmg}/turn)${formatTurns(bleedDuration)}`,
            );
          }
        }
        // (cancelBuffs / cancelStances resolve pre-damage, above)
        if (mech.type === "lifesteal" && dealtDamage > 0) {
          const heal = Math.floor(
            dealtDamage * ((mech.valuePercent || mech.value || 30) / 100),
          );
          if (heal > 0) {
            updatedSource.currentHP = Math.min(
              updatedSource.hp,
              updatedSource.currentHP + heal,
            );
            targetEffects.push(`drained ${heal} HP`);
          }
        }
        if (mech.type === "seal") {
          // Rank-conditional via durationRanked (e.g. [0,1,2]): 0 = inactive
          const sealDuration = mech.duration || 0;
          if (sealDuration > 0) {
            updatedTarget.debuffs.push({
              type: "seal",
              sealType: mech.sealType || "attack",
              debuffDuration: sealDuration,
              name: "Attack Seal",
            });
            targetEffects.push(
              `sealed ${mech.sealType || "attack"} skills${formatTurns(sealDuration)}`,
            );
          }
        }
        if (mech.type === "extort") {
          const pct = mech.value || mech.valuePercent || 0;
          if (pct > 0) {
            const atkStolen = Math.floor(
              (getEffectiveAttack(updatedTarget) * pct) / 100,
            );
            const defStolen = Math.floor(
              (getEffectiveDefense(updatedTarget) * pct) / 100,
            );
            // sourceId links the victim's debuffs to the thief's self-buff
            // (ruling #32: the buff dies when no linked debuff remains)
            updatedTarget.debuffs.push({
              type: "debuff",
              stat: "atk",
              valuePercent: pct,
              debuffDuration: mech.duration,
              name: "Extort",
              sourceId: updatedSource.instanceId,
            });
            updatedTarget.debuffs.push({
              type: "debuff",
              stat: "def",
              valuePercent: pct,
              debuffDuration: mech.duration,
              name: "Extort",
              sourceId: updatedSource.instanceId,
            });
            extortGains.atk += atkStolen;
            extortGains.def += defStolen;
            extortGains.duration = mech.duration;
            targetEffects.push(
              `extorted ${pct}% ATK/DEF${formatTurns(mech.duration)}`,
            );
          }
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

      if (flowingRuinMech) {
        updatedTarget.debuffs.push({
          type: "debuff",
          stat: "atk",
          valuePercent: flowingRuinMech.atkDownPercent ?? 20,
          debuffDuration: flowingRuinMech.atkDownDuration ?? 2,
        });
        targetEffects.push(
          `lowered atk by ${flowingRuinMech.atkDownPercent ?? 20}%${formatTurns(flowingRuinMech.atkDownDuration ?? 2)}`,
        );
      }

      if (isAttack && updatedTarget.currentHP === 0) {
        targetEffects.push("defeated");
        targetEvent.killed = true;
      }
    }

    // Friendly buffs/cleanses applied even if it's an attack (if targetSelf is true or targets are allies)
    skillMechanics.forEach((mech) => {
      if (mech.type === "cleanse" && isHealOrBuff) {
        // Ruling #30: uncancellable entries are "effects", not debuffs —
        // cleanse can't touch them
        updatedTarget.debuffs = updatedTarget.debuffs.filter(
          (d) => d.uncancellable,
        );
        targetEffects.push("cleansed all debuffs");
      }
      if ((mech.type === "buff" || mech.type === "stance") && !mech.targetSelf) {
        updatedTarget.buffs.push({
          type: mech.type,
          stat: mech.stat,
          valuePercent: mech.valuePercent || mech.value,
          buffDuration: mech.duration,
          name: mech.name,
          unstackable: mech.unstackable,
          uncancellable: mech.uncancellable,
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

    targetEvent.hpAfter = updatedTarget.currentHP;
    eventTargets.push(targetEvent);

    // -- COUNTER STANCE (Full Counter): a surviving target with an active
    // counter stance strikes the attacker back. A unit killed by the hit
    // does not counter (Tanveer ruling). Counters don't chain.
    if (
      isAttack &&
      updatedTarget.currentHP > 0 &&
      updatedTarget.team !== updatedSource.team
    ) {
      const counterStance = updatedTarget.buffs.find(
        (b) => b.type === "stance" && b.counterDamagePercent,
      );
      if (counterStance && updatedSource.currentHP > 0) {
        const counterBase =
          (getEffectiveAttack(updatedTarget) *
            (counterStance.counterDamagePercent || 0)) /
          100;
        const counterDamage = Math.floor(
          calculateDamage({
            baseDamage: counterBase,
            skillMechanics: [],
            target: updatedSource,
            attackerColor: updatedTarget.color,
            attacker: updatedTarget,
          }),
        );
        updatedSource.currentHP = Math.max(
          0,
          updatedSource.currentHP - counterDamage,
        );
        if (counterDamage > 0) {
          updatedSource.passiveState.tookDamageThisRound = true;
        }
        eventCounters.push({
          byInstanceId: updatedTarget.instanceId,
          byName: updatedTarget.name,
          onInstanceId: updatedSource.instanceId,
          damage: counterDamage,
          killedAttacker: updatedSource.currentHP === 0,
          attackerHpAfter: updatedSource.currentHP,
        });
        log(
          `[Action] ${updatedTarget.name} counters ${updatedSource.name} for ${counterDamage} damage${updatedSource.currentHP === 0 ? " — defeated" : ""}!`,
        );
      }
    }
  });

  // -- EXTORT SELF-GAIN (Ban): per-stat mapping, flat points stolen from
  // every target hit; recasting refreshes (removes the previous Extort
  // buffs) rather than stacking
  if (extortGains.atk > 0 || extortGains.def > 0) {
    updatedSource.buffs = updatedSource.buffs.filter(
      (b) => b.name !== "Extort",
    );
    updatedSource.buffs.push({
      type: "buff",
      stat: "atk",
      flatValue: extortGains.atk,
      buffDuration: extortGains.duration,
      name: "Extort",
    });
    updatedSource.buffs.push({
      type: "buff",
      stat: "def",
      flatValue: extortGains.def,
      buffDuration: extortGains.duration,
      name: "Extort",
    });
    log(
      `[Action] ${updatedSource.name} extorts +${extortGains.atk} ATK and +${extortGains.def} DEF${formatTurns(extortGains.duration)}!`,
    );
  }

  // -- GAIN ULT GAUGE (Gon's Jajanken Round 2): fills the source's own gauge
  const gaugeMech = skillMechanics.find((m) => m.type === "gainUltGauge");
  if (gaugeMech && action.skill.type !== "ultimate") {
    const gain = gaugeMech.value ?? 1;
    updatedSource.ultGauge = Math.min(5, updatedSource.ultGauge + gain);
    log(
      `[Action] ${updatedSource.name} fills their ultimate gauge by ${gain}.`,
    );
  }

  // -- POST-DAMAGE PASSIVES
  if (
    totalDamageDealt > 0 &&
    updatedSource.passive &&
    updatedSource.passive.trigger === "onDamageDealt"
  ) {
    const lifestealMech = updatedSource.passive.mechanics?.find(
      (m) => m.type === "healLifesteal",
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

  // Flowing Ruin stack gain — every action (skills and ultimate) grants one
  if (updatedSource.passive && updatedSource.passive.trigger === "afterSkill") {
    const stackMech = updatedSource.passive.mechanics?.find(
      (m): m is BuffMechanic => m.type === "buff" && Boolean(m.maxStacks),
    );
    const maxStacks = stackMech?.maxStacks ?? 3;
    const currentStacks =
      (updatedSource.passiveState.flowingRuinStacks as number) || 0;
    if (currentStacks < maxStacks) {
      updatedSource.passiveState.flowingRuinStacks = currentStacks + 1;
      log(
        `${updatedSource.name} gains a ${updatedSource.passive.name} stack (${currentStacks + 1}/${maxStacks}).`,
      );
    }
  }

  // Ruling #32: Extort self-buffs live only while a linked debuff survives
  // on a living enemy (covers deaths and cleanses caused by this action)
  syncExtortLinks(updatedTeams.playerTeam, updatedTeams.enemyTeam, log);

  emit?.({
    kind: "action",
    sourceInstanceId: updatedSource.instanceId,
    sourceName: updatedSource.name,
    sourceTeam: updatedSource.team,
    sourceColor: updatedSource.color,
    sourceCharacterId: updatedSource.id,
    skillName: action.skill.skillName,
    skillType: action.skill.type,
    isUlt: action.skill.type === "ultimate",
    targets: eventTargets,
    counters: eventCounters,
  });

  return updatedTeams;
}

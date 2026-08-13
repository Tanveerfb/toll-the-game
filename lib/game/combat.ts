import { BattleCharacter } from "@/types/character";
import { Action } from "@/types/action";
import { calculateDamage } from "./damage";
import { getEvadeChance } from "./evade";
import { trySurviveLethal } from "./lethal";
import { syncExtortLinks } from "./effects";
import { getEffectiveAttack, getEffectiveDefense, statPhrase } from "./stats";
import { ultGaugeMax } from "./ultGauge";
import { bossDamageMultiplierVsTarget } from "./bossPassives";
import { getEffectiveCritResist, getEffectiveLifesteal } from "./substats";
import { applyHeal } from "./heal";
import { scaleMaxHp } from "./maxHp";
import { scaledUltDamage } from "./progression";
import { MAX_ULT_LEVEL } from "@/lib/gacha/dupes";
import { isImmuneToStatDebuff } from "./immunity";
import { DEFAULT_BLEED_TURNS, DEFAULT_IGNITE_TURNS } from "./dotDurations";
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
import type { StatusEffect } from "@/types/mechanic";

/**
 * Effects that exist only as a consequence of the hit LANDING, and so do not
 * proc when the hit's damage nulls to 0 (ruling #71, "Tanked").
 *
 * The test Tanveer gave is the skill's own description, read in clause order:
 * for "Cancels buffs, does damage equal to 375% ATK to all enemies, greatly
 * lowers ATK and DEF for 2 turns", the cancel precedes the damage clause and
 * still fires; the ATK/DEF drop follows it and would not. Everything in this
 * set sits after the damage clause.
 *
 * DoTs, gauge depletion and hard CC. Stun joined on 2026-08-13 once Tanveer
 * ruled on it: "null them if the damage resulted in null". **Freeze belongs
 * here too** — it is not implemented yet, but he confirmed it is a stun
 * variant in every respect, so it goes in this set the day it exists rather
 * than being re-litigated then.
 *
 * The stat debuffs (a plain `debuff` entry) are still OUT. They are the same
 * shape and will likely follow, but he has not ruled, and the clause-order
 * test has to be applied per mechanic rather than assumed.
 */
const NULLED_BY_TANKED_HIT: ReadonlySet<string> = new Set([
  "shock",
  "decay",
  "bleed",
  "corrosion",
  "ignite",
  "lowerUltGauge",
  "stun",
]);

/**
 * Strips any prior effect this same source applied that matches `matches`,
 * before a fresh instance is pushed — the shared "recast overrides own
 * prior application" rule used by debuff/taunt/Extort/Flowing Ruin so the
 * refresh semantics can't drift between the four call sites.
 */
function stripOwnEffect(
  effects: StatusEffect[],
  sourceId: string,
  matches: (effect: StatusEffect) => boolean,
): StatusEffect[] {
  return effects.filter((e) => !(e.sourceId === sourceId && matches(e)));
}

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
  if (char.isSub && char.passive.worksFromSub !== true) return;
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
    // Shifts ATK and DEF only — not HP, so not "basic stats" either.
    stats: ["atk", "def"],
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
  /** Caster's gacha dupe level. Ultimates scale with it; ordinary skills rank
   *  up instead and ignore it entirely. */
  ultLevel: number = 1,
): number {
  if (skill.type === "ultimate") {
    // Ruling 2026-08-11: an ultimate's multiplier grows 60% of its own value
    // across the six ult levels — a 500% ultimate reads 500 at level 1 and
    // 800 at level 6. Ranks don't apply to ultimates, so this is the only
    // number that moves.
    return scaledUltDamage(
      (skill as UltimateCard).damage,
      ultLevel,
      MAX_ULT_LEVEL,
    );
  } else {
    // Heal/buff skills (e.g. Molvarr's SP Skills) carry no damageRanked — no
    // damage. Treat a missing/short array as 0% rather than crashing.
    return (skill as SkillCard).damageRanked?.[rankIndex] ?? 0;
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
  // No trailing space: it used to collide with formatTurns' leading one and
  // every buff line in the log read "by 20%  for 1 turn" (ruling #72 — the
  // drawer is player-facing, so this is a defect, not a cosmetic).
  return `${value}%`;
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
  // marked enemy picks a random living field enemy at execution time. The same
  // random re-pick fires when the marked enemy is no longer a valid target —
  // dead, benched, or gone — which happens when several queued cards focus one
  // enemy and an earlier card kills it: the rest retarget instead of wasting
  // themselves on a corpse. Taunt redirects still apply afterwards; AoE is
  // unaffected — the pick is just the anchor target.
  let targetInstanceId: string | undefined = action.targetInstanceId;
  const needsEnemyTarget = ["attack", "debuff", "disable", "ultimate"].includes(
    action.skill.type,
  );
  if (needsEnemyTarget && source) {
    const opposingTeam =
      source.team === "player" ? teams.enemyTeam : teams.playerTeam;
    const marked = targetInstanceId
      ? opposingTeam.find((c) => c.instanceId === targetInstanceId)
      : undefined;
    const markedInvalid = !marked || marked.currentHP <= 0 || marked.isSub;
    if (markedInvalid) {
      const pool = opposingTeam.filter((c) => c.currentHP > 0 && !c.isSub);
      // Retarget only when a living enemy exists. With none left, leave the
      // target untouched: an unmarked card fizzles at the lookup below (the
      // battle is already won), while a card that marked a now-dead enemy
      // still resolves its self-buffs against the corpse as before.
      if (pool.length > 0) {
        targetInstanceId = pool[Math.floor(rng() * pool.length)].instanceId;
      }
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
  // skills, but never let one through). A seal's sealType names which
  // category of skill it blocks: "attack" = any attack-type skill (the
  // original/default case), "debuff" = any debuff-type skill, "attackDebuff"
  // = an attack-type skill that ALSO carries any hostile debuff-category
  // mechanic (Chiara's "House Rules" — a conceptual category, not a literal
  // skill.type value; see Diane's Rush Rock (a "seal" mechanic) and the
  // author's own example, "applies [Bleed] debuff", for the breadth of what
  // counts). Ultimates are never sealed by any sealType.
  const DEBUFF_CATEGORY_MECHANICS = new Set([
    "debuff",
    "stun",
    "seal",
    "taunt",
    "shock",
    "bleed",
    "decay",
    "corrosion",
    "ignite",
    "extort",
  ]);
  const skillHasDebuffMechanic = (action.skill.mechanics ?? []).some((m) =>
    DEBUFF_CATEGORY_MECHANICS.has(m.type),
  );
  const activeSeal = updatedSource.debuffs.find((d) => {
    if (d.type !== "seal") return false;
    if (d.sealType === "attackDebuff") {
      return action.skill.type === "attack" && skillHasDebuffMechanic;
    }
    return d.sealType === action.skill.type;
  });
  if (activeSeal) {
    log(
      `[Action] ${updatedSource.name}'s ${activeSeal.sealType} skills are sealed — ${action.skill.skillName} fizzles.`,
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
      // Read the buff off the kit rather than hardcoding it. This used to push
      // a literal `valuePercent: 50` while both Lyra kits authored 150, so the
      // passive silently applied a third of its stated strength and no amount
      // of editing the JSON changed anything (Tanveer, 2026-08-09).
      const firstActionBuffs = (updatedSource.passive.mechanics ?? []).filter(
        (m) => m.type === "buff",
      );
      const applied = firstActionBuffs.length > 0
        ? firstActionBuffs
        : // A kit with the trigger but no buff mechanic keeps the historical
          // behaviour instead of silently doing nothing.
          [{ stat: "def", valuePercent: 50, duration: 1 } as const];

      applied.forEach((mech) => {
        updatedSource.buffs.push({
          type: "buff",
          stat: mech.stat ?? "def",
          valuePercent: mech.valuePercent,
          value: "value" in mech ? mech.value : undefined,
          buffDuration: mech.duration ?? 1,
          unstackable: "unstackable" in mech ? mech.unstackable : true,
          uncancellable: "uncancellable" in mech ? mech.uncancellable : true,
          name: updatedSource.passive?.name,
        });
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
  // An ultimate carrying a friendly, non-self mechanic (buff/stance/cleanse/
  // heal/debuffImmunity/healOverTime) is ally-directed even though its
  // skill.type is hardcoded "ultimate" (UltimateCard can't be typed "buff").
  // Isolde's "Starbound Ward" is the first such ultimate — existing
  // ultimates only ever use targetSelf buffs, so this is additive and
  // doesn't change any current character's targeting.
  const hasFriendlyAllyMechanic = skillMechanics.some(
    (m) =>
      (m.type === "buff" ||
        m.type === "stance" ||
        m.type === "cleanse" ||
        m.type === "heal" ||
        m.type === "debuffImmunity" ||
        m.type === "healOverTime") &&
      !m.targetSelf,
  );
  const isHealOrBuff =
    action.skill.type === "heal" ||
    action.skill.type === "buff" ||
    action.skill.type === "stance" ||
    (action.skill.type === "ultimate" && hasFriendlyAllyMechanic);
  // A skill deals damage whenever its numbers say so, regardless of type —
  // e.g. debuff-type skills with damageRanked > 0 hit AND debuff. Heal-type
  // skills reuse damageRanked as the heal amount, so they are excluded.
  const skillDamagePercent = getSkillDamagePercent(
    action.skill,
    rankIndex,
    source.ultLevel ?? 1,
  );
  // A purely supportive ultimate is NOT an attack. Without this an ally-
  // directed ultimate still ran an attack pass at the enemy team first —
  // Isolde's Starbound Ward logged a 0-damage hit on every enemy before
  // granting its buffs (Tanveer, 2026-08-09: "it is only a buff based
  // ultimate"). Requiring 0 damage keeps a future buff-and-damage ultimate
  // attacking as authored.
  const isSupportUltimate =
    action.skill.type === "ultimate" &&
    hasFriendlyAllyMechanic &&
    skillDamagePercent <= 0;
  const isAttack =
    action.skill.type === "attack" ||
    (action.skill.type === "ultimate" && !isSupportUltimate) ||
    (!isHealOrBuff && skillDamagePercent > 0);
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
    // Taunt override for single-target offensive skills. Multiple taunters
    // can be active at once — most-recently-applied wins, and if that
    // taunter has since died, fall through to the next-most-recent taunter
    // still alive rather than hitting the original target.
    if (isOffensive) {
      const tauntDebuffs = updatedSource.debuffs.filter(
        (d) => d.type === "taunt" && d.sourceId,
      );
      for (let i = tauntDebuffs.length - 1; i >= 0; i--) {
        const tauntTarget = getUpdatedChar(tauntDebuffs[i].sourceId!);
        if (tauntTarget && tauntTarget.currentHP > 0) {
          actualTarget = tauntTarget;
          log(
            `[Action] ${updatedSource.name} was taunted and redirected to ${tauntTarget.name}.`,
          );
          break;
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
        stats: mech.stats,
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
        `[Action] ${updatedSource.name} gained ${mech.type} to ${statPhrase(mech)} by ${toPercentText(mech.valuePercent || mech.value)}${formatTurns(mech.duration)}`.trim() +
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

      // -- HEALING FLAMES (Master Tao's passive, onIgniteConsume) — a
      // separate reaction to the same consumption event above. Each cast
      // independently floors its own consumed-stack count by conditionStacks
      // (no carrying a leftover 1-2 stacks toward a future cast); the
      // cumulative trigger count across the whole battle is capped at
      // maxTriggers via passiveState.igniteConsumeTriggers.
      if (updatedSource.passive?.trigger === "onIgniteConsume") {
        const healMech = updatedSource.passive.mechanics?.find(
          (m) => m.type === "heal",
        );
        if (healMech?.conditionStacks) {
          const maxTriggers = healMech.maxTriggers ?? Infinity;
          const triggersUsed =
            (updatedSource.passiveState.igniteConsumeTriggers as number) || 0;
          const triggersEarned = Math.floor(
            totalIgnitesConsumed / healMech.conditionStacks,
          );
          const triggersToApply = Math.min(
            triggersEarned,
            maxTriggers - triggersUsed,
          );
          if (triggersToApply > 0) {
            const healAmount = Math.floor(
              updatedSource.hp *
                ((healMech.valuePercent ?? 0) / 100) *
                triggersToApply,
            );
            const { character: healed, healed: actualHealed } = applyHeal(
              updatedSource,
              healAmount,
            );
            Object.assign(updatedSource, healed);
            updatedSource.passiveState.igniteConsumeTriggers =
              triggersUsed + triggersToApply;
            if (actualHealed > 0) {
              log(
                `${updatedSource.name}'s ${updatedSource.passive.name} restores ${actualHealed} HP!`,
              );
            }
          }
        }
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
      opp.debuffs = stripOwnEffect(
        opp.debuffs,
        updatedSource.instanceId,
        (d) => d.name === "Extort",
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
    /** Ruling #71 — damage was intended against THIS target and resolved to 0.
     *  Per target on purpose: an AoE that nulls on one unit still lands, with
     *  all its after-effects, on the others. */
    let damageNulled = false;

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
      const critChance = Math.max(
        0,
        getCritChance(updatedSource) - getEffectiveCritResist(updatedTarget),
      );
      const didCrit =
        critChance > 0 &&
        !skillMechanics.some((m) => m.type === "critical") &&
        rng() * 100 < critChance;
      if (didCrit) {
        targetEffects.push("a CRITICAL hit");
        targetEvent.crit = true;
      }

      // Boss "+% vs Corroded" (Molvarr P2) — a per-target multiplier, so it
      // scales THIS target's base damage without compounding across the loop.
      const corrosionBonus = bossDamageMultiplierVsTarget(
        updatedSource,
        updatedTarget,
      );
      if (corrosionBonus > 1) {
        targetEffects.push(
          `+${Math.floor((corrosionBonus - 1) * 100)}% vs Corroded`,
        );
      }

      const damage = calculateDamage({
        baseDamage: baseDamage * corrosionBonus,
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

      // Ruling #71 — the hit was fully absorbed. Detected AFTER flooring, and
      // it has to be: calculateDamage already floors the post-DEF base at 1, so
      // a null is produced by the type-advantage and damage-reduction
      // multipliers dragging that 1 below 1.0 — never by the subtraction alone.
      // A skill that was never going to deal damage (Draw Fire) is not a null.
      if (baseDamage > 0 && finalDamage === 0) {
        damageNulled = true;
        targetEvent.tanked = true;
      }

      // Lifesteal substat — unconditional heal-on-hit, stacks additively with
      // any explicit skill-level "lifesteal" mechanic (resolved separately,
      // below in the mechanics loop).
      if (dealtDamage > 0) {
        const lifestealPercent = getEffectiveLifesteal(updatedSource);
        if (lifestealPercent > 0) {
          const { character: healedSource, healed } = applyHeal(
            updatedSource,
            Math.floor(dealtDamage * (lifestealPercent / 100)),
          );
          Object.assign(updatedSource, healedSource);
          if (healed > 0) targetEffects.push(`self-healed ${healed} HP (lifesteal)`);
        }
      }

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
      // Molvarr SP: heal a % of MISSING HP (maxHP - currentHP) instead of the
      // stat-scaled amount. Falls back to the normal damageRanked-as-heal.
      const healMech = skillMechanics.find((m) => m.type === "heal");
      const rawHealAmount =
        healMech?.missingHpPercent != null
          ? Math.floor(
              (updatedTarget.hp - updatedTarget.currentHP) *
                (healMech.missingHpPercent / 100),
            )
          : Math.floor(baseDamage);
      const { character: healedTarget, healed } = applyHeal(
        updatedTarget,
        rawHealAmount,
      );
      Object.assign(updatedTarget, healedTarget);
      healedAmount = healed;
      targetEvent.heal = healed;
    }

    // Hostile mechanics apply for offensive skills even at 0 damage — unless
    // the target currently holds Debuff Immunity (Isolde's "Starbound
    // Ward"), which blocks every debuff type below (stat-downs, DoTs,
    // stun/seal/taunt/extort), not just CC. Damage itself is unaffected, and
    // the "defeated" check still runs regardless of immunity — only the
    // debuff-application mechanics below are gated.
    const targetIsDebuffImmune = updatedTarget.buffs.some(
      (b) => b.debuffImmune,
    );
    if (isOffensive && targetIsDebuffImmune) {
      targetEffects.push("resisted all debuffs (Debuff Immunity)");
    }
    if (isOffensive && !targetIsDebuffImmune) {
      // Apply skill mechanics (Debuffs)
      skillMechanics.forEach((mech) => {
        // Ruling #71: a tanked hit carries none of its consequences. Skipping
        // outright — NOT applying them at a value of 0, which is what produced
        // the reported "applied decay (0/turn)".
        if (damageNulled && NULLED_BY_TANKED_HIT.has(mech.type)) return;
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
          targetEffects.push(
            `applied decay (${decayDmg}/turn)${formatTurns(mech.duration)}`,
          );
        }
        if (mech.type === "corrosion") {
          // Corrosion: independent, uncapped-stacking DoT ticking at the
          // victim's turn end. Basis (Tanveer 2026-07-21): only an R3 cast
          // or an ultimate applies % of MAX HP — R1/R2 applications target
          // the victim's REMAINING (current) HP instead, so early ranks hit
          // softer as the target's HP drops rather than always chunking a
          // fixed slice of the original max.
          const percent = mech.valuePercent ?? 10;
          const maxHpBasis =
            rankIndex === 2 || action.skill.type === "ultimate";
          updatedTarget.debuffs.push({
            type: "corrosion",
            name: "Corrosion",
            valuePercent: percent,
            stacks: mech.stacks ?? 1,
            debuffDuration: mech.duration,
            maxHp: maxHpBasis,
          });
          targetEffects.push(
            `applied Corrosion (${percent}% ${maxHpBasis ? "max" : "remaining"} HP/turn)${formatTurns(mech.duration)}`,
          );
        }
        if (mech.type === "ignite") {
          const existing = updatedTarget.debuffs.find(
            (d) => d.type === "ignite",
          );
          if (existing) {
            existing.stacks = (existing.stacks || 1) + (mech.stacks || 1);
            existing.debuffDuration = mech.duration ?? DEFAULT_IGNITE_TURNS;
          } else
            updatedTarget.debuffs.push({
              type: "ignite",
              stacks: mech.stacks,
              debuffDuration: mech.duration ?? DEFAULT_IGNITE_TURNS,
            });
          targetEffects.push(
            `applied ignite (${mech.stacks || 1} stack${(mech.stacks || 1) > 1 ? "s" : ""})${formatTurns(mech.duration ?? DEFAULT_IGNITE_TURNS)}`,
          );
        }
        if (mech.type === "lowerUltGauge") {
          // Nullish coalescing (not ||): an explicit ranked value of 0
          // (Isolde's R1 "no gauge deplete") must mean zero, not fall
          // through to the default-1.
          const reducedBy = mech.value ?? 1;
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
            if (updatedTarget.ccImmune) {
              targetEffects.push("resisted stun (CC immune)");
            } else {
              updatedTarget.debuffs.push({
                type: "stun",
                debuffDuration: stunDuration,
              });
              targetEffects.push(`applied stun${formatTurns(stunDuration)}`);
            }
          }
        }
        if (mech.type === "bleed") {
          // Same machinery as Shock: independent DoT per application,
          // valued off THIS hit's damage. Removable debuff.
          const bleedDmg = Math.floor(
            dealtDamage * ((mech.damagePercent || 90) / 100),
          );
          const bleedDuration = mech.duration ?? DEFAULT_BLEED_TURNS;
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
          const rawHeal = Math.floor(
            dealtDamage * ((mech.valuePercent || mech.value || 30) / 100),
          );
          const { character: healedSource, healed } = applyHeal(
            updatedSource,
            rawHeal,
          );
          Object.assign(updatedSource, healedSource);
          if (healed > 0) {
            targetEffects.push(`drained ${healed} HP`);
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
          // Permanent per-stat immunity from a passive (boss-exclusive) —
          // narrower than Debuff Immunity and not cleansable.
          const blockedStats = [
            ...(mech.stats ?? []),
            ...(mech.stat ? [mech.stat] : []),
          ].filter((st) => isImmuneToStatDebuff(updatedTarget, st));
          if (blockedStats.length > 0) {
            targetEffects.push(
              `resisted ${blockedStats.join("/")} down (immune)`,
            );
            return;
          }
          // Re-applying an ATK/DEF-lower debuff on the SAME stat OVERRIDES
          // this source's own previous instance instead of stacking a
          // second one (Tanveer 2026-07-21) — a different source's debuff
          // on the same stat still stacks multiplicatively (getEffectiveAttack/
          // Defense). Matches the existing Extort-never-stacks precedent.
          updatedTarget.debuffs = stripOwnEffect(
            updatedTarget.debuffs,
            updatedSource.instanceId,
            (d) => d.type === "debuff" && d.stat === mech.stat,
          );
          const downPercent = mech.valuePercent || mech.value;
          // A stat debuff naming hp (or "all") shrinks MAX HP, scaling current
          // HP with it so the ratio holds. Max HP is baked rather than read
          // dynamically, so like the buff path this records what it did and
          // tick.ts unwinds it on expiry (Tanveer, 2026-08-09 — build for
          // debuffs that don't exist yet).
          const shrinksHp =
            downPercent &&
            (mech.stat === "hp" || mech.stat === "all" ||
              (mech.stats ?? []).includes("hp"));
          updatedTarget.debuffs.push({
            type: "debuff",
            stat: mech.stat,
            stats: mech.stats,
            valuePercent: downPercent,
            debuffDuration: mech.duration,
            sourceId: updatedSource.instanceId,
            hpScalePercent: shrinksHp ? -downPercent : undefined,
          });
          if (shrinksHp) {
            Object.assign(updatedTarget, scaleMaxHp(updatedTarget, -downPercent));
          }
          targetEffects.push(
            `lowered ${statPhrase(mech)} by ${toPercentText(mech.valuePercent || mech.value)}${formatTurns(mech.duration)}`.trim(),
          );
        }
        if (mech.type === "taunt") {
          // Applied to enemy, overriding their target. A recast from the
          // SAME source overrides its own prior taunt (same rule as debuff)
          // rather than stacking stale duplicates.
          updatedTarget.debuffs = stripOwnEffect(
            updatedTarget.debuffs,
            updatedSource.instanceId,
            (d) => d.type === "taunt",
          );
          updatedTarget.debuffs.push({
            type: "taunt",
            debuffDuration: mech.duration,
            sourceId: updatedSource.instanceId,
          });
          targetEffects.push(`applied taunt${formatTurns(mech.duration)}`);
        }
      });

      if (flowingRuinMech) {
        updatedTarget.debuffs = stripOwnEffect(
          updatedTarget.debuffs,
          updatedSource.instanceId,
          (d) => d.type === "debuff" && d.stat === "atk",
        );
        if (isImmuneToStatDebuff(updatedTarget, "atk")) {
          // Flowing Ruin applies its ATK-down through its own path, not the
          // generic debuff mechanic, so the immunity has to be checked here
          // too or a boss immune "to ATK decrease" would still be halved by
          // the single most common source of it.
          targetEffects.push("resisted atk down (immune)");
        } else {
          updatedTarget.debuffs.push({
            type: "debuff",
            stat: "atk",
            valuePercent: flowingRuinMech.atkDownPercent ?? 20,
            debuffDuration: flowingRuinMech.atkDownDuration ?? 2,
            sourceId: updatedSource.instanceId,
          });
          targetEffects.push(
            `lowered atk by ${flowingRuinMech.atkDownPercent ?? 20}%${formatTurns(flowingRuinMech.atkDownDuration ?? 2)}`,
          );
        }
      }
    }

    // "Defeated" always registers regardless of Debuff Immunity — dying to
    // direct damage has nothing to do with resisting debuffs.
    if (isOffensive && isAttack && updatedTarget.currentHP === 0) {
      targetEffects.push("defeated");
      targetEvent.killed = true;
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
        const percent = mech.valuePercent || mech.value;
        const scalesHp =
          percent && (mech.stat === "hp" || mech.stat === "all" ||
            (mech.stats ?? []).includes("hp"));
        updatedTarget.buffs.push({
          type: mech.type,
          stat: mech.stat,
          stats: mech.stats,
          valuePercent: percent,
          buffDuration: mech.duration,
          name: mech.name,
          unstackable: mech.unstackable,
          uncancellable: mech.uncancellable,
          // Recorded so expiry can unwind the max-HP change (tick.ts).
          hpScalePercent: scalesHp ? percent : undefined,
        });
        // "hp"/"all" aren't read dynamically (unlike atk/def via
        // effectiveStat) — bake the gain now, mirroring how passive.ts's
        // synergy/aura handlers already do this for the OnBattleStart path.
        // Isolde's ultimate is the first ally-wide buff to need it here.
        if (scalesHp) {
          Object.assign(updatedTarget, scaleMaxHp(updatedTarget, percent));
        }
        targetEffects.push(
          `applied ${mech.type} to ${statPhrase(mech)} by ${toPercentText(percent)}${formatTurns(mech.duration)}`.trim(),
        );
      }
      if (mech.type === "debuffImmunity" && !mech.targetSelf && isHealOrBuff) {
        // Ruling #30 precedent (same as cleanse): uncancellable entries are
        // "effects", not debuffs — immunity can't strip those.
        updatedTarget.debuffs = updatedTarget.debuffs.filter(
          (d) => d.uncancellable,
        );
        updatedTarget.buffs.push({
          type: "buff",
          debuffImmune: true,
          buffDuration: mech.duration,
          name: mech.name || "Debuff Immunity",
        });
        targetEffects.push(
          `cleansed debuffs and gained Debuff Immunity${formatTurns(mech.duration)}`,
        );
      }
      if (mech.type === "healOverTime" && !mech.targetSelf && isHealOrBuff) {
        // Valued off THIS cast's heal amount (e.g. heal 200 -> 30% = 60/turn
        // for `duration` turns), same convention as Shock/Bleed valuing off
        // the hit that applied them.
        const hotAmount = Math.floor(
          healedAmount * ((mech.valuePercent ?? 30) / 100),
        );
        if (hotAmount > 0) {
          updatedTarget.buffs.push({
            type: "healOverTime",
            name: mech.name || "Rejuvenate",
            value: hotAmount,
            buffDuration: mech.duration,
          });
          targetEffects.push(
            `applied Rejuvenate (${hotAmount}/turn)${formatTurns(mech.duration)}`,
          );
        }
      }
    });

    if (isAttack && damageNulled) {
      // Ruling #71: "Tanked", not "dealt 0 damage". Anything still listed here
      // resolved BEFORE the damage step (a cancel, a broken taunt) and really
      // did happen — reporting it isn't the "other text" the ruling forbids;
      // that was the after-effects being announced at a value of zero.
      log(
        `[Action] ${updatedSource.name} used ${action.skill.skillName} on ${updatedTarget.name} — Tanked${targetEffects.length > 0 ? `, ${targetEffects.join(", ")}` : ""}.`,
      );
    } else if (isAttack) {
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
        if (counterDamage > 0) {
          const counterLifestealPercent = getEffectiveLifesteal(updatedTarget);
          if (counterLifestealPercent > 0) {
            const { character: healedCounterer, healed } = applyHeal(
              updatedTarget,
              Math.floor(counterDamage * (counterLifestealPercent / 100)),
            );
            Object.assign(updatedTarget, healedCounterer);
            if (healed > 0) {
              log(`${updatedTarget.name} self-healed ${healed} HP (lifesteal counter).`);
            }
          }
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
    updatedSource.ultGauge = Math.min(
      ultGaugeMax(updatedSource),
      updatedSource.ultGauge + gain,
    );
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
      const rawHeal = Math.floor(
        totalDamageDealt * (lifestealMech.lifestealPercent / 100),
      );
      const { character: healedSource, healed } = applyHeal(
        updatedSource,
        rawHeal,
      );
      Object.assign(updatedSource, healedSource);
      log(`${updatedSource.name}'s Vampiric Roots restores ${healed} HP!`);
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
    rank: action.rank,
    targets: eventTargets,
    counters: eventCounters,
  });

  return updatedTeams;
}

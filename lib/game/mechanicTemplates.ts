import { MECHANIC_TYPES, type MechanicType } from "@/types/mechanic";

// Kit Lab reference data: for every mechanic type, a one-line description and a
// starter field skeleton the browser inserts. Keeps the tool honest about what
// fields each mechanic carries without hand-building 42 typed forms — inserting
// a template gives named fields you edit; the Zod schema validates on save.

export interface MechanicInfo {
  desc: string;
  template: Record<string, unknown>;
}

export const MECHANIC_INFO: Record<MechanicType, MechanicInfo> = {
  aoe: { desc: "Hits all enemies (or all allies for heals).", template: {} },
  aoeRanked: {
    desc: "AoE only at the ranks marked true.",
    template: { ranks: [false, true, true] },
  },
  pierce: { desc: "Ignores 50% of the target's DEF.", template: {} },
  weakpoint: { desc: "3x damage vs a debuffed enemy.", template: {} },
  rupture: { desc: "2x damage vs a buffed enemy.", template: {} },
  detonate: { desc: "+20% damage per point of the target's ult gauge.", template: {} },
  concentrate: { desc: "More damage the fewer enemies are present.", template: {} },
  spite: { desc: "More damage the lower the user's HP.", template: {} },
  amplify: { desc: "+% damage per cancellable buff on the user.", template: { valuePercent: 10 } },
  critical: {
    desc: "Crit package: ignore DEF %, bonus damage %, ignores type matchups.",
    template: { ignoreDefensePercent: 50, damageBonusPercent: 50 },
  },
  buff: {
    desc: "Raises a stat for a duration.",
    template: { stat: "atk", valuePercent: 25, duration: 2, targetSelf: true },
  },
  debuff: {
    desc: "Lowers a target's stat for a duration.",
    template: { stat: "def", valuePercent: 25, duration: 2 },
  },
  stance: {
    desc: "Self stance (e.g. damageReduction) for a duration.",
    template: { stat: "damageReduction", valuePercent: 30, duration: 2 },
  },
  heal: { desc: "Heals HP (damageRanked = heal amount).", template: { targetSelf: false } },
  cleanse: { desc: "Removes debuffs.", template: {} },
  cancelBuffs: { desc: "Cancels the target's buffs.", template: {} },
  cancelStances: { desc: "Cancels the target's stances.", template: {} },
  stun: { desc: "Stuns for N turns.", template: { duration: 1 } },
  taunt: { desc: "Forces enemies to target the user for N turns.", template: { duration: 1 } },
  seal: { desc: "Seals a skill type for N turns.", template: { sealType: "attack", duration: 2 } },
  shock: { desc: "DoT: % of the applying hit per tick.", template: { damagePercent: 30, duration: 4 } },
  bleed: { desc: "DoT: % of the applying hit per tick.", template: { damagePercent: 90, duration: 1 } },
  decay: {
    desc: "Stores % of the hit, dealt per tick for N turns.",
    template: { damagePercent: 50, duration: 2, stacks: 1 },
  },
  corrosion: {
    desc: "Uncapped DoT: % of the target's MAX HP per stack per turn.",
    template: { valuePercent: 10, duration: 2, stacks: 1 },
  },
  ignite: { desc: "Applies Ignite stacks for N turns.", template: { stacks: 1, duration: 2 } },
  consumeIgnite: {
    desc: "Consumes Ignite for an effect (e.g. buffAtk) per stack.",
    template: { effect: "buffAtk", valuePerStackPercent: 10 },
  },
  lowerUltGauge: { desc: "Lowers the target's ult gauge.", template: { value: 1 } },
  gainUltGauge: { desc: "Fills the user's ult gauge.", template: { value: 1 } },
  lifesteal: { desc: "Heals the user for % of damage dealt.", template: { valuePercent: 30 } },
  extort: { desc: "Steals % ATK/DEF from each target hit.", template: { valuePercent: 20, duration: 2 } },
  synergy: {
    desc: "Passive: stat bonus when tag/color condition is met.",
    template: { conditionTags: [], stat: "atk", valuePercent: 10 },
  },
  aura: { desc: "Passive: team-wide stat aura.", template: { stat: "atk", valuePercent: 10 } },
  characterSynergy: {
    desc: "Passive: bonus when specific characters are on the team.",
    template: { requiredCharacterIds: [], stat: "atk", valuePercent: 10 },
  },
  chargedStacks: {
    desc: "Passive: stacking ATK/DEF/evade charge.",
    template: { maxStacks: 5, atkPerStackPercent: 0, evadePerStackPercent: 5 },
  },
  deathblow: {
    desc: "Passive: damage + crit scale with max HP lost.",
    template: { hpStepPercent: 3, critPerStepPercent: 2, damagePerStepPercent: 2 },
  },
  maxHpShred: { desc: "Passive: shreds target max HP, stacking.", template: { valuePercent: 5, maxStacks: 5 } },
  turnRamp: { desc: "Passive: stat ramps each turn, capped.", template: { valuePercent: 10, maxStacks: 5 } },
  momentumStacks: {
    desc: "Passive: gains a stack per card the team plays.",
    template: { valuePercent: 8, maxStacks: 5 },
  },
  statShiftAfterAttacks: {
    desc: "Passive: shift ATK/DEF after N attacks.",
    template: { attacksRequired: 3, atkShiftPercent: 10, maxTriggers: 3 },
  },
  surviveLethal: {
    desc: "Passive: survives a lethal hit, heals %.",
    template: { hpConditionPercent: 100, healDamagePercent: 30 },
  },
  consumeHpPercent: { desc: "Passive: spend % max HP before a hit.", template: { valuePercent: 5 } },
  healLifesteal: {
    desc: "Passive: lifesteal while below an HP threshold.",
    template: { hpConditionPercent: 50, lifestealPercent: 30 },
  },
  conditionalBuff: {
    desc: "Passive: consume stacks for a damage bonus (Flowing Ruin).",
    template: { conditionStacks: 3, damageBonusPercent: 50 },
  },
  bossAutoSp: {
    desc: "Boss: forces the phase's SP Skill as the final action every N phase-turns.",
    template: { everyNTurns: 3 },
  },
  bossStatSpike: {
    desc: "Boss: from phase-turn N, x-multiply ATK/DEF/maxHP once (uncancellable).",
    template: { fromTurn: 10, multiplier: 2 },
  },
  bossMaxHpDrain: {
    desc: "Boss: from phase-turn N, each field enemy takes %-of-maxHP damage per turn.",
    template: { fromTurn: 10, percent: 10 },
  },
  bossDebuffAtk: {
    desc: "Boss: ATK buff = (total enemy debuff stacks) x %, recomputed each turn.",
    template: { percentPerDebuff: 10 },
  },
  bossApplyCorrosion: {
    desc: "Boss: apply N Corrosion stack(s) to each field enemy at turn start.",
    template: { perTurn: 1, duration: 2 },
  },
  bossCorrosionBonus: {
    desc: "Boss: +% damage to targets afflicted by Corrosion.",
    template: { percent: 30 },
  },
};

export const ALL_MECHANIC_TYPES = MECHANIC_TYPES;

export function mechanicTemplate(type: MechanicType): Record<string, unknown> {
  return { type, ...(MECHANIC_INFO[type]?.template ?? {}) };
}

export const mechanicGlossary = {
  amplify: "Increases by +10% for each buff on self",
  combustion:
    "Consumes all Ignite stacks on target, gains +20% ATK per stack consumed",
  concentrate: "Damage increases by 50/20/10/0% for 1/2/3/4 enemies present",
  stuns: "Prevents target from acting for the listed duration.",
  stun: "Prevents the target from acting for the listed duration.",
  ignite: "Each stack increases damage taken by 10%",
  decay: " Decay deals 10% of inflicted skill damage as a DoT",
  pierce: "Ignores 50% of the enemy's DEF",
  taunt: "Direct all single target enemy attacks to self",
  taunts: "Direct all single target enemy attacks to self",
  cleanse: "Removes debuffs from the ally target(s).",
  cleanses: "Removes debuffs from the ally target(s).",
  rejuvenate: "Heal-over-Time equal to 30% of the amount healed by this cast, each turn for the listed duration.",
  spite: "Increases damage by +2% for each 1% missing HP",
  weakpoint: "Deals 3x damage against debuffed enemies",
  shock: "DoT equal to 30% of the damage dealt; each application stacks independently; cleansable",
  bleed: "DoT equal to 90% of the damage dealt; each application stacks independently; cleansable",
  detonate: "Damage increases by 20% for each point of the target's ultimate gauge",
  critical: "Ignores 50% defense and type advantage/disadvantage, deals +50% damage",
  charged: "Each stack raises ATK, DEF and evade chance by 5%",
  evade: "Chance to fully avoid an attack — no damage, no effects. Base evade is 0%",
  rupture: "Deals 2x damage against buffed enemies",
  lifesteal: "Recovers HP equal to a percentage of the damage dealt",
  lifesteals: "Recovers HP equal to a percentage of the damage dealt",
  corrosion:
    "Stacking DoT dealing 10% of the target's HP each turn — max HP at R3/ultimate, remaining HP otherwise; each application is independent and never caps",
  "attack seal": "Blocks the target's attack skills for the duration; ultimates are unaffected",
  "attack seals": "Blocks the target's attack skills for the duration; ultimates are unaffected",
  deplete: "Lowers the target's ultimate gauge by the listed amount",
  depletes: "Lowers the target's ultimate gauge by the listed amount",
  "damage reduction": "Reduces incoming damage by the listed amount for the duration",
  "debuff immunity": "Cleanses debuffs and blocks all new debuffs (not just crowd control) for the duration",
  "damage taken": "The damage this unit receives from enemies",
  "damage dealt": "The damage this unit deals to enemies",
  extort: "Lowers enemy ATK/DEF and adds the stolen points to own stats for the duration; never stacks",
  extorts: "Lowers enemy ATK/DEF and adds the stolen points to own stats for the duration; never stacks",
  seal: "Blocks the listed skill type for the duration; ultimates are unaffected",
  seals: "Blocks the listed skill type for the duration; ultimates are unaffected",
  deathblow: "Damage and crit chance +2% for every 3% of max HP lost",
  crit: "A critical hit: ignores 50% defense and type matchups, +50% damage",
  countered: "A unit in a counter stance strikes back when attacked (unless the hit kills it)",
  counters: "A unit in a counter stance strikes back when attacked (unless the hit kills it)",
  "cancels buffs and stances": "Removes all buffs and stances from the target; uncancellable effects persist",
  "cancel buffs and stances": "Removes all buffs and stances from the target; uncancellable effects persist",
  "cancels buffs": "Removes all of the target's buffs, stances included; uncancellable effects persist",
  "cancel buffs": "Removes all of the target's buffs, stances included; uncancellable effects persist",
  "cancels stances": "Removes the target's stances; uncancellable stances persist",
  "cancel stances": "Removes the target's stances; uncancellable stances persist",
  lowers: "Reduces the stat by 30%",
  "greatly lowers": "Reduces the stat by 50%",
  "massively lowers": "Reduces the stat by 80%",
  raises: "Raises the stat by 30%",
  "greatly raises": "Raises the stat by 50%",
  "massively raises": "Raises the stat by 100%",
  "permanently raises": "Raises the stat by 30% for the rest of battle",
  "permanently greatly raises": "Raises the stat by 50% for the rest of battle",
  "permanently massively raises": "Raises the stat by 100% for the rest of battle",
  "permanently lowers": "Reduces the stat by 30% for the rest of battle",
  "permanently greatly lowers": "Reduces the stat by 50% for the rest of battle",
  "permanently massively lowers": "Reduces the stat by 80% for the rest of battle",
} as const;

export type MechanicKeyword = keyof typeof mechanicGlossary;

/**
 * Passive descriptions are hand-authored prose, not the tier-word system
 * above — the exact % stays stated inline in the sentence (Tanveer: "numbers
 * are important in passives"), so these generic verbs exist only to drive
 * the Dokkan-style stat-change arrow, not to claim a fixed value the way
 * "lowers"/"raises" do. Deliberately kept OUT of `mechanicGlossary` — several
 * (increases/reduces/gains) also appear in ordinary skill-description prose
 * (Duke, Leorio, Yalina) where they must NOT get keyword highlighting or a
 * tooltip. Only merged in at the passive-only KeyworkHighlighter call sites
 * (components/game/KitDetails.tsx's PassiveProse and Passive Details
 * overlay), alongside `showStatArrows`.
 */
export const passiveStatVerbGlossary = {
  gains: "Gains the stated amount",
  loses: "Loses the stated amount",
  increases: "Increases the stated amount",
  reduces: "Reduces the stated amount",
  rises: "Rises by the stated amount",
  falls: "Falls by the stated amount",
} as const;

export type PassiveStatVerb = keyof typeof passiveStatVerbGlossary;

/**
 * Pill color category per keyword (Tanveer's scheme):
 * offense = red, debuff = purple (incl. attack-applied debuffs),
 * heal = green (heals + cleanses), stance = yellow, cancel = white,
 * effect = a named mechanic/DoT/status effect (corrosion, ignite, stun,
 * damage reduction, evade chance, ...).
 *
 * IMPORTANT: `buff`/`debuff` are the only two categories KeyworkHighlighter's
 * `arrowDirectionForKeyword` substitutes for an arrow icon in passives (see
 * that file). That's correct for genuine tier-word verbs (raises/lowers and
 * their variants) where the word IS the direction. It silently eats the
 * keyword's text for anything else — a real bug found on "damage reduction"
 * and "corrosion" 2026-07-30, both nouns that were mistakenly in this bucket.
 * Any named effect that isn't itself a verb belongs in `effect` instead, even
 * if it conceptually reads as offensive/defensive.
 */
export type KeywordCategory =
  | "offense"
  | "debuff"
  | "heal"
  | "buff"
  | "stance"
  | "cancel"
  | "effect";

export const keywordCategories: Record<MechanicKeyword, KeywordCategory> = {
  amplify: "offense",
  combustion: "offense",
  concentrate: "offense",
  pierce: "offense",
  spite: "offense",
  weakpoint: "offense",
  detonate: "offense",
  critical: "offense",
  crit: "offense",
  rupture: "offense",
  lifesteal: "offense",
  lifesteals: "offense",
  corrosion: "effect",
  "attack seal": "effect",
  "attack seals": "effect",
  deplete: "effect",
  depletes: "effect",
  "damage reduction": "effect",
  "debuff immunity": "effect",
  "damage taken": "effect",
  "damage dealt": "offense",
  deathblow: "offense",
  stuns: "effect",
  stun: "effect",
  ignite: "effect",
  decay: "effect",
  shock: "effect",
  bleed: "effect",
  taunt: "effect",
  taunts: "effect",
  extort: "effect",
  extorts: "effect",
  seal: "effect",
  seals: "effect",
  lowers: "debuff",
  "greatly lowers": "debuff",
  "massively lowers": "debuff",
  raises: "buff",
  "greatly raises": "buff",
  "massively raises": "buff",
  "permanently raises": "buff",
  "permanently greatly raises": "buff",
  "permanently massively raises": "buff",
  "permanently lowers": "debuff",
  "permanently greatly lowers": "debuff",
  "permanently massively lowers": "debuff",
  cleanse: "heal",
  cleanses: "heal",
  rejuvenate: "heal",
  charged: "stance",
  evade: "effect",
  countered: "stance",
  counters: "stance",
  "cancels buffs and stances": "cancel",
  "cancel buffs and stances": "cancel",
  "cancels buffs": "cancel",
  "cancel buffs": "cancel",
  "cancels stances": "cancel",
  "cancel stances": "cancel",
};

/** Category lookup for the passive-only stat-change verbs above — separate
 *  from `keywordCategories` for the same reason `passiveStatVerbGlossary` is
 *  separate from `mechanicGlossary` (see its comment). */
export const passiveStatVerbCategories: Record<PassiveStatVerb, KeywordCategory> = {
  gains: "buff",
  loses: "debuff",
  increases: "buff",
  reduces: "debuff",
  rises: "buff",
  falls: "debuff",
};

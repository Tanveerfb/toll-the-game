export const mechanicGlossary = {
  amplify: "Increases by +10% for each buff on self",
  combustion:
    "Consumes all Ignite stacks on target, gains +20% ATK per stack consumed",
  concentrate: "Damage increases by 50/20/10/0% for 1/2/3/4 enemies present",
  stuns: "Prevents target from acting for the listed duration.",
  stun: "Prevents the target from acting for the listed duration.",
  ignite: "Each stack increases damage taken by 10%",
  decay: " Decay deals 10% of inflicted skill damage as a DoT",
  pierce: "Ignores enemy defense by a set percentage",
  taunt: "Direct all single target enemy attacks to self",
  taunts: "Direct all single target enemy attacks to self",
  cleanse: "Removes debuffs from the ally target(s).",
  cleanses: "Removes debuffs from the ally target(s).",
  spite: "Increases damage by +2% for each 1% missing HP",
  lowers: "Reduces the target's stat by 20%",
  "greatly lowers": "Reduces the target's stat by 50%",
  "massively lowers": "Reduces the target's stat by 80%",
} as const;

export type MechanicKeyword = keyof typeof mechanicGlossary;

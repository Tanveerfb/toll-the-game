# Refined Gameplay & Wording Proposals

Based on your selections, here is a focused breakdown of mechanics to implement, expanded skill effect ideas, and a proposed terminology mapping inspired by Dokkan Battle.

---

## 1. Core Mechanics to Implement

### **Domains (Territory Skills)**
*   **Concept:** A character activates a Domain that visually changes the arena background and lasts for a set number of turns.
*   **Impact:** Applies massive, un-cancellable global modifiers (e.g., "All 'Villain' characters deal 30% more damage"). Domains clash—only one can be active at a time, allowing players to overwrite a boss's domain to remove their buffs.

### **Commandments / Graces**
*   **Concept:** Extremely powerful, lore-accurate global passives tied to specific high-tier characters. 
*   **Impact:** A Commandment affects **both** teams equally. For example, a "Commandment of Pacifism" might state: *Any unit that deals damage has their ATK lowered by 20% for the next turn.* This forces players to build teams that bypass their own unit's Commandment while punishing the enemy.

### **Multi-Phase Bosses (Death Matches)**
*   **Concept:** Bosses have multiple "Hearts" (health bars) or Phases. 
*   **Impact:** When a boss's HP hits 0, they immediately wipe all debuffs on themselves and enter Phase 2 with a new passive and skill set. **Crucially, player buffs carry over into the next phase**, allowing players to spend Phase 1 setting up massive ATK ramps and buffs to burst down the harder Phase 2.

---

## 2. Expanded Skill Effects (7DS Grand Cross Style)

In addition to `Charge` (Ignores Defense) and `Spike` (2x Crit Damage), here are more mechanical modifiers for attack cards to add variety:

*   **Shatter:** Ignores the target's Damage Reduction and Resistance (distinct from ignoring DEF, which `Charge` handles). Excellent against units with percent-based damage mitigation.
*   **Flood:** Damage dealt is increased by a percentage based on the user's *remaining HP percentage*. (More HP = More Damage).
*   **Desperation:** The inverse of Flood. Damage dealt is increased based on the user's *missing HP percentage*. (Less HP = More Damage).
*   **Cleave:** Deals additional flat damage equal to `X%` of the target's MAX HP. Incredible against high-HP bosses, weak against squishy targets.
*   **Sever:** Multiplies Critical Chance by 3x for that attack only.
*   **Amplify:** Damage dealt increases by `30%` for *every active buff* on the attacker.
*   **Oppress:** Damage dealt increases by `30%` for *every active debuff* on the target. Unlike Ruin, it **does not cleanse** the debuffs after the attack resolves, allowing you to repeatedly punish heavily debuffed enemies.
*   **Ruin:** Damage dealt increases by `20%` for *every active debuff* on the target. The attack then cleanses those debuffs after damage is dealt.

---

## 3. Dokkan-Style Terminology Mapping

Dokkan Battle uses specific adverbs to denote standard, hard-coded percentage buffs without showing the numbers in the card text. Incorporating this into `descriptionTranslator.ts` will give the game that authentic Dokkan/7DS flavor. 

Here is a proposed standardization for your mechanic glossary:

### **Buffing Terminology**
When a card says it "raises" a stat, it translates to these exact numbers under the hood:
*   **"Raises ATK..."** = +30% ATK
*   **"Greatly raises ATK..."** = +50% ATK
*   **"Massively raises ATK..."** = +100% ATK

*Example Card Text:* "Greatly raises ATK for 1 turn and causes damage to enemy."
*Engine Translation:* Applies `buff` (+50% ATK, 1 turn) -> Executes attack.

### **Debuffing Terminology**
*   **"Lowers DEF..."** = -30% DEF
*   **"Greatly lowers DEF..."** = -50% DEF
*   **"Massively lowers DEF..."** = -80% DEF

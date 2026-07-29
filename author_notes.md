# Game notes, ideas, bugs, requests by Tanveer Singh

Last updated - 29/07/2026

> Entries get removed once implemented/resolved/verified — see `author_notes_report.md` for the log of what happened to each one and when.

## Passive style overhaul - Current

The last session we did, we decided to change the formatting of how passive skill are displayed on archive pages. The style is closer to how DBZ dokkan battle displays the character kits - using green top arrows, red down arrows, bullet point formatting, etc. I personally gave passive redesign for Ban, Batra, Chiara, Diane in mdx format. I am now working on other characters below -

1. Duke -

# After using a skill

- Gains 1 stack of [Flowing Ruin] (Max 3) (Uncancellable)

# While using a skill When there are 3 stacks of [Flowing Ruin]

- Next attack's damage 100% 👆;
- Attacked enemies ATK 50% 👇;
- Clears all stacks of [Flowing Ruin] after the attack ends.

---

2. Gabrist

# While there are no defeated ally team members

- All allies DEF 20% 👆;

---

3. Gon -

# After receiving 10 attacks during battle

- ATK 50% 👇 (Activates only once, uncancellable)
- DEF 50% 👆 (Activates only once, uncancellable)

---

4. Killua -

# After receiving 10 attacks during battle

- DEF 50% 👇 (Activates only once, uncancellable)
- ATK 50% 👆 (Activates only once, uncancellable)

---

5. Leorio -

# When the ally team includes a character whose name includes 'Gon' or 'Killua'

- All allies' basic stats 10% 👆

# When the team includes both characters 'Gon' and 'Killua'

- All allies' basic stats 10% 👆

---

6. Lyra -

# When performing first in a turn

- DEF 150% 👆 for 1 turn (Activates once per turn, uncancellable)

---

7. Master Tao

# Every time this character consumes 3 stacks of [ignite] during battle

- Heals own hp equal to 30% of max hp (max of 3 times)

---

8. Meliodas -

All demon allies basic stats 5% 👆;

# When attacking, for every 3% of maxHP lost

- Damage 2% 👆 (Uncancellable)
- Critical chance 2% 👆 (Uncancellable)

---

9. Mustafa -
   [Red] and [Green] element allies DEF 50% 👆 during battle

---

10. Sara

[Female] allies' damage 5% 👆 during battle

# When taking a lethal blow at 30% hp or higher

- Removes all debuffs and buffs from self.
- Heals 50% of incoming attack damage (Only once)

---

11. Seras

[Powerful Opponent] allies' all stats 10% during battle 👆

# After receiving or evading an attack

- Gains 1x [Charged] stack. (Max 6) (Uncancellable)
  -- [Charged] - For each stack - ATK, DEF and evade chance 5% 👆

---

12. Siddiq -

# When attacking while hp is 50% hp or below

- Heals self equal to 20% of damage dealt to enemies

---

13. Yalina -

# After an ally uses a skill

- Gains 1x buff [Damage 20% 👆] (max 5)

# After using a skill to deal damage to enemies

- Removes all [Damage 20% 👆] buffs from self

## Ideas

- Thinking about developing a probability related tier word system too. Very low chance = 5%, Low chance = 10%, Medium chance = 30%, High chance = 50%, Great chance = 70%,
  -- we can probably use it for crits or evades and other stuff. for example "Medium chance to evade attacks", "Great chance for critical attacks". Usually passive stuff but may appear in skills too. Eventually having a skill that may do "High chance of massively raising atk and do damage equal to x ATK"

## Future characters' kit (Not finalized)

### Knuckle Bine - HxH | Human | Collab - Standard

- HP - 1450 ; ATK - 200 (ref to manga chapter debut): DEF - 86 (Ref to anime episode debut)

- Passive : Applies an effect [APR] on an enemy when knuckle deals damage to them after using an skill. The intial value of the [APR] is equal to the damage dealt by the skill. [Only 1 [APR] may exist]
  -- [APR]'s value increases by 10% at the end of every turn + [50]% of damage dealt by knuckle using his skills following the intial hit.
  -- the [APR] affected enemy will have its basic stats lowered by 20% and all of their single target attacks are taunted towards Knuckle (is not affected by other taunt effects).
  -- [APR]'s value can lowered by enemy by dealing damage to knuckle. Once it hits 0, [APR] will be removed from the enemy and knuckle may put a new [APR] effect on any enemy with his next attack.
  -- Once [APR]'s value is greater than enemy's maxHP then [APR] will change to [IRS] effect resulting in enemy's death at the end of turn.
  - Skill 1 Rank 3 - Does damage equal to [600]% to one enemy. Increases damage by 20% if the enemy has [APR] effect.
  - Skill 2 Rank 3 : Does [Detonate] damage equal to [500]% ATK to one enemy
  - Ultimate : Raises ATK and DEF for 3 turns, does [500]% ATK damage to one enemy.

### Isaac Netero - HxH | Human | Collab - Premium

- HP - 1230; ATK - 287 ["Head of the Exam Commission for the 287th Hunter Exam."] ; Def - 110 ["Least confirmed age at the time of death"]

- Passive : Applies an effect [Suppressed] on self for 3 turns at the start of battle. While the [Suppressed] effect is active, Netero has 70% damage reduction but is unable to attack and cannot gain ultimate gauge.
  -- After [Suppressed] effect is over, gains [Pinnacle of Nen Mastery] effect for the duration of the battle.
  -- While [Pinnacle of Nen Mastery] effect is active, Netero deals 30% of damage dealt by each skill as a follow up attack. He is immune to all stat decrease effects. He does 50% extra damage and gains type-neutral effect when there is only 1 enemy

- Skill 1 Rank 3 - Does [Power Strike] damage equal to [400]% to one enemy.
- Skill 2 Rank 3 - Does [Rupture] damage equal to [300]% to all enemies
- Ultimate - Does [Power Strike] damage equal to [500]% to one enemy and fills own ult gauge by 2.

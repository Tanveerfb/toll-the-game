# Game notes, ideas, bugs, requests by Tanveer Singh

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

### Chiara - Human | Female | Bureau

- HP - 1100; ATK - 191; DEF - 99

- Passive - While on battlefield, Gains one of the following effects randomly at the start of every turn : All enemies ATK - 20% (debuff) for 1 turn, Allies ATK and DEF +15% (buff) for 1 turn, 30% Damage reduction to self (buff) for 1 turn. Ranks up all skills in deck by 1 level at the start of turn 3 (excludes rank 3 skills).
- Skill 1 Rank 3 - Does damage equal to [400]% to one enemy and grealy lowers def for 2 turns
  -- Rank 1 would only [lowers def] for 1 turn
  -- Rank 2 would [greatly lowers def] for 1 turn
- Skill 2 Rank 3 - Does damage equal to [375]% to one enemy and seals [attack debuff] and [debuff] skills for 2 turns.
  -- Rank 1 would not seal anything. just a attack skill.
  -- Rank 2 would only seal [Attack Debuff] skills for 1 turn
- Ultimate - Raises atk for 3 turns, increases evade chance by 33% for 3 turns and does damage equal to 333% to all enemies.

### Isolde - Fairy | Female | Bureau

- HP - 1333; ATK - 184; DEF - 77

- Passive - Increase all allies HP related stats by 10%. Activates from sub
- Skill 1 Rank 3 - Cleanses debuffs from all allies, heals equal to 30% of maxHP and applies[rejuventes] (HoT, 30% of heal amount) for 2 turns.
  -- Rank 1 would target 1 chosen ally and rejuvenates for 1 turn
  -- Rank 2 would target all allies and rejuvenates for 1 turn
- Skill 2 Rank 3 - Does damage equal to [400]% to all enemies and [depletes] 3 ult gauges
  -- Rank 1 would only do damage and will not deplete any ult gauge
  -- Rank 2 would do damage and deplete 1 ult gauge from each enemy
- Ultimate - Grants all allies [Debuff Immunity] buff and increases their basic stats by 30% for 3 turns

## Ideas

- Thinking about developing a probability related tier word system too. Very low chance = 5%, Low chance = 10%, Medium chance = 30%, High chance = 50%, Great chance = 70%,
  -- we can probably use it for crits or evades and other stuff. for example "Medium chance to evade attacks", "Great chance for critical attacks". Usually passive stuff but may appear in skills too. Eventually having a skill that may do "High chance of massively raising atk and do damage equal to x ATK"
- Also there should be a difference between 'all stats' and 'basic stats'
  -- Basic stats would only involve ATK, DEF and HP
  -- All stats would involve basic stats + crit chance + evade chance + other new sub stats we may add in the future such as crit damage, lifesteal, etc.
  -- THinking of adding these substats in the future - Crit damage (default 50%), Recovery rate (default 100%), Lifesteal (5%), Crit resistance (10%)
- Will categorize 'X-related stats'. for example 'Attack related stats' will involve ATK, crit chance, crit damage. 'Defense related stats' would include DEF, crit resistance. 'HP related stats' would include HP, recovery rate, lifesteal.
  -- Currently, Evade chance and damage reduction do not fit into any 'related' categories

## Notes and new mechanics

Effect - Grey effect. Uncancellable
Buff - Blue Cancellable buff effect.
Debuff - Red cancellable debuff effect.

- [Power Strike] - "Increases damage based on enemy defense"
  -- For every 2 enemy defense, increases damage dealt by 1%
- [type-neutral] effect - There is no element disadvantage when dealing or receiving damage
- [Debuff Immunity] - A character with this buff or effect will not receive any debuffs until the expiry of the buff/ effect. All exisiting debuffs are also cancelled.
- Recovery Rate (new substat) - A value in percentage for heal scaling
  -- when healing or gaining health by any means, it is mulplied by the recovery rate factor. For example, on a 100hp heal. it would calculate 100hp x 1.0 (100% recovery rate) = 100hp. On a 150% recovery rate, it would be 100hp x 1.5 = 150hp recovered.
- Lifesteal (new substat) - A value in percentage that tells how much portion of damage dealt is converted to heal.
  -- The value defines how much the character heals from doing damage to enemies. For example, a character with 5% lifesteal will heal 5% off all damage dealt by them using skills during battle. also includes counter damage. The lifesteal heal applies at the end of attack before the next action goes. This lifesteal heal is also affected by recovery rate

- What's the difference between attack skill, attack debuff, debuff, buff skills?
- Answer :
  -- Attack skills do damage, they can have mechanics that buff the damage such as weakpoint, detonate or etc. They can also have addtional effects such as cancel stance or buffs.
  -- Attack Debuff skills - Mix of Attack and Debuff skills that do damage and inflict 1 or more debuff on the enemy for example - "Does damage equal to one enemy and applies [Bleed] debuff for 2 turns". Cancellable debuffs
  -- A fun case - Diane's "Rush rock" skill is just a attack skill at rank 1 but becomes a attack debuff skill starting at rank 2 because it applies attack seal. This behaviour is intentional
  -- Debuff skills - These will not do damage but straight up apply debuffs on the enemies. These may include DoT. Such example could be - "Applies [Corrosion] debuff on the enemies for 2 turn".
  -- Buff skills - Applies buffs and other stat increase effects to one or more allies. For example "Increases atk of all allies by 40% for 2 turns".

- Q : What kind of passives may or may not activate from sub?
  -- Answer - Usually passives that only buff or apply effects while not requiring them to interact with enemies or allies can activate from sub position. Such as upcoming character Isolde's passive.
  -- Other characters' passives that can work from sub - Leorio, Mustafa, Gabrist
  -- On the other side, New upcoming character Chiara's passive will not activate from sub because she needs to be on field to gain buffs for self or allies via passive. She also a literal condition at the start of her passive "While on battlefield"
  -- Such examples where passives wouldn't activate from sub are - Diane, Meliodas, Ban, Duke, Lyra, Batra, Sara, Yalina, Siddiq, Gon, Killua, Master Tao

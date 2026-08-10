# Game notes, ideas, bugs, requests by Tanveer Singh

Last updated - 30/07/2026

> Entries get removed once implemented/resolved/verified — see `author_notes_report.md` for the log of what happened to each one and when.

## Future characters' kit (Not finalized)

> **Every statline below predates the roster stat rebalance of 2026-08-10
> (ruling #68).** They were written against the old scale, where a DPS carried
> ~1500 HP and ~250 ATK. The live roster now runs **2900–4000 HP** with ATK
> broadly unchanged. Any kit here must have its HP (and any HP/DEF-scaled skill
> percentages) re-derived from the current bands in `docs/design/KIT_DESIGN.md`
> before implementation — do **not** copy these numbers into JSON as-is.

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

### Confirmed behaviour — answers from Tanveer, 2026-08-10

**Knuckle / [APR]**

- **[APR] is ONE uncancellable effect bundling three things**: the growing counter, the 20% basic-stat-down, and the taunt. Not three separate entries. Deliberate exception to ruling #60 (debuffs are cancellable) — cleanse and Debuff Immunity do **not** strip it.
- **Knuckle's taunt is high priority and uncancellable, but only for the [APR] enemy.** That enemy ignores all other taunts; every other enemy may or may not target him normally.
- **vs bosses:** IRS may one-shot **one phase**, never the whole boss. When IRS triggers a phase shift, **[APR] is removed** and Knuckle starts over on the new phase.
- **Enemy removes [APR] by dealing full damage to Knuckle** — reduction equals the damage dealt. At 0 it drops and he may re-apply on his next hit. The swinginess is intentional and anime-faithful: hold aggro, survive without losing the counter, trade blows occasionally.
- **[APR] does not survive Knuckle's death** — all passive effects he caused disappear with him.
- Ultimate's ATK/DEF raise is plain-tier (**30%**) and resolves **before** its own damage (ruling #22). Confirmed intentional.

**Netero**

- **He still draws cards while [Suppressed]** — rendered greyed-out/disabled, unplayable. Clogging the shared hand for 3 turns **is the cost**; the team plays around him until he comes online.
- **[Suppressed] is uncancellable** — no cleansing into an early [Pinnacle of Nen Mastery].
- **Stat-decrease immunity is NOT Debuff Immunity.** He still takes DoTs like Ignite/Corrosion; only *stat decreases* fail, including those from enemy passives (Knuckle's [APR] stat-down among them).
- **Follow-up attack:** auto-triggers, **max 1 per skill use**, same target as the parent hit. Does **not** proc if the parent hit killed the target, and does **not** count as an attack for attack-counting passives (Seras' Charged, Meliodas' Full Counter, Gon's Rookie Hunter).
- **type-neutral here is DEFENSIVE only** — an enemy's type advantage is neutralised when dealing damage *to* Netero; his own outgoing advantage is unaffected. This differs from the existing glossary entry in `docs/ARCHITECTURE.md`, which defines type-neutral as both directions — needs a separate defensive variant.
- `[Power Strike]` is already defined: +1% damage per 2 points of enemy DEF (`docs/ARCHITECTURE.md` Design Glossary). Defined, not yet implemented as a mechanic type.

**Rank ladders — DRAFT, awaiting approval.** Only R3 was authored; these follow the roster's 65/80/100 convention (Chiara 260/320/400, Killua 230/280/350, Gon 195/240/300).

| Skill | R1 | R2 | R3 |
| --- | --- | --- | --- |
| Knuckle S1 (+20% vs [APR] stays flat) | 390 | 480 | **600** |
| Knuckle S2 [Detonate] | 325 | 400 | **500** |
| Netero S1 [Power Strike] | 260 | 320 | **400** |
| Netero S2 [Rupture] AoE | 195 | 240 | **300** |

Ultimates don't rank: Knuckle 500, Netero 500.

Open concern: Knuckle's S1 at 390% R1 would be the **highest R1 single-target on the roster** (next is Chiara at 260). Deliberate, since [APR]'s ramp keys off that first hit — but it's the number to cut if he tests too strong.

## DBZ brainstorm drafts — PARKED, not queued for implementation

> Tanveer, 2026-08-10: *"wouldn't implement it anytime soon… don't want it
> interfering with work."* These three are **brainstorming output**, kept for
> reference only. Unlike Knuckle and Netero above, nothing here is planned —
> **do not build, balance, or reference them as roster facts.** Delete freely.

### Son Goku (Saiyan Saga) - DBZ | Saiyan | Collab

Drafted by Claude 2026-08-10 under Tanveer's direction, then tuned by him. Damage scales off **ATK** only.

- Role: **DPS (glass cannon)** ; Color - red ; HP - 1600 ; ATK - 240 ; DEF - 80

- Passive [Zenkai] : [Collab] allies' basic stats 5% up during battle
  -- When taking a lethal blow: survives with 1 HP and permanently raises ATK by 50% (Only once, Uncancellable)
  - Skill 1 [Kamehameha] : Does [Concentrate] damage equal to 230/280/350% ATK to one enemy.
  - Skill 2 [Kaio-ken] : Raises own ATK by 25/50/75% for 1 turn; consumes 10% of own current HP.
  - Ultimate [Kaio-ken x4 Kamehameha] : Massively raises ATK for 3 turns and then does [Pierce] damage equal to 350% ATK to one enemy; consumes 25% of own current HP.

Design notes: the source-material multiplier is **flavour on the name, not the number** — Kaio-ken x3 is a 75% ATK buff. Skill ranks never exceed 3, so x4 lives in the ultimate, where "massively" (100%, ruling #56) stacks multiplicatively with an active Kaio-ken for the burst ceiling (~2,940 at R3 into R3).

**Open:** (1) whether to push the statline further into glass cannon (1400 HP / 250 ATK / 75 DEF) now that Vegeta is explicitly the balanced one; (2) whether Kaio-ken's recoil can take him to 0 HP or floors at 1 like Batra's.

### Vegeta (Saiyan Saga) - DBZ | Saiyan | Collab

Drafted by Claude 2026-08-10, tuned by Tanveer. Scored 8/10. Damage scales off **ATK** only.

- Role: **Defense (sub-DPS)** ; Color - blue ; HP - 1700 ; ATK - 165 ; DEF - 115

- Passive [Saiyan Genetics] (on attack received) : Gains 1 x [Zenkai] stack (Max 5) (Uncancellable)
  -- [Zenkai]: For each stack, ATK and DEF 8% up
  - Skill 1 [Galick Gun] : Does [Pierce] damage equal to 230/280/350% ATK to one enemy.
  - Skill 2 [Power Ball] : Greatly raises own DEF for 2 turns and then does damage equal to 150/200/250% ATK to all enemies.
  - Ultimate [Great Ape] : Does [Rupture] damage equal to 400% ATK to all enemies and massively lowers their DEF for 2 turns.

Design notes: **he deliberately has no ally-synergy line** — every other collab opens with "[Tag] allies' basic stats 5% up"; its absence is the "ruthless Saiyan who doesn't need teammates" read, at zero engine cost. Blue is chosen so the type chart says he beats red (Goku). His ramp requires being hit, which is what makes a defense unit want to be targeted — the inverse of Goku, who spends his own HP. Great Ape would be the **roster's first use of "massively"** (80% lowering, ruling #56).

**Open:** whether 8% x 5 stacks sits far enough from Seras' [Charged] (5% x 6 across ATK/DEF/evade).

### Super Saiyan Goku (Namek Saga) - DBZ | Saiyan | Collab

Drafted by Claude 2026-08-10, directed by Tanveer. Already transformed — **no Kaio-ken, no Spirit Bomb, no transformation step** (both are pre-Super-Saiyan tools). Damage scales off **ATK** only.

- Role: **DPS (duelist)** ; Color - light ; HP - 1550 ; ATK - 265 ; DEF - 90

- Passive [Super Saiyan] : Damage reduction 10% up during battle
  -- While an ally has been defeated: ATK 50% up (Uncancellable) [Krillin]
  -- When facing only 1 enemy: Damage 30% up, Damage reduction 25% up
  - Skill 1 [Kamehameha] : Does [Concentrate] damage equal to 230/280/350% ATK to one enemy.
  - Skill 2 [Meteor Combination] : Raises ATK and greatly raises DEF for 2 turns and then does [Weakpoint] damage equal to 150/190/250% ATK to one enemy.
  - Ultimate [Angry Kamehameha] : Does [Desperation] damage equal to 600% ATK to one enemy.

The ult is **meant to be overpowered on raw power alone** (Tanveer, 2026-08-10): canonically it beats Frieza, who has an extremely durable body — Goku can't win the even clash and wins with this. No DEF-ignore or extra damage type; the 600% multiplier plus [Desperation]'s scaling is the whole statement.

**[Desperation] — proposed new mechanic, unimplemented.** Damage increases by **3% for every 2% of HP lost** (1.5% per 1% missing), uncapped. For calibration that is 2.25x steeper than Meliodas' `deathblow` (2% per 3% lost), which is justified because Deathblow is always-on and this fires once off an ult gauge.

Ult ceiling, accepted as fine by Tanveer: 1,590 at full HP → ~5,600 at 10% HP with an ally down → ~7,300 if the solo-enemy clause is also live. Single target only, and he is two hits from death to get there.

**Engine work this kit would need** (none of it exists):
- `aura` condition "while an ally is defeated" — the inverse of the existing `conditionNoDeadAllies` (Gabrist), so a small addition to a mechanic that already exists.
- A "only 1 enemy on the field" condition — new, but **Netero's kit needs the identical condition**, so one implementation serves both.
- `[Desperation]` as a damage type in the mechanic union + Design Glossary.

### Final Form Freeza (Full Power) - DBZ | Frieza Force | Collab

Drafted by Claude 2026-08-10, passive written by Tanveer. **This is the 100% Full Power version** — Tanveer's call, and correct: the decaying passive *is* that form. 100% is the one Frieza cannot sustain, so a kit that opens at maximum and slides every turn is exactly it. The arms-folded, not-trying-yet Final Form would never decay; if he is ever drafted separately, that's the difference. Damage scales off **ATK** only.

- Role: **DPS (executioner)** ; Color - dark (opposite SSJ Goku's light — mutual advantage both ways) ; HP - 1650 ; ATK - 270 ; DEF - 105

- Passive [Emperor of the Universe] :
  -- At the start of battle: Damage reduction 50% up, ATK and DEF 50% up (Uncancellable)
  -- At the start of each turn: Damage reduction 10% down, ATK and DEF 10% down (up to a max of 30%)
  -- When this unit defeats an enemy: ATK 10% up (Uncancellable)
  - Skill 1 [Death Beam] : Does [Execution] damage equal to 230/280/350% ATK to one enemy.
  - Skill 2 [Death Saucer] : Does damage equal to 150/190/250% ATK to one enemy and applies Bleed for 2 turns; consumes 10% of own current HP.
  - Ultimate [Supernova] : Does damage equal to 500% ATK to all enemies.

Design notes: **two clocks running opposite directions.** He peaks on turn 1 — 50% DR and 405 ATK before the player has done anything to deserve it — and decays to a 20% floor by turn 4. The only thing that reverses the slide is killing your units, and each kill buys back exactly one turn of decay. Stall him out and you win; feed him and it snowballs. The kill bonus needs no "Max N" because the enemy team is finite (4 units = natural cap).

| Turn | 1 | 2 | 3 | 4+ |
| --- | --- | --- | --- | --- |
| DR / ATK / DEF bonus | 50% | 40% | 30% | 20% |
| ATK, no kills | 405 | 378 | 351 | 324 |
| ATK after 2 kills | — | 457 | 425 | 392 |

Death Saucer's 10% self-damage is the joke, not the balance — his own disc is what cuts him in half.

**A boss variant exists in the same character:** keep the DR decay but make ATK/DEF a flat +100% that never drops. Reach for that if he is ever built as an `elite` fight. Careful — passive buffs multiply (#66), so flat +100% with kill stacks compounds fast.

**Engine work this kit would need** (none of it exists):
- `[Execution]` — defeats a target left below 20% HP after the hit. Should be **barred against `elite`/boss units**, the same bound Tanveer put on Knuckle's [IRS].
- An "when this unit defeats an enemy" hook.
- A self-decaying passive value on the turn tick (DR/ATK/DEF sliding 10% per turn to a floor).

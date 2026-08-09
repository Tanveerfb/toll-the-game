# Game notes, ideas, bugs, requests by Tanveer Singh

Last updated - 30/07/2026

> Entries get removed once implemented/resolved/verified — see `author_notes_report.md` for the log of what happened to each one and when.

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

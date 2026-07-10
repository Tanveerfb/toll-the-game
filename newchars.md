# Character kits and notes by Tanveer Singh

---

## KIT TEMPLATE (copy per character, delete lines that don't apply)

```
## <Name> | <Species/Origin> | <Element/Power>

- COLOR: <light/red/blue/green/dark>          <- archive/type color
- HP <n> | ATK <n> | DEF <n>
- TAGS: [<Tag1>], [<Tag2>]
- ROLE: <one line — e.g. attack scaler, buff-stacker, tank>

### Skill 1 — <name (optional)>
- Damage [r1/r2/r3]% to <one enemy | all enemies | ...>
- Effect: <NAME> for <n> turns — <what it does, exact numbers>
  - scales with rank? [yes: r1/r2/r3 values | no: flat]

### Skill 2 — <name (optional)>
- (same shape as Skill 1)

### Ultimate — <name (optional)>
- Damage <n>% to <target>       <- one value, ults have no ranks
- Effect: <...>

### Passive
- Trigger: <when it fires — e.g. on being hit, on ally attack, battle start>
- Effect: <exact numbers, per-stack values>
- Stack cap: <n | none>
- Works from sub position? <yes/no>          <- default yes

### Synergy (optional)
- <condition — e.g. tag on team> -> <exact stat bonus>

### New mechanic definitions
- <MECHANIC NAME>: <precise rule — trigger, numbers, duration,
  stack cap, what consumes/removes it, does it stack with itself>
```

**Conventions (so I don't have to ask):**

- `[r1/r2/r3]` = value at card rank 1/2/3. Single value = flat, never scales.
- Ultimate must hit harder than any rank-3 skill.
- Any skill with damage > 0 deals that damage even if it's "a debuff skill".
- Buff/debuff duration N = ticks N-1 times (turn-start tick rule).
- If a mechanic already exists (Weakpoint, Amplify, Shock...), name-drop it —
  no need to redefine. New ones need full definition once.
- Anything you leave out, I will ask rather than invent.

---

<!-- Implemented kits get removed from this file — they live in data/characters/*.json.
     Seras, Meliodas, Ban, Diane: implemented 2026-07-07. -->

## Gon Freecss | Human | Nen - Enhancer Type

- COLOR: Green
- HP 1501 | ATK 95 | DEF 90
- TAGS: [Male], [Collab], [Hunter x Hunter]

### Skill 1 — Jajanken : Rock

- Raises atk by 30% for 1 turn [cannot be cancelled] [stackable]
- Damage [120/150/225]% to one enemy

### Skill 2 — Jajanken : Round 2

- Damage [120/135/180]% to one enemy
- fills own ultimate gauge by [1/1/2]

### Ultimate — Jajanken Combo

- Raises attack by 30% [cannot be cancelled] [stackable]
- Greatly raises defense by 1 turn [50%]
- 500% Damage to 1 enemy

### Passive - Rookie Hunter

- After receiving 10 attacks in battle, Gon loses 50% attack but gains 50% def [cannot be cancelled] [activates only once]
- Works from sub position? no

### Synergy_gon

[Collab] stats +5% in battle

## Killua Zoldyck | Human | Nen - Transmutation Type

- COLOR: Blue
- HP 1054 | ATK 129 | DEF 79
- TAGS: [Male], [Collab], [Hunter x Hunter]

### Skill 1 — Lightning Palm

- Cancels stances
- Damage [150/180/250] to one enemy
- stuns at rank 2 or above for [x/1/2] turns

### Skill 2 — Thunderbolt

- DETONATE damage [120/135/180]% to one enemy
- Detonate - Increases damage by 20% for each of target enemy's ultimate gauge

### Ultimate — Speed of Lightning

- Raises attack and defense [30%] [cannot be cancelled] [stackable]
- 500% Damage to 1 enemy

### Passive - Prodigy assassin

- After receiving 10 attacks in battle, Killua loses 50% defense but gains 50% attack [cannot be cancelled] [activates only once]
- Works from sub position? no

### Synergy_killua

[Collab] stats +5% in battle

## Leorio Paradinight | Human | Nen - Emission Type

- COLOR: Red
- HP 980 | ATK 93 | DEF 85
- TAGS: [Male], [Collab], [Hunter x Hunter]

### Skill 1 — Member of the Zodiac

- Buffs [a single ally/ all allies/ all allies]
- attack + defense support [15/25/40]%
- duration for [1/1/2] turns

### Skill 2 — Switchblade attack

- PIERCE damage [120/135/180]% to one enemy and applies BLEED for [1/1/2] turns
- BLEED - DOT Equal to 90% of damage dealt
- PIERCE value - 30%

### Ultimate — Remote Punch

- cancels buffs and stances
- 500% Damage to 1 enemy
- stuns for 2 turns

### Passive - Kind hearted friend

- All allies stats +10% if character 'Gon' or character 'Killua' is a team member. Additional allies stats +10% if both characters are alive on the battlefield.
- stats = atk, def and max hp
- Works from sub position? yes

### Synergy_leorio

[Collab] stats +5% in battle

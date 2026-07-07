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

## Seras | Hybrid [Fairy + Human] | Lightning/ Electro powers

- HP 1450 | ATK 135 | DEF 65
- TAGS - [Female], [Powerful Opponent]
- Attack scaler.

### Skill 1

- Damage [150/180/250]% to one enemy and applies SHOCK for 4 turns
- SHOCK - DOT damage equal to 30% of damage dealt. Stacktable.

### Skill 2

- Weakpoint Damage [130/150/200]% to all enemies
- Weakpoint - 3x Damage against Debuffed enemies

### Ultimate

- CRITICAL 500% attack Damage to 1 enemy
- CRITICAL - Ignores 50% Defense + type advantage/disadvantage and increases damage by 50%

### Passive

- Gains [Charged] stacks every time Seras receives or evades an attack [5 max]
- [Charged] - Attack, Defense and evade chance +5% for each stack.

### Synergy

- Tag [Powerful Opponent] stats +10% in battle

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

(no pending kits)

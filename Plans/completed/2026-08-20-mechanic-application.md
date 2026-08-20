# Spec — mechanic application: audience and timing

> **BUILT 2026-08-20**, both parts. `applyTo`/`applyToRanked` with self as the default audience, and `requiresDamage` for a buff that lands after the hit. Six kits migrated. **A4d (`aoe` narrowing to enemies-only) was deliberately not built** — see the note at the end of `Plans/README.md`. Tests: `tests/allyTargeting.test.ts`, `tests/mechanicTiming.test.ts`.

**Status:** built 2026-08-20 (see the banner above). Two changes to how a mechanic lands, merged
2026-08-20 because **both restructure the same region of `executeSkill`** — the
self-buff loop at `combat.ts:556` and the `targets.forEach` that follows it.
Building them separately means restructuring that region twice.

- **Part A — audience.** A mechanic declares *who* it hits, instead of inheriting
  whoever the skill targets. **Two open questions** (§A6).
- **Part B — timing.** A self-buff can declare that it lands *after* the hit, and
  only if the hit connected. **No open questions** — fully specced.

**Part B is smaller and unblocked.** If only one ships, ship B; it is a loop
split plus a hoisted flag, where A is a rewrite of how every mechanic branch
finds its subject.

---

# Part A — audience

## A1. Why

His ruling:

> *"you will need to factor in caster and its team alongside target enemy during
> skill or ult uses. so that buffs or debuffs hit specific parties rather than
> mix n match."*

The trigger was mapping a Dokkan kit onto our engine:

> Greatly raises ATK and causes mega-colossal damage to enemy; raises allies'
> DEF by 60% for 1 turn (self excluded)

Three audiences in one card — the caster, the enemy, and the caster's team minus
the caster. We can express the first two and have no way to say the third.

This shape is **normal in Dokkan**, not exotic. Expect it repeatedly as kits get
drafted from that source.

## A2. How targeting works today

`executeSkill` in `lib/game/combat.ts` resolves **one** `targets` list, and every
mechanic applies to it unless it is self-targeted.

| Line | What |
|---|---|
| `472` | `hasFriendlyAllyMechanic` — any non-self heal/buff/cleanse/debuffImmunity/healOverTime |
| `482` | `isHealOrBuff` — skill type heal/buff/stance, or a support ultimate |
| `501` | `isSupportUltimate` — ultimate + friendly mechanic + **zero damage** |
| `505` / `511` | `isAttack` / `isOffensive` |
| `524` | `targets = isHealOrBuff ? alliedTeamForSource : enemyTeamForSource` — **the whole model in one line** |
| `526` | living, non-sub filter |
| `556` | self-buff loop: `targetSelf` → `updatedSource`, before the damage calc (#22) |
| `1276` / `1296` / `1327` / `1343` | cleanse / buff+stance / debuffImmunity / healOverTime, each guarded on `isHealOrBuff` |

A mechanic's audience is **inferred** from the skill's type and damage, never
declared. Fine while a skill points at one side; broken the moment a card wants
both.

## A3. Already done — do not redo

**The buff branch leaked to the enemy.** Line `1296` checked only
`!mech.targetSelf`, so on an *attacking* skill it handed the buff to whoever was
being hit. Constructed proof, before the fix:

```
caster: [atk +50%]          ← targetSelf, correct
ally:   []                  ← got nothing
enemy:  [def +60%, 1 turn]  ← got the buff meant for the caster's team
```

Its three siblings all guarded on `isHealOrBuff`; this one didn't. Now it does,
making such a mechanic **inert instead of harmful**. Behaviour-preserving for the
whole roster — every non-self buff in the game sits on a zero-damage support
skill. Pinned by `tests/allyTargeting.test.ts` → *"a buff never lands on the unit
being attacked"*.

## A4. Decisions — settled

### A4a. The default audience is **self**

Not "whatever the skill targets". His words:

> *"it wouldn't say allies if the default is self only."*

So an audience-less buff is a self-buff, and the description says nothing about
targeting — the reader infers self because no ally is named.

**This is not a pure addition.** It inverts the fallback, so the four kits that
currently rely on inference must declare an audience or silently become
self-only. See §6.

### A4b. Vocabulary, and how it reads on the card

| `applyTo` | Reads as | Notes |
|---|---|---|
| absent | *(nothing said)* | self — the default |
| `"oneAlly"` | "one chosen ally" | the player picks a target from their own side |
| `"allies"` | "allies" | **includes the caster** |
| `"alliesExceptSelf"` | "allies (excluding self)" | Dokkan's "(self excluded)" |
| `"enemies"` | "enemies" / "one enemy" | today's offensive default; breadth comes from `aoe` |

**Note the deliberate asymmetry.** Ally breadth lives in the *value*
(`oneAlly` vs `allies`); enemy breadth lives in the **`aoe` mechanic**, per A4d.
That is not tidiness for its own sake — it is how the game already talks: `aoe`
has always meant "all enemies on the field", and inventing a parallel
`oneEnemy`/`allEnemies` pair would give two ways to say the same thing.

His phrasing rule, verbatim:

> *"if it targets allies including the caster then only 'allies' otherwise
> 'allies (excluding self)'."*

**A single field, not a separate `excludeSelf` flag** — this supersedes the
recommendation in the first draft of this spec. The vocabulary is what the card
prints, so it should be one value with one spelling.

### A4c. A self buff is written before the damage clause

> *"for self only, the buff would be before the damage clause comes. something
> like 'Greatly raises ATK, increases DEF by 60% for 1 turn and …'"*

Consistent with **#22** (a self-buff applies before the damage calc and the same
strike benefits) and **#110** (clause order and the comma decide scope — in his
example the ATK raise is permanent and only the DEF raise carries the 1 turn).
No engine change; it is a wording rule and belongs in `kitwords`.

### A4d. `aoe` means all **enemies** on the field

> *"AOE means it targets all present enemies on the field. (sub enemy who's not
> on field yet wouldn't count)."*

So `aoe` stays a strictly **offensive** breadth marker and stops doing double
duty as "all allies". Team-wide friendly effects are expressed by
`applyTo: "allies"` instead.

The sub exclusion already holds — line `526` filters `!t.isSub`.

## A5. Implementation sketch

1. **Resolve three lists once**, near line `517`, from the **caster's**
   perspective: `self`, `allies`, `enemies`, each filtered living and non-sub.
2. **One resolver** — `audienceFor(mech, lists)` — defaulting to `self` per 4a.
3. **Each mechanic branch asks the resolver** rather than using the loop's
   `updatedTarget`. This is the real work: the branches sit inside a
   `targets.forEach`, so a mechanic with a different audience has to be lifted
   out of that loop instead of being called once per target.
4. **`aoe` narrows to the enemy list** (4d), and no longer flips to allies via
   `isHealOrBuff`.
5. **Ordering rulings stay put.** Self-buffs still resolve before the damage calc
   (#22, line `551`); clause order still decides what a tanked hit nullifies
   (#75). Neither is about audience.
6. **`targetSelf` becomes redundant** — it now expresses the default. Leave the
   14 occurrences alone rather than risk a transcription error across 10 kits;
   drop them in a separate mechanical pass if ever.

## A6. Migration — four kits, all settled

Every kit that currently leans on inference:

| Kit | Today | Under 4a/4d | Status |
|---|---|---|---|
| `isolde` Starbound Ward | `aoe` + friendly mechanics → all allies | `applyTo: "allies"` on the buff **and** the debuffImmunity; **drop the `aoe` entry** or it would aim at enemies | Mechanical |
| `mustafa` Earth Stance: Fortress | `aoe` + `stance` → all allies | Same: `applyTo: "allies"`, drop `aoe` | Mechanical |
| `iron` Iron Wall | `stance`, no `aoe` → the single chosen target | **Question 1** below | **Open** |
| `leorio` Member of the Zodiac | `aoeRanked [false,true,true]` → one ally at R1, all allies at R2+ | **Question 2** below | **Open** |

**Question 1 — SETTLED 2026-08-20: Iron Wall is self-only.** It resolves to
`[actualTarget]` today because it has no `aoe` and `isHealOrBuff` is true; under
the self default it simply becomes a self stance, which is what it was meant to
be. **Nothing to author and nothing to migrate** — and the four values in A4b
stay as they are, since no single-target-ally audience is needed.

**Question 2 — SETTLED 2026-08-20: Leorio ladders his audience by rank.** His
answer: *"a chosen ally at R1 yes. then friendly AOE or 'allies' (not allies
(excluding himself)) at R2+."*

So the audience itself is ranked, exactly as values and durations already are:

```jsonc
{ "type": "buff", "stats": ["atk","def"],
  "valueRanked": [20, 30, 50], "durationRanked": [1, 1, 2],
  "applyToRanked": ["oneAlly", "allies", "allies"] }
```

`applyToRanked` mirrors `valueRanked` / `durationRanked` / `stacksRanked`, which
is the convention every other per-rank field already follows — so it needs no new
resolution machinery, only a non-numeric entry in the same ladder shape.

**`aoeRanked` retires with it.** Leorio's is the only kit using `aoeRanked` for
ally breadth, and once `aoe` means enemies only (A4d) the mechanic has no job
left on his card. His description's `[aoeRanked? allies : one ally]` conditional
becomes a branch on the resolved audience instead — the conditional syntax
already branches on a mechanic being present, so this needs the placeholder
resolver taught about `applyTo`, which is the one description-side change in
Part A.

Both questions are about two kits, not about the design — the field shape in §4
stands either way.

## A7. Blast radius

**Touches** `lib/game/combat.ts` (target resolution and every mechanic branch),
`types/mechanic.ts`, `lib/game/characterSchema.ts` if validated, four kit JSONs,
and `descriptionTranslator.ts` if Question 2 retires `aoeRanked`.

**Must not change** the other 23 kits, or the rulings sharing this file: **#22**
(self-buff before the hit), **#41** (cancel-then-hit), **#43** (victory fizzles
the queue), **#60** (debuff immunity gates every applier), **#61** (a support
ultimate does not attack), **#75** (tanked hits nullify by clause position).

**Highest-risk interaction:** `isSupportUltimate` (line `501`) requires **zero
damage** for an ultimate to count as ally-directed — deliberately, per the
comment at `495`, so "a future buff-and-damage ultimate" keeps attacking. A
declared audience *is* that future, so decide whether this flag should read
audiences instead of damage. Isolde's ultimate is the only kit that exercises it.

## A8. Verification

- New tests: one per `applyTo` value; the Dokkan shape (attack that damages an
  enemy and buffs the caster's team in one card); `aoe` reaching only field
  enemies and never a sub; and an audience-less buff landing on the caster alone.
- Regression: the four migrated kits must behave exactly as before the change —
  Isolde's ult still buffs the whole team, Mustafa's stance still covers it.
- `npm run check` — baseline **1,235 passing / 98 files** as of 2026-08-20.
- Build with `NEXT_DIST_DIR`. **:3000 is his dev server — never start or kill one.**
- **Visual pass is his.** This is the file every ruling touches; a green suite is
  necessary, not sufficient. Ask for a real fight before calling it done.

## A9. Related

- The same Dokkan kit needed **crit chance to be buffable** — fixed 2026-08-20,
  ruling **#16**.
- Wording lives in the `kitwords` skill: 4b's vocabulary and 4c's clause order
  are recorded in `.claude/skills/kitwords/SKILL.md`.

---

# Part B — timing

### B1. Why

An old Dokkan super attack:

> Causes supreme damage to enemy **and** raises DEF by 30% for 3 turns

The order is deliberate. Tanveer, 2026-08-20:

> *"damage needs to be done to enemy first before the self buff activates. it is
> different than buff first and then do damage."*

Ours can only do the second. `executeSkill` has exactly one self-buff path —
`lib/game/combat.ts:556` — inside an unconditional `skillMechanics.forEach` that
runs **before** the stat is read for the damage calc at `578`. There is no
after-damage branch, and `grep targetSelf lib/game/combat.ts` returns no other
application site.

### B2. Why it is not cosmetic

Ruling **#22** exists because a self-buff *should* usually feed its own strike —
"buff first, hit boosted", Gon's Jajanken Rock. That is right for the cards it
was written for and wrong as a universal.

Where the difference is load-bearing:

- **The skill scales off the stat being raised.** A self-DEF buff on a DEF-scaled
  attack boosts its own damage. `mustafa`'s **Tea Time Tremor** is exactly that
  shape and already ships — DEF-scaled, with a `targetSelf` DEF buff.
- **Anything reading the caster's stats during the action** — counters (#17),
  lifesteal off dealt damage, damage-dealt modifiers (#36).

So authoring the Dokkan card above on a DEF scaler produces a **stronger card
than the draft describes**, silently. Nothing errors; the number is just bigger.

Where it is genuinely cosmetic: a DEF buff on an ATK-scaled skill. Same result
either way for that hit. Most cards fall here, which is why the gap has gone
unnoticed.

### B3. The description side is blocked on it too

Clause order **is** resolution order — that is the premise #75 reads the
tanked-hit rule off. So a self-buff clause written after the damage clause is
not merely mis-ordered prose: it sits in the position that means "nullified by a
tanked hit", which is a target-facing rule that does not apply to the caster.

Until this ships, `kitwords` instructs the author to put the self-buff first and
**say so in the reply** when a draft ordered it otherwise, rather than shipping
the stronger reading.

### B4. Proposed shape

A flag on the mechanic — name TBD, `afterDamage?: boolean` is the obvious one —
that moves its application from the pre-damage loop to a post-damage pass.

1. Split the loop at `556` into two passes over `skillMechanics`: the existing
   pre-damage one (default, preserving #22) and a new post-damage one for flagged
   entries.
2. The post-damage pass runs **after** the target loop completes, and is
   **gated on damage having been dealt** — see §5. It needs the target loop to
   report back whether anything actually connected, which the loop does not
   currently do for the caller: `dealtDamage` is per-target and local to it.
3. **Default is unflagged**, so all 27 kits keep #22 behaviour and no test moves.

**Deliberately not proposed:** inferring the order from clause position in the
description. The description is authored prose and the mechanics are a flat
array with no link between them — `tests/passiveDescriptionSync.test.ts` shows
how loose that coupling already is. Inferring engine behaviour from text would
make a wording edit a balance change.

### B5. Settled — no damage, no buff

**A nulled or evaded hit does not activate the buff.** Tanveer, 2026-08-20:
*"the nulled or evasion from enemy will not activate the self buff for the
caster."*

This is what makes the feature more than reordering: the buff is **conditional on
connecting**, which is exactly the distinction his original sentence drew —
*"damage needs to be done to enemy first before the self buff activates."*

Consequences to build against:

- A fully-nulled hit reads "Tanked" (#71) and the caster gains nothing.
- An evaded attack returns before the mechanics loop (`combat.ts:793`), so it
  already contributes nothing — the buff must not be applied outside that path.
- A hit that kills the target still counts: damage was dealt.

**Name it for the condition, not the position.** `afterDamage` describes when it
runs and hides why; something like `onDamageDealt` or `requiresDamage` says what
it means. (Note `onDamageDealt` already exists as a *passive trigger* in
`types/passive.ts` — reuse the word carefully or pick another.)

### Settled — one connection arms it, once

Tanveer, 2026-08-20: *"as long as atleast 1 enemy is hit, the self buff would
activate. but multiple instances of enemy hit by same attack wouldn't cause
multiple self buffs activating."*

So on an AoE: **any single target taking damage arms the buff, and it applies
exactly once** no matter how many connected.

**This dictates the implementation.** The obvious placement — applying the buff
inside the target loop where the other mechanics live — would push one buff entry
per enemy hit, giving a three-target AoE triple the intended magnitude. It must
be:

1. During the target loop, record a single boolean: did *any* target take damage.
   The loop already computes `dealtDamage` per target but keeps it local, so this
   needs hoisting.
2. After the loop, if that boolean is true, apply each flagged self-buff **once**.

**Do not lean on `unstackable` to paper over this.** That flag exists for a
different purpose (a kit deciding its own buff shouldn't stack with itself), and
using it here would hide the structural mistake while changing semantics for any
kit that legitimately wants stacking elsewhere.

## B6. Verification

- A DEF-scaled skill with a flagged self-buff deals **less** damage than the same
  skill unflagged — that difference is the whole feature.
- An unflagged self-buff still applies before the damage calc, on every shipped
  kit (Gon's Jajanken Rock and Mustafa's Tea Time Tremor are the sharp cases).
- A flagged buff does **not** land when the hit is tanked or evaded, and does land
  on a hit that connects — including one that kills the target.
- **An AoE hitting three enemies applies the buff once, not three times**, and
  still applies it when only one of the three connects. This is the assertion
  most likely to catch a wrong implementation.
- `npm run check` — baseline **1,235 passing / 98 files** as of 2026-08-20.
- Build with `NEXT_DIST_DIR`. **:3000 is his dev server — never start or kill one.**

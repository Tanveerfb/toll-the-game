---
name: kitwords
description: Translate one of Tanveer's kit drafts into player-facing skill and passive descriptions, in the game's established voice — clause order, tier words, durations, placeholders, passive markdown. Use whenever a new kit arrives, a description reads oddly, a mechanic is added to an existing skill, or he says "/kitwords", "write the description for this", "does this card text read right". Writes text only; never invents a mechanic, a number or a skill name.
---

# kitwords

Turns a kit draft into the words a player reads on a card. The mechanics are
his; the **wording is a translation of them**, and it has a grammar this project
has spent months settling. Getting it wrong is how a card ends up claiming
something the engine doesn't do.

**Companion skill:** `kitcheck` audits an existing kit against the rulings. This
one *writes*. "Is this right?" is `kitcheck`; "how should this read?" is here.

## The boundary

- **Never invent a mechanic, a name or a number.** `AGENTS.md`: Tanveer owns
  skill names, mechanical effects and multipliers. If the draft is missing a
  value, ask — never pick one that "looks right".
- **Never name a mechanic the engine doesn't have** (ruling #65). Frost's
  Glacial Bind shipped reading *"Freezes them"* while the engine ran `stun`.
  His reason for wanting it enforced: *"don't want you inventing names and
  mechanics on your own. consulting me first is a must."* Write what the engine
  does today; if the concept needs a new mechanic, say so and stop.
- **The description never carries a number the data owns.** Use a placeholder.
  A literal number in prose drifts the first time he retunes.

## Where the truth lives

- `docs/design/KIT_DESIGN.md` **§5 (wording rules)** — read before writing.
- `lib/game/descriptionTranslator.ts` — the renderer. It wins every argument
  about what a sentence will actually look like; `buildDescriptionForRank` is
  what a player sees.
- `lib/game/mechanicGlossary.ts` — the vocabulary that becomes hover pills.
- `types/mechanic.ts` — `MechanicAudience` (`applyTo`) and `requiresDamage`, the
  two fields that decide who a clause names and where it sits in the sentence.
- `types/passive.ts` — `PassiveBlock`, the heading-per-condition shape passive
  markdown mirrors.
- `data/characters/*.json` — the shipped corpus, and the real style reference.
- `EXAMPLES.md`, beside this file — lines Tanveer has confirmed good or bad.
  **Read it every time; append whenever he rules on one.**

## Reading his draft

**Only values written `x/y/z` are rank-scaled** (ruling #58). Everything else is
flat unless he writes a note saying otherwise. Don't infer scaling from the
skill's type, from what a similar character does, or from it feeling like it
should ramp — author `valuePercent`, not `valueRanked`, unless the draft used
slashes.

Ultimates have no ranks. They ladder by **ult level** instead: six values
(`damageByUltLevel`, `*ByUltLevel`, ruling #92).

## The grammar

### Clause order is the mechanic order

Clauses render in resolution order, joined as prose. Order carries real meaning
— ruling #75 reads the tanked-hit rule straight off it: an effect written
*before* the damage clause still fires when the hit is nulled, one written
*after* does not. "Cancels buffs, does damage…, greatly lowers ATK" is a
statement about resolution, not a stylistic choice.

**A self-buff written after the damage clause needs `requiresDamage` on the
mechanic.** The default self-buff path runs **before** the damage calc (#22), so
a sentence reading "causes damage … and raises DEF" contradicts the engine
unless the mechanic declares `requiresDamage: true` — which also makes the buff
conditional on the hit connecting. Since clause order *is* resolution order,
that position carries #75's tanked-hit meaning too, and now the engine agrees
with it.

**This is a real difference, not punctuation.** Tanveer, 2026-08-20: *"damage
needs to be done to enemy first before the self buff activates. it is different
than buff first and then do damage."* Buff-first means the strike is already
boosted; buff-after means the hit lands unbuffed and the buff only matters
going forward. On a skill scaling off the stat being raised, that is the whole
card.

So: **match the clause order to the flag.** Buff first and no flag, or buff
after the damage clause and `requiresDamage` on the mechanic — never a draft
ordered one way and authored the other, which silently ships a stronger card
than the draft describes. On an AoE the flagged buff applies **once**, however
many enemies were struck.

**Author with semicolons; the game prints prose.** `joinClausesAsProse` turns
the survivors into "A and B" / "A, B and C". The semicolons exist so
`dropZeroValueClauses` can hide a whole clause — write "and" in the JSON and a
zero-valued placeholder takes the damage text out with it.

### Tier words are exact values, and they come from the number alone

**Which stat the effect targets is irrelevant** — a tier word is a function of
the number (Tanveer, 2026-08-19). And the scale is a set of **exact values, not
floors**:

| Direction | bare word | "greatly" | "massively" |
|---|---|---|---|
| Raising | **30** | **50** | **100** |
| Lowering | **30** | **50** | **80** |

The downward ceiling is lower on purpose: a stat can never be reduced to zero in
battle. Nothing between these numbers wears the word. His reason for refusing a
threshold reading (ruling #109):

> *"'raises' MUST be 30%. it can't fluctuate, even by 1%. If i allow it, next
> time you would propose 'greatly raises' to accept even 55%. Nope."*

**Never spend a tier word and state the number.** "Raises DEF by 30%" says it
twice — the tier word already *is* 30, and the hover pill reveals it (#26), so
the card ends up with a pill reading "Increases DEF by 30%" beside text that
already said so. Pick one form.

**An off-scale value is not forbidden — it is written differently.** Use
**"Increases / Decreases X by `[buff.value]`%"** and let the number show:

> Increases ATK and evade chance by `[buff.value]`% for `[buff.duration]` turns

Two consequences worth knowing:

- **The explicit form gets no hover pill**, and that is correct. A pill exists to
  reveal a number the tier word hides (#26); nothing is hidden here. `tierWord`
  returns undefined off-scale and `buildSkillKeywordGlossary` skips the entry.
- **Explicit percentages are self-checking; tier words are not.** Chiara's
  ultimate stated both its numbers for months and the mismatch between them was
  visible to anyone reading the card. The day it was converted to a tier word,
  one "Raises" swallowed a 30 and a 33, and it went unnoticed for months more.
  When in doubt between the two forms, the one that shows its numbers is the one
  that will catch a data error.

This subsumes the old ladder rule: a ladder cannot step *inside* one tier word if
every tier-worded value has to be exact. Chiara's Marked Card `[30,50,50]` steps
*between* words — lowers → greatly lowers — then extends the duration instead.

### One effect, one entry, one clause, one pill

Ruling #55: *"raises ATK and DEF"* is **one** buff covering both — authored
`stats: ["atk","def"]`, not two entries, and never `stat: "all"` (which sweeps
in HP and substats). One effect = one entry = one pill = one thing to cleanse.

Inverted, that is the trap: if two entries carry different values or different
durations, they are **two effects** and must not be written as one clause,
however neatly they would join.

Ruling #64 pushes the other way and is compatible: effects sharing a duration
*and* the same kind of thing share a clause — "seals Debuff and Attack Debuff
skills for 2 turns" rather than saying it twice. That merge happens at render
time, keyed on the resolved duration, never in the JSON.

### Who an effect hits, and where it sits in the sentence

**The default audience is the caster.** Tanveer, 2026-08-20: *"it wouldn't say
allies if the default is self only."* So a self-buff names no target at all —
the reader infers self precisely because no ally is mentioned.

| Audience | Reads as |
|---|---|
| the caster | *say nothing* |
| the caster's team, caster included | **allies** |
| the caster's team, caster excluded | **allies (excluding self)** |
| the opposing side | enemies / one enemy |

His rule verbatim: *"if it targets allies including the caster then only
'allies' otherwise 'allies (excluding self)'."*

**A self buff goes before the damage clause.** His example:

> Greatly raises ATK, increases DEF by 60% for 1 turn and …

That is #22 (a self-buff applies before the damage calc, so the same strike
benefits) showing up in the word order — and note the comma doing #110's work in
the same line: ATK is permanent, only DEF carries the 1 turn.

**`aoe` means all enemies on the field**, never "all allies" — *"AOE means it
targets all present enemies on the field. (sub enemy who's not on field yet
wouldn't count)."* A team-wide friendly effect says "allies"; it is not an AoE.

**Audiences are declared, not inferred** (shipped 2026-08-20). A mechanic
carries `applyTo` — `self` (the default, and what silence means), `oneAlly`,
`allies`, `alliesExceptSelf`, `enemies` — or `applyToRanked` for an audience
that widens with rank, the way Leorio's does. A card mixing three audiences
("raises own ATK, damages the enemy, raises allies' DEF") is authorable, so
write it plainly.

⚠️ **A friendly mechanic with no `applyTo` is a SELF mechanic**, not an ally
one. That is the inversion: before 2026-08-20 it inherited the skill's targets.
If a draft means allies, the JSON has to say so — flag a kit whose prose names
allies while the mechanic declares nothing.

### Say it once

- **Never restate a target the prose already names** (#63). Ally-facing skills
  name their target in the sentence, so no trailing "to all allies".
- **An after-effect on an AoE needs no "each"** (#62): an effect written after
  the attack always applies to every enemy hit. "depletes 3 ultimate gauge(s)",
  never "from each".
- **No "own"** — a raise always means the skill user (#26).
- **State every duration** (#65). Several skills once hid one that existed in
  the data.
- **A debuff must always carry a duration** (#110, 2026-08-20). Permanence is a
  buff-side idea only — there is no permanent debuff, and the schema rejects one.
  A source that ends "and lowers DEF" with no turn count needs the number asked
  for, not inferred.
- **DoT durations are derived, never authored** (#52). Ignite 3, Bleed 2 come
  from `dotDurations.ts` and the translator prints them, so prose can't drift.

### "No comma, no perma" — permanence is scope, not a word

Never write "Permanently" into a description. Ruling **#110**, his words:
*"we don't need 'permanently' in the description… players will notice this on
their own."*

**How the reader knows.** Clauses are authored with semicolons and rendered as
prose — two clauses join as "A and B", three or more as "A, B and C". So **a
comma in the rendered text is a clause boundary**, and a duration binds only the
clause it sits in. A stat change whose clause carries no duration is permanent,
and cancel-proof (#37).

Two sentences that look almost identical and are not the same skill:

| Written | Effects |
|---|---|
| Greatly raises ATK**,** greatly raises DEF **for 1 turn** and does X damage | **Two.** ATK permanent; the 1 turn reaches DEF only |
| Greatly raises ATK **and** DEF **for 1 turn** and does X damage | **One** entry, `stats:["atk","def"]`; both expire together |

**That is the whole warning.** Merge two stats into one clause when one of them
was meant to be permanent, and the trailing duration silently swallows it. The
comma is what protects a clause from the next clause's duration.

**It only bites when a duration is present.** Killua's ultimate reads "Raises ATK
and DEF and then does damage" — no comma, still permanent, because there is no
duration in the clause to swallow it. *Absence of a duration* is the signal; the
comma is scope.

**Never add "permanently" to a pill key either.** The glossary key is the bare
tier word. It used to carry a `permanently ` prefix, which would now fail to
match the text and cost every permanent buff its hover pill.

### Mechanics are verbs, not prose

"**lifesteals** 30% of damage dealt", "**extorts**", "**attack seals**" — the
glossary keys are what become hover pills, so use the word the glossary knows.
"recovers HP equal to" is prose and gets no pill.

**One pill per distinct effect** (#27) — phrase-level keys, not per-word.
Generic words like "stance" are not glossary keys.

## Reading a Dokkan card

Tanveer drafts against Dokkan and hands over its wording. His instruction,
2026-08-20: *"you can ignore what's not in our game pretty much. but learn from
how the dokkan words and frames the descriptions. that's the important part."*

So: **take the framing, drop the mechanics.** A clause naming something the
engine lacks gets flagged and left out (#65) — but the *shape* of the sentence is
the thing worth copying, because it is what he is used to reading.

What their framing has taught us so far:

- **The buff that feeds the hit sits next to the hit.** "Greatly raises DEF for 4
  turns, greatly raises ATK for 1 turn and causes immense damage" — the long
  defensive buff leads, the short ATK buff sits immediately before the damage
  because it is what the damage rides on. That matches #22 exactly, so our clause
  order (which *is* resolution order) already wants the same arrangement.
- **Durations are stated per effect, never shared by implication.** Where two
  buffs differ, they get separate clauses — which is #110 arriving at the same
  answer from the other direction.
- **Their damage tiers ("immense", "mega-colossal", "ultimate") are ATK
  multipliers, not mechanics.** They have no equivalent here and need none: our
  text never grades damage, the number lives in the data.
- **Audience is stated only when it is not the caster** — "to all enemies", "to
  allies (self excluded)". Silence means self, which is where our default came
  from.

## Placeholders — the authoring syntax

What keeps prose and data in sync. Never type a number the mechanic holds.

| Form | Renders as | Use for |
|---|---|---|
| `[stun.duration]`, `[debuff.duration]`, `[seal.duration]` | that mechanic's duration | any "for N turns" |
| `[buff.value]`, `[extort.value]`, `[lifesteal.valuePercent]` | the field's value at this rank | an explicit percentage |
| `[ignite.stacks]`, `[decay.stacks]` | stack counts | "applies N stacks" |
| `[x-ranked]`, `[y-ranked]` | first / second ranked ladder on the skill | two ladders in one description |
| `[x-ranked.duration]`, `[y-ranked.value]` | that positional mechanic's named field | **two mechanics of the same type** |
| `[debuff? greatly lowers : lowers]` | branches on whether that mechanic resolves | a clause whose wording changes by rank |
| `[aoeRanked? allies : one ally]` | branches on a rank-gated mechanic | a skill that becomes AoE at higher rank |

**Two mechanics of the same type are addressed by position, with a field.**
`[buff.duration]` resolves to the **first** buff on the skill, so a card raising
DEF for 4 turns and ATK for 1 rendered "4 turns" twice; bare `[x-ranked]` takes
no field and printed the stat percentage instead ("50 turns"). Since 2026-08-20
the positional form takes a field — `[x-ranked.duration]` — and that is what you
use. **Never write the duration literally** to work around it.

**A clause whose placeholder resolves to 0 is dropped whole** (#44) — a rank-1
Lightning Palm doesn't mention its stun; rank 2+ does. That is why each effect
needs its own semicolon clause.

## Passives are a different format

Passives are **markdown**, not a sentence — bullets under `#` headings, with
arrow emoji for direction:

```
# At the start of every turn, gain one of the following effects
- All enemies ATK 20% (down) for 2 turns
- All allies ATK 15% (up) and DEF 15% (up) for 1 turn
# At the start of turn 3
- Ranks up own cards in the deck by 1 level (Once only)
```

The real file uses the arrow emoji (U+1F446 up / U+1F447 down) where this page
writes "(up)" / "(down)" — copy the emoji from an existing kit rather than
retyping it.

- Headings are **conditions**; bullets are **what happens**.
- **Unconditional effects go under `# Basic effects`** — Tanveer, 2026-08-20:
  *"'always' block can be renamed to 'basic effects' block i guess. much more
  generalized but simple."* Use that heading verbatim; it is also what the
  archive prints for a block with no heading of its own. Don't leave an
  always-on effect as a bare leading bullet before the first heading.
- A passive is **one passive made of blocks**, each block a heading with its own
  trigger and mechanics. Several headings is normal, not a sign the kit should
  be split into two passives.
- Numbers are literal here — passives carry no placeholder system, which is
  exactly why `tests/passiveDescriptionSync.test.ts` exists: every "N%" in the
  prose must be backed by a real value in the mechanic data.
- The UI already renders an **Uncancellable** badge and a glossary footnote, so
  an inline "(Uncancellable)" on a single-line passive is a duplicate (#65).
- `[Bracketed Terms]` are stack and tag names (`[Flowing Ruin]`, `[Collab]`) —
  kit-local vocabulary, not glossary keys.

## Editing the JSON

**Never round-trip a kit file through a JSON parser.** `json.load` then
`json.dumps(indent=2)` reformats every inline array in the file — `isolde.json`
produced **60 changed lines for a 4-line edit** that way on 2026-08-20, burying
the real change and churning a file nobody meant to touch.

The kits mix styles deliberately: short arrays sit inline
(`"tags": ["Fairy", "Female", "Bureau"]`, `"damageRanked": [20, 25, 30]`) while
`stats` and `mechanics` are multi-line. A dump normalises all of it.

**Use targeted text replacement** on the exact strings being changed, and assert
each appears exactly once before replacing. If a file has already been churned,
recover it with `git show HEAD:<path>` and re-apply the edits to that, rather than
hand-reverting the formatting.

## Working with him

1. **Read `EXAMPLES.md` first**, then `KIT_DESIGN.md` §5.
2. **Draft the line, then render it** — run it through `buildDescriptionForRank`
   rather than trusting the source string. A raw description still holds its
   placeholders, and half of these rules only show up rendered.
3. **Show him every rank, not just R1.** Rank differences are where wording
   breaks — a dropped clause, a tier word that stops being true.
4. **Name any judgement call and its alternative.** He decides, and he can only
   decide what he is shown.
5. **When he rules, append it to `EXAMPLES.md`** — the confirmed line, the
   rejected one, and *why*. That file is the point of this skill: it is why the
   next kit doesn't re-litigate this one.

## Verification

- `npx vitest run tests/kitDescriptionRules.test.ts` — unbuilt mechanics, the
  tier-word ladder rule, one-pill-per-effect across every shipped description at
  all three ranks.
- `tests/descriptionTranslator.test.ts` — the renderer's own behaviour.
- `tests/passiveDescriptionSync.test.ts` — passive prose numbers vs mechanic data.
- Then `npm run check`.

## Finish

Give him the rendered text **per rank**, the placeholders used, any rule that
forced a wording, and any question the draft left open. Then stop — the wording
is confirmed by him, not by the tests passing.

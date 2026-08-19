# Confirmed card text

Lines Tanveer has ruled on. The `kitwords` skill reads this before writing
anything, and appends to it every time he confirms or rejects a wording.

**This file is the whole point of the skill.** The rules in `SKILL.md` are
general; these are the judgement calls, which is where the arguments actually
happen. A rejected line with its reason is worth more than a confirmed one.

Status vocabulary: `confirmed` · `rejected` · `open`.

---

## Open — awaiting his ruling

*(none right now)*

---

## Confirmed

### Chiara — All In (ultimate) — `confirmed 2026-08-19`

The case that produced ruling **#109**. Worth reading in full before writing any
description that carries a number.

**Shipped now:**

> Increases ATK and evade chance by `[buff.value]`% for `[buff.duration]` turns;
> then does damage equal to ATK-scaled to all enemies.

Data: **one** entry — `buff stats:["atk","evade"] valuePercent:33 duration:3 targetSelf`.

**What was wrong before:** the text read *"Raises ATK and evade chance for 3
turns"* over **two** entries at **two different values** — ATK 30, evade 33.
Tanveer: *"chiara's ult description is not correct and that was stinging me for
the longest time."*

Three faults in one sentence:

1. **One tier word over two magnitudes.** A tier word names one exact number; it
   cannot honestly cover 30 and 33 at once.
2. **One clause implied one effect**, but two entries meant two pills and two
   separate things to cleanse — a buff-cancel could strip one and leave the
   other while the card said they were one thing (#55, #27).
3. **The quantities were different kinds.** ATK 30% multiplies; evade 33% adds 33
   points of dodge to a 0% base (#55). One verb claimed they were comparable.

**How it was found and fixed.** He said he had always intended both at 33.
`git log --follow` showed ATK entered the repo as **30 in the kit's very first
commit** and was never 33 — so the drift happened when the draft was first
translated, not in a later balance pass. The original text stated both numbers
explicitly, which made the mismatch visible; `dcd1700` converted it to a tier
word and one "Raises" buried it.

Merging into a single entry is sound because `substats.ts` and `stats.ts` share
`entryAffectsStat`, so one entry multiplies the basic stat and adds points to the
substat, each correctly.

**The rule that came out of it** (#109): tier words are **exact values**, never
thresholds — *"'raises' MUST be 30%. it can't fluctuate, even by 1%. If i allow
it, next time you would propose 'greatly raises' to accept even 55%. Nope."*
Anything off the scale is written **"Increases/Decreases X by N%"**.

**The transferable lesson:** *explicit percentages are self-checking; tier words
are not.* Given a choice between the two forms, the one that shows its numbers is
the one that will catch a data error.



### Isolde — Starbound Ward (ultimate) — `confirmed 2026-08-19`

**The reference for an ultimate that ladders by ult level**, and for a clause
that has to vanish below a gate.

> `[debuffImmunity? Grants all allies Debuff Immunity and increases their basic stats : Increases all allies' basic stats] by [buff.value]% for [buff.duration] turns.`

Renders, level by level:

| UL | Rendered |
|---:|:---|
| 1–2 | Increases all allies' basic stats by 20% for 2 turns. |
| 3–4 | Grants all allies Debuff Immunity and increases their basic stats by 30% for 2 turns. |
| 5 | …by 50% for 2 turns. |
| 6 | …by 50% for 3 turns. |

**What was wrong before.** The description was a single static line —
*"Grants all allies Debuff Immunity and raises their basic stats for
`[buff.duration]` turns."* — while the data laddered underneath it. Two defects:

1. **It promised Debuff Immunity at UL1 and UL2**, where `minUltLevel: 3` grants
   none. The card lied at exactly the two levels every new player has.
2. **"raises" is the 30-word**, but the upper levels ran 50. Under #109 that is a
   straight violation.

Of the three things that laddered — clause, value, duration — **only duration
rendered**. The authored ladder was invisible on the card.

**Three techniques worth copying:**

- **A gated mechanic needs a conditional, not a dropped clause.**
  `dropZeroValueClauses` (#44) hides a clause whose placeholder resolves to
  **0** — but `resolveUltLevelLadders` *removes* a mechanic below its
  `minUltLevel` entirely, so there is no 0 to find and the placeholder would
  render literally. `[debuffImmunity? A : B]` is the right tool: it branches on
  the mechanic being **present**.
- **Write both branches to name the target.** Ruling #63's guard appends "to all
  allies" to any ally-facing skill that doesn't state its own target — so *each*
  branch has to say "allies", or the fallback branch grows a doubled target that
  the other one doesn't. Pinned in `tests/allyTargeting.test.ts`, which now
  asserts both branches.
- **Explicit percentages, on his instruction:** *"her basic stat buff amount can
  be changed to non tier word system. allowing me to buff the value more
  precisely across ult levels too."* Same reasoning as Leorio — a ladder that
  wants values off the 30/50/100 grid cannot wear a tier word (#109).

**Numbers live in the JSON, not here.** `data/characters/isolde.json` is the
source of truth for the ladder; this entry records the *shape* and the wording.

### "No comma, no perma" — `confirmed 2026-08-19`

His test case. What is the difference between these two?

> **A** — Greatly raises ATK, greatly raises DEF for 1 turn and does X damage
> **B** — Greatly raises ATK and DEF for 1 turn and does X damage

**A is two effects; B is one.** The comma is a clause boundary, so A's "for 1
turn" reaches DEF only and the ATK raise — sitting in a clause with no duration —
is **permanent** and cancel-proof (#37). B is a single entry,
`stats: ["atk","def"]`, both expiring together.

Authored with semicolons; `joinClausesAsProse` renders two clauses as "A and B"
and three or more as "A, B and C", which is where the comma comes from.

**The trap the mnemonic names:** merging two stats into one clause when one was
meant to be permanent. The duration at the end swallows it, and nothing in the
text or the data complains.

**The two shipped cases** (the only undurationed stat changes in the roster):

| Kit | Renders | Why |
|---|---|---|
| Gon, Jajanken Combo | Raises ATK, greatly raises DEF for 1 turn and then does damage… | Two entries, only DEF durationed |
| Killua, Speed of Lightning | Raises ATK and DEF and then does damage… | One entry, no duration at all |

**Killua is the case that breaks a naive reading of the mnemonic** — no comma,
and still permanent. The "no perma" half only applies when there *is* a duration
in the clause to swallow it.

**Pills.** Gon's ultimate produces exactly two, and neither mentions duration —
that is the description's job (#26):

| Pill | Says |
|---|---|
| Raises ATK | Increases ATK by 30% |
| greatly raises DEF | Increases DEF by 50% |

They share a substring, and that is correct: different positions, and
`extractKeywordFootnotes` matches longest-first without overlapping, so one span
can never yield two pills. Do not "fix" it.

### The conditional tier word — `confirmed`

Chiara, Marked Card:

> Does damage equal to ATK-scaled to one enemy; [debuff? greatly lowers : lowers]
> DEF for [debuff.duration] turns.

`valueRanked [30,50,50]`, `ranks [false,true,true]`. R1 reads "lowers" (30%),
R2 "greatly lowers" (50%), R3 keeps "greatly" and extends the duration instead.

Confirmed 2026-08-09 as the reference for a ladder that steps *between* tier
words. His stated alternative for R3 was "massively lowers DEF for 1 turn" — a
further tier step rather than a duration step. Both are legal; a ladder *inside*
one word is not.

### Explicit percentages instead of a tier word — `confirmed`

Leorio, Member of the Zodiac: `valueRanked [20,30,50]`, description says
"increases their ATK and DEF" with the numbers stated.

Confirmed: support skills state explicit `x/y/z` numbers so a rarer card buffs
allies harder, while attack skills carry flat tier-worded self-buffs (#58).
Spending no tier word exempts the ladder from the tier rules entirely.

### Attack seal wording — `confirmed`

> does damage equal to X and **attack seals** for N turns

Confirmed 2026-08-10. Chiara is **not** the model — she seals Debuff and Attack
Debuff *skills*, a different mechanic. Fixed on Diane's Rush Rock and Molvarr's
Sunken Verdict.

### Mechanics as verbs — `confirmed`

> **lifesteals** 30% of damage dealt

Confirmed 2026-08-10, same for "extorts". The glossary key is what becomes the
hover pill, so prose like "recovers HP equal to" silently loses it.

---

## Rejected

### "Freezes them for 1 turn" — `rejected`

Frost, Glacial Bind. The engine ran `stun`; [Freeze] is a future mechanic (#75
rules it a stun variant, unbuilt). Rewritten to "stuns".

Now enforced — `tests/kitDescriptionRules.test.ts` holds a list of named-but-
unbuilt mechanics and fails if a description or the glossary uses one.

### "…for 2 turns. to all allies" — `rejected`

Isolde, Starbound Ward. The guard in `ensureTargetText` only matched enemy
phrasings, so it appended a target the ally-facing prose had already named
(#63). A description says its target once.

### "depletes 3 ultimate gauge from each" — `rejected`

Isolde, Severed Ledger. An effect written after the attack always applies to
every enemy hit, so "each" is noise (#62). Tanveer, verbatim: *"when an effect
happens after the attack, it is always assumed the effect will apply to all
attacked enemies."*

### "seals Debuff skills for 2 turns; seals Attack Debuff skills for 2 turns" — `rejected`

One idea written twice. Merged at render time when the resolved durations match:
"seals Debuff and Attack Debuff skills for 2 turns" (#64). Chiara's R2 runs the
two categories on different ladders and must stay unmerged, which is why the
merge is keyed on the resolved value rather than done in the JSON.

### Inline "(Uncancellable)" on a single-line passive — `rejected`

Isolde, Woven Blessing. The UI already renders the badge; the inline note was a
duplicate (#65).

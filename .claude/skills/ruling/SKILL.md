---
name: ruling
description: Record one of Tanveer's design decisions into the numbered ledger in docs/HANDOFF.md, correctly — next number, his own words, supersede links on whatever it replaces, and propagation to AGENTS.md when the rule governs how work is done. Use when he settles a question, corrects a mechanic, states a preference, reverses an earlier call, or says "/ruling", "record that", "add that to the ledger", "that's a ruling". Also use when reading the ledger to answer a question, so a stale entry gets caught instead of quoted.
---

# ruling

The ledger in [`docs/HANDOFF.md`](../../../docs/HANDOFF.md) is the reason a design
question gets settled once. Its value is entirely in being trustworthy — a ledger
with one wrong entry has to be checked against the code every time, which is the
same as not having a ledger.

## Where the truth lives

- `docs/HANDOFF.md` — the ledger itself, under `## Design Rulings Ledger`.
  **Highest number as of 2026-08-19 is 108.** Read the actual tail before
  numbering; don't trust that figure.
- `data/characters/*.json` — the **numbers**. The ledger
  does not own them and must not restate them (see the guard below).
- `AGENTS.md` — auto-loaded by every session. Where a working-style rule goes if
  it must survive a session that never opens `HANDOFF.md`.

## Do this first

1. **Grep the ledger for the topic**, not just the keyword — the same rule often
   has an entry under a different name. Extort has four entries; story rewards
   have five. You are looking for what this new ruling *changes*.
2. **Read the entries you found, in full.** A ruling that amends another is
   written very differently from one that stands alone.
3. **Get the number** from the tail of the ledger, not from memory.

## Writing the entry

```markdown
N. **<Short claim, stated as a fact>** (YYYY-MM-DD). *"<his words, verbatim>"*
   <What it means concretely, and what changes because of it.>
```

- **Quote him.** The reason the ledger can't be re-litigated is that it carries
  his phrasing, not a paraphrase of it. If the decision came out over several
  messages, quote the sentence that actually settles it.
- **A picked option is NOT a quote** (learned 2026-08-21, twice, on #118 and
  #119). When the decision came from `AskUserQuestion`, the words in the option
  are *yours* — you wrote them. Dropping them between quote marks manufactures a
  sentence he never said, in the one document whose whole value is that it
  can't be re-litigated. Write it as a selection instead:

  > Offered three scopes — report only, cheap fixes, or fold it in — he chose
  > **fold it in**: *"treat battle as just another screen in this pass."*
  > **That phrasing is an option label he selected, not prose he wrote.**

  The decision is just as binding either way. What changes is that a later
  session can tell which words are his, which matters the moment one of them
  looks wrong.

  **This holds even when he types the option back at you** (2026-09-01). He
  answered a mockup by sending two lines — `* Option B — bottom tabs
  (recommended)` and `* Option A — one Filters sheet (recommended)`. That
  arrives as a user message, in his voice, and it is still **your** text
  echoed: you wrote those labels. #123 and #124 record them as selections.
  The tell is the word *(recommended)* — he does not recommend things to
  himself.

  **And it holds for a mockup he picks from** (2026-09-17, ruling #144 made this
  the normal way a redesign starts). *"Go with B"* and *"option C ... I think it
  offers the best of both worlds"* are **selections of headings you wrote into
  an HTML file**, so they are recorded the same way — see #147 and #145. This is
  now the **most common** channel for a design decision, not a rare one, because
  every redesign begins with two or three drawn options.

  **What IS his, in a mockup review, is the reasoning he volunteers while
  rejecting one.** #145 exists because he did not merely pick C — he said *"a
  lot of people play it conservatively ... they are very conservative with their
  resources"*, which is a rule about players that outlived the option it killed.
  **Quote that half; mark the pick as a selection.** A review that produces only
  a letter has given you one binding decision and no reasoning; a review like
  that one gives you both, and the ledger should carry them differently.
- **Bold claim first.** A reader scanning 108 entries reads bold text only.
- **Say what it changes.** An entry that records a decision without naming the
  file, mechanic or screen it governs makes the next session guess.
- **Date it.** Every entry carries the date it was made; several rulings are only
  intelligible against what was true that week.

## The guard: intent, not numbers

The ledger's own header says it, and it is there because of ruling #5 — Duke's
Flowing Ruin sat in the ledger at 50%/20% for a month after a balance pass moved
it to 100%/50%, and a story fight was then planned against the stale figure,
under-estimating his burst by half.

**Record semantics and intent. Point at the data for values.** "Extort recasts
overwrite, never stack" belongs here. "Extort steals 50%" does not — that number
lives in the kit JSON and will move without anyone thinking to update prose.

When a ruling genuinely fixes a number (a stat band, a budget, a cap), say where
the authoritative copy is in the same sentence.

## Supersede links, both directions

The single most damaging failure here is a one-directional link. #108 supersedes
#94 and #98–#105; a reader landing on #101 needs to learn that from #101.

- New entry names what it replaces: `supersedes #94 and #98–#105`, `amends #26`,
  `replaces the tick semantics of #21`, `closes old STATUS #16`.
- **Go back and edit the old entry too**, adding `**Superseded by #N (date).**`
  at its head. Do not delete it — a retired ruling explains why the code once
  looked the way it did.
- A ruling that *partially* survives says which half. #94's team-agency modes
  survived #108; its chapter structure did not.

## Your inference is not his ruling — mark the seam

An entry is usually **his words plus your synthesis**: he settles a point, you
work out what it means for the code and write both down. That is the job. The
failure is letting the two wear the same authority, because a later session
reads the whole entry as settled and cannot tell which half to doubt.

**Ruling #137 is the worked example, and it lasted about three hours.** He
distinguished a *fight* from a *phase*; the entry then added a summary line —
*"a wave changes how many enemies there are; a phase changes what one enemy
is"* — which was **Claude's formulation, not his**, and was **wrong**. He
restated the whole vocabulary later the same day: a phase is *any* transition
to a new state inside one fight, including a new set of enemies, and "wave"
is not a term the game uses at all. The quotes in #137 were accurate. The
sentence that did the damage was the one nobody had said.

**So, inside an entry:**

- Quoted text is his, verbatim, and nothing else goes in quote marks.
- A conclusion drawn from his words says so — *"so the working reading is…"*,
  *"which implies…"*, *"flagged to him as an inference"* — and is a separate
  sentence from the quote it follows.
- **A crisp aphorism summarising his position is the most dangerous shape of
  all**, because it is the line that gets quoted onward. If you write one,
  either get him to confirm it or label it as yours.

**When he corrects an entry, correct it in place and say what it used to
claim.** #137 now carries its own wrong table under a CORRECTED heading rather
than a clean replacement — a future session meeting the old distinction
elsewhere has to be able to recognise it as retired. That is the same rule the
ledger already applies to superseded entries; it applies within an entry too.

## Evidence that is not his

A ruling often rests on something outside this project — a reference game, a
competitor's wording, a screenshot. **Say how much evidence it rests on**, in
the entry, in a clause. "From one card" and "from nine, of two different eras"
are different claims and a later session cannot tell them apart from a
confident sentence.

Ruling #134 is the worked example, and it went wrong twice:

1. Written from **one** 7DS screenshot and stated as that game's rule.
2. Corrected at **nine** cards — five led with the duration, four trailed it —
   to "the reference is inconsistent". **That was worse than the first error.**
   Averaging a mixed sample destroyed a real convention.
3. Corrected again when Tanveer supplied what actually separated them: *"7ds is
   a old game now. The newer units have a better record of being consistent…
   gilthunder and allioni are very old units."* The leading form is their
   current standard; the four outliers are legacy text.

**The transferable rule: when a reference contradicts itself, check whether the
contradiction is chronological before concluding there is no rule.** A live
product's old content is its own archaeology. And a small sample that produces
a confident rule is more dangerous than no sample, because it reads identical
to a well-founded one in the ledger.

## Propagation

Decide deliberately, and say which you chose:

| Kind of ruling | Goes where |
|---|---|
| Engine semantics, mechanic behaviour, kit wording | Ledger only |
| **How work is done** — mobile-first, filler approval, who owns what, verification ritual | Ledger **and** `AGENTS.md` |
| A durable preference about working with him | Ledger, `AGENTS.md` if procedural, **and** session memory |

`AGENTS.md` is loaded automatically; `HANDOFF.md` is loaded when someone reads it.
A rule that must never be missed cannot live only in the second.

## When the ledger is wrong

If you are reading the ledger to answer a question and the code disagrees with an
entry: **the code wins, and the disagreement is itself a finding.** Say so to
Tanveer, name both values, and offer to correct the entry with a dated note about
what it used to claim — the same way #5 carries its own correction. Never quietly
fix it; a silent edit destroys the record of what a past session may have been
working from.

## Finish

Tell him: the number assigned, what it supersedes or amends, whether it also went
into `AGENTS.md`, and — if you edited an older entry — which one and how.

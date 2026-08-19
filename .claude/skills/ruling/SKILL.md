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
- `data/characters/*.json`, `data/story/*.json` — the **numbers**. The ledger
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

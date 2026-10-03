---
name: relay
description: Use at the START of a work session to pick up where the last one left off — e.g. "relay", "relay max", "catch me up", "where were we", "resume the project", "what was I doing", "pick up from the handoff". The inverse of the checkpoint skill: checkpoint writes the handoff, relay loads it AND verifies it still describes the repo before any work starts. "MAX" means claim-by-claim verification plus a fresh test/build baseline. Goal: start with a true picture, not a confident stale one.
---

# Relay

The baton half of `checkpoint`. Checkpoint's job is to write the record; relay's
job is to **load it and distrust it**.

## The thesis

Checkpoint MAX exists because *artifacts beat memory*. Relay exists because
**the repo beats the handoff**.

A handoff is a snapshot, and it starts decaying the moment it's written:
commits land, the user edits files by hand, branches move, another agent runs.
The failure this skill prevents is an agent reading a confident document,
believing it, and building three hours of work on a claim that stopped being
true last week.

Real examples of what that looks like:

- A handoff names a commit. That commit was rebased away, or isn't an ancestor
  of HEAD any more.
- A status doc says a store is at schema `v7`. It shipped `v8` two sessions ago
  and nobody updated the note.
- A status doc says a feature "works". It does not — that line was written from
  intent, not verification, and it survived because nobody checked.
- The handoff's stated next step is **already done**, so a fresh agent does it
  twice.
- The working tree has uncommitted changes the previous agent did not write —
  the user edited something by hand and it is sitting there unexplained.

Relay's output is not a summary. It is an **orientation plus a staleness list**.

## Invocation modes

One dial: depth.

| Phrase | Depth |
| --- | --- |
| `relay`, `catch me up`, `where were we` | Standard. Steps 1–5. |
| **`relay MAX`**, **`relay max`** | **Exhaustive.** Steps 1–5 *plus* the MAX protocol, which is mandatory, not a suggestion. |

## Before you start: check what's already loaded

**Do not re-read what the harness already injected.** Many setups inject the
terse handoff and memory at session start — look in the context you already
have for a `=== HANDOFF ===`, `=== MEMORY ===`, or similar block, plus any
auto-loaded `CLAUDE.md` / `AGENTS.md` / `GEMINI.md`.

Re-reading those files is wasted tokens and, worse, makes the report look
thorough while adding nothing. Relay's value is in the layers that are **not**
auto-loaded: the deep doc (usually far too big to inject), the rulings/decisions
ledger, and git reality.

If nothing was injected, find the handoff yourself: `.remember/remember.md`,
`HANDOFF.md`, `NOTES.md`, or whatever the project uses.

## Step 1 — Orient from the handoff

Read the terse handoff (or the already-injected copy) and extract, explicitly:

- **The deep doc pointer** — checkpoint writes the handoff to name a doc and a
  section by path. That pointer is the whole reason the handoff is short.
- **The stated entry point** — the single next action.
- **The named commit**, if there is one.
- **Anything flagged as the agent's own invention** rather than the user's
  decision. Checkpoint MAX is supposed to record these; they are the highest-risk
  items in the document because they look authoritative and are not.

## Step 2 — Read the deep doc's most recent section

Go to the section the handoff names. Do not read the whole document — these
grow to thousands of lines and most of it is history. Read:

- the newest session section, end to end;
- any **"what was tried / declined / deferred"** section, which is what stops
  you re-treading a dead end or re-proposing something the user already
  rejected;
- any **"confidence and gaps"** section, which tells you which parts of the
  document to trust.

If the doc has no such sections, say so in the report — it means the previous
checkpoint was shallow and your picture is correspondingly weaker.

## Step 3 — Read the decisions/rulings ledger, if one exists

Most long-lived projects accumulate a numbered list of decisions ("don't
re-litigate these"). Read the **tail** — the most recent entries are the ones a
new session is most likely to violate, because they encode things that changed
recently.

## Step 4 — Check git reality

```bash
git status -sb
git log --oneline -5
```

Establish:

- **Is the tree clean?** Uncommitted changes at session start are a signal, not
  noise — find out whether they are the previous agent's unfinished work or the
  user's own edits.
- **Does the commit the handoff names still exist**, and is it an ancestor of
  HEAD? `git merge-base --is-ancestor <sha> HEAD`
- **What landed since?** If commits exist after the handoff's, the handoff
  describes a repo that has moved.
- **Are you on the branch the handoff assumed?**

## Step 5 — Report, then STOP

Report, in this order and briefly:

1. **Where things stand** — 2–4 lines, in your own words, not a quote of the
   handoff.
2. **The entry point**, and whether it is still valid.
3. **The staleness list** — every claim that no longer holds, with what it said
   and what is actually true. Empty is a fine and good answer; say so plainly.
4. **What is the user's call** — anything flagged as the previous agent's
   invention, plus any open question the previous session raised.

**Then stop and wait.** Do not start the entry point.

This is the deliberate design: a stale handoff usually means someone else worked
in the repo, and the user needs to know that before an agent acts on it. Ask for
the go-ahead. If the handoff turned out to be perfectly accurate and the entry
point is unambiguous, say so and ask once — that is a one-line confirmation, not
a ceremony.

## MAX protocol

Runs only for `relay MAX`. Standard mode reads and sanity-checks. MAX
**verifies**, and verification is the dial — not length.

**R1. Falsify every concrete claim, don't confirm it.** Take each specific
assertion from the handoff and the newest deep-doc section — file paths, symbol
names, config keys, version numbers, counts, "X is done", "Y works" — and check
it against the repo *now*. Read the file. Grep the symbol. Print the constant.
A claim you are confident about is exactly the one that has quietly rotted.

**R2. Establish today's baseline by running it.** Run whatever the project
actually uses — tests, typecheck, lint, build — and record the real output.
**Last session's green is not evidence today.** If someone edited code between
sessions, this is where you find out, at the start where it is cheap, rather
than at the end where it looks like you broke it. If verification cannot run,
record why; that is itself a finding.

**R3. Diff the world against the handoff.** `git log` and `git diff` from the
handoff's named commit to HEAD. Anything in that range is change the handoff
does not know about. Read it. Uncommitted changes get the same treatment, and
you must determine **who wrote them** — the previous agent's unfinished work and
the user's hand-edit call for opposite responses.

**R4. Check the entry point is actually unmet.** If the next step is "write file
X", check whether X exists. If it is "fix bug Y", check whether Y still
reproduces. Doing completed work again is the most expensive way this skill can
fail.

**R5. Separate verified from assumed in the report.** Anything you checked says
so. Anything you are carrying forward on the previous session's word says *that*.
Never let the two sit in the same voice — inheriting someone else's unverified
claim in a confident tone is how a wrong fact survives three sessions.

**R6. Name what you could not verify.** Visual output, runtime behaviour,
anything needing a browser or a human — list it explicitly as unverifiable
rather than silently skipping it.

## Common mistakes

- **Summarising the handoff back at the user.** They can read it. Relay earns
  its keep with the parts the handoff *can't* contain: whether it is still true.
- **Re-reading auto-injected files** to look thorough. Check context first.
- **Reading the entire deep doc.** It is mostly history by design. Newest
  section, negative-space section, confidence section.
- **Trusting the deep doc because it is detailed.** Detail and accuracy are
  unrelated. The most dangerous line in any status doc is a confident
  present-tense claim about something that works.
- **Starting the entry point immediately.** Relay ends in a report and a pause.
  Momentum is not the goal; a true picture is.
- **Skipping R2 because "nothing changed since last time".** You cannot know
  that until you have run it, and that is the entire point.
- **Reporting an empty staleness list as an absence.** Say "I checked N claims
  and all held" — that is a positive result and tells the user how much to trust
  what follows.
- **Treating MAX as more words.** A shorter report where every claim was checked
  beats a longer one padded with restated context.

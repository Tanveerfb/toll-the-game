# Decisions — toll-the-game

Why each non-obvious choice about **how this repo is run** was made. **Append
only.** A decision that turns out wrong gets a new entry reversing it, not an
edit: the wrong reasoning is the valuable part, because it is what stops the
same wrong idea arriving again in six weeks.

Required by [`project-rules.md`](./project-rules.md) §2. Started 2026-09-27,
when the repo adopted the fleet standard.

**What is not here, and where it is.**
- **Design rulings** (mechanics, kits, UI and UX direction, story) stay in the
  numbered ledger in [`docs/HANDOFF.md`](docs/HANDOFF.md). It predates this
  file, quotes him verbatim and is cited by number across the code and docs,
  so it keeps its job. This file holds the working and structural choices.
- **Earlier working choices** are recorded in [`AGENTS.md`](AGENTS.md) and in
  the ledger (#107, #119–#120, #139, #144, #153, #154 among them). They are
  not copied here; two copies drift.

**Quotes and selections.** Where he picked from options Claude wrote, the
entry says it was a selection. Those words are the option's, not his.

---

## 2026-09-27 — The repo adopts `project-rules.md` v2.4.0

**The adoption audit is done: [`conventions.md`](./conventions.md), audited
against v2.4.0.** It was queued when the rules were copied in on 2026-09-26
and he said to run it now: *"the conventions md pass ... say when now"*.

Following `E:\Projects\_COMMON\adopting-the-standard.md`: the audit changed no
code, and the four divergences that were his to decide were put to him as
questions with a recommendation. His answers are the four entries below. He
chose the fleet rule over the recommendation on three of the four.

---

## 2026-09-27 — The folder layout is queued for migration, not excepted

**No exception for the layout. The move is backlog.** Offered "Keep as is
(Recommended)" or "Queue a migration", he chose **Queue a migration**, a
selection.

What differs from §7–§8 and §24: no `src/`; a global `types/` directory (13
files); `store/` rather than `stores/`; React providers (`AuthProvider`,
`BattleProvider`, `MechanicProvider`) in `hooks/`; the zod schemas
(`lib/game/characterSchema.ts`, the one in `lib/game/orders.ts`) outside a
`schemas/` directory.

The recommendation was to keep it, because the move is a repo-wide rename
with no player-visible change. The case for his choice: the rules are the
fleet's, and a known divergence left excepted is one every future session has
to learn.

**How it is done, which is not decided yet.** `adopting-the-standard.md` §2
says convert on touch, but also sweep when a half-done job reads as a
mistake. A `src/` move and an `@/` alias change cannot be half done, so that
part is one sweep, scheduled with him. `types/` becomes `z.infer` from a
schema file by file, when a type is touched.

---

## 2026-09-27 — Decisions and status are split out of the old documents

**`decisions.md` is started for working choices, and `docs/STATUS.md` becomes
a short snapshot.** Offered "Keep both (Recommended)" or "Split them out", he
chose **Split them out**, a selection.

Before: `docs/STATUS.md` was 758 lines, a snapshot on top of a running feature
log and three session logs, and it also held the open issues, the not-built
list and the environment notes. §2 wants status to be "the current position
in a dozen lines", with issues, roadmap and environment as their own files.

Done the same day, each move verbatim:
- The "Working" feature log and the session logs of 2026-09-26c, 2026-09-26d
  and 2026-09-27 went to `docs/archive/STATUS-2026-09.md`.
- The folded-entry index went to `docs/archive/README.md`.
- Open issues went to `docs/issues.md`, numbering unchanged.
- "Not built yet" went to the end of `docs/ROADMAP.md`.
- The environment notes went to `docs/environment.md`, which now also lists
  every account and variable with its owner (§22, §26).

**Consequence for the `checkpoint` skill.** It writes a session log under a
`Start here` block. Here, a session's log goes straight into
`docs/archive/STATUS-YYYY-MM.md` and gets a line in `docs/archive/README.md`;
`docs/STATUS.md` keeps only `Start here` and "Confidence and gaps", rewritten
each time.

**Not covered:** the rulings ledger. It stays in `docs/HANDOFF.md`.

---

## 2026-09-27 — Rendered text follows sentence case; the uppercase is queued

**No exception for the motif's uppercase.** Offered "Exception for display
(Recommended)" or "Follow the standard", he chose **Follow the standard**, a
selection.

Today Shōnen Ink renders headings in Bangers and uppercases the micro-labels
with tracking (`docs/design-system.md`). The copy in the source is already
sentence case; CSS does the uppercasing. §13 asks for sentence case
throughout, buttons and table headers included.

Queued, not done. Two things to settle with him before any change:
- **The heading face.** Bangers is a display face drawn in capitals. Rendered
  sentence case needs either a face with real lowercase or headings that stay
  capitals by the font's nature. **Measure what Bangers draws for lowercase
  before proposing anything.**
- **It is a look change on every screen**, so it starts with mockups (#144).

---

## 2026-09-27 — Client-side authority is allowed until monetisation

**Exception granted, with an end date.** Offered "Allowed until monetisation
(Recommended)", "Queue it now" or "Permanent exception", he chose **Allowed
until monetisation**, a selection.

Everything with value is decided in the browser: gacha pulls, pity, rewards,
stamina, account XP, levelling and order claims (`store/playerStore.ts`). The
save syncs to Firestore, and `firestore.rules` lets a signed-in player write
anything into their own document. So a player can forge any of it, against
§11, §20 and §22.

It stands because the game has no player base (only Tanveer and Claude play),
nothing is bought, and nothing is compared between players.

**It ends before roadmap item 6 (monetisation) or any public launch,
whichever comes first.** By then, pulls, rewards and currency must be decided
server-side. The register of what is client-side is
[`docs/demo-shortcuts.md`](docs/demo-shortcuts.md) (§11), and it is that
phase's backlog.

**Not covered:** secrets. §22's rules on credentials apply in full; there are
none in the client, and the Firebase web config is public by design.

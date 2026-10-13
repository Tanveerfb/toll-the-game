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

---

## 2026-10-13 — The rules are synced to v3.4.0; the audit is not redone

**His ask, in a cloud session:** *"do the sync with the latest version of the
fleet standards."* The fleet standard now lives in `Tanveerfb/fleet-standards`
and ships as the `fleet` plugin; its `sync-standards` skill was followed.

Done: `project-rules.md` copied from the master at its latest commit
(`3022711`, v3.4.0); 55 numbered section references translated to v3 names
in `CLAUDE.md`, `AGENTS.md`, `conventions.md`, `docs/STATUS.md`,
`docs/issues.md`, `docs/environment.md`, `docs/demo-shortcuts.md` and
`docs/design-system.md`, with the map in the fleet `CHANGELOG.md`. **This
file's older entries keep their v2 numbers**: it is append-only, and the map
reads them. `conventions.md` keeps its "Audited against v2.4.0" line, because
copying is not auditing; it gains a first look at the v3-only sections.

Not done, and why:
- **`.claude/settings.json` was not written.** The session's permission
  classifier refused the edit as self-modification. The block the skill asks
  for (`extraKnownMarketplaces` for `tanveerfb`, `enabledPlugins`
  `fleet@tanveerfb`) is his to add; until then the local skill copies in
  `.claude/skills/` stay.
- **The v3 re-audit** is offered as separate work (`adopting-the-standard.md`
  section 1). Two real conflicts surfaced on the way and are questions, not
  changes: the `docs/STATUS.md` format (his 2026-09-27 split against §DOCS's
  two-zone file) and where mockups live (§OWNER against #144).

---

## 2026-10-13 — Shōnen Ink is up for replacement; three options are drawn

**His words:** *"I did choose Shonen Inc a while back for the home page but
it does not look good to me, I'll be honest here, I thought it would grow on
me but it did not. So we need something else, something else that looks a
bit more professional. Not too bold, but something that does the job. And we
may even change some of the layout if you need to."*

This is a redesign under §DESIGN, so it starts as mockups, not a build
(#144, §OWNER). Three options taking different positions are in
`theme-options.html (deleted 2026-10-13, ruling #188; in git history before 09f17fd)`, each on the same four screens at
390×844, with live tabs, selection, filters and a cost that recomputes:

- **A · Launcher** — Clean SaaS, dark product. The chrome disappears; the
  art is the colour.
- **B · Gallery** — Minimalist, soft minimal, light. Paper, white cards, a
  serif, a bento hub.
- **C · Ink wash** — Japandi, zen garden, built from the existing tokens:
  keeps the body face, the element hues and the dark ground; drops Bangers,
  the skew, the slab, the halftone and the yellow.

All three render sentence case (his 2026-09-27 call), keep the four tabs and
the 44px floor, and keep the five element hues for units only. Nothing is
locked; ruling #154 stands until he picks. The component round (§SHADCN)
follows the pick.

---

## 2026-10-13 — The three theme options were generic; the redesign is scoped to screens, not to a motif

**Reverses the framing of the entry above, same day.** He looked at the three
options and said what was wrong with the approach, not with a detail:
*"those are generic, I'll be honest with you."* The Characters page and the
bottom nav stay; Home, Events, Gacha, Profile and Settings change. Ruling
#185 carries his words.

What was wrong, in the working sense: the `design-motif` skill's Step 1 says
a project with a clear visual identity keeps it, and the motif was treated as
rejected wholesale because he said Shōnen Ink "did not grow on me". He meant
the screens it looks bad on. The lesson for the next redesign request:
**ask which screens work before drawing**, and draw the failing screens from
the language of the working ones. `theme-options.html` stays in the mockups
folder as the record of the options he rejected, per #144's convention.

## 2026-10-13 — Duke's LoRA is rebuilt on an action-bearing dataset, not finished on the 0.65 route

Ruling #186 settled that a dataset must carry action shots. Duke's v2 LoRA was
trained on a calm set and his kit sat at step 4 with official candidates
rendered through the 0.65 workaround. Offered the two routes, he chose the
rebuild: *"we will have to rebuild Duke's data set and then retrain the LoRa
because obviously that is no-no considering what we need for the game."* The
2026-10-08 candidates are superseded; the order of work is `docs/PC_SESSION.md`.

## 2026-10-13 — Which workflow suggestions he took

From the cleanup-and-skills session's list: **`newevent`, yes** (*"that is
something that I was already thinking in the back of my mind. So, yep, add
that in."*). **A `simcheck` skill, no**: *"when I say X currently has no
counter, it means that right now ... we will handle that in the future ...
it doesn't need to be in a workflow"*; #138 stays a ledger rule, not a skill.
**Generic draft and render scripts, yes** (read from speech-to-text; to be
confirmed in one line on the PC). **Area `CLAUDE.md` files, yes.** **The
`fleet` plugin**, he enables on the PC. **The save fix**, confirmed as
needed, not started. And a new document: `docs/PC_SESSION.md`, the ordered
list of work that needs his PC, written because he asked for *"a file
specifically targeting PC session ... so that it is a priority."* It deletes
itself when empty.

## 2026-10-13 — The save fix: when a write happens is a pure module

His go: *"what you can do in cloud session you can do it yeah you have my
yes and go ahead for those so save fix and the area claude files."* Issues
#28, #30 and #31 from the audit. The shape fix (#28) stores one key per
cleared team instead of an array of arrays, with a v11 migration, and the
guard walks the outgoing document in the tests rather than trusting the
patch logic. The timing fixes (#30, #31) were three rules tangled inside the
auth callback: nothing before the first read succeeds, one write per burst,
flush instead of drop. They now live in `lib/game/cloudSync.ts` as a
scheduler with fake-timer tests, and `AuthProvider` only wires it to
Firebase (§MODULES: business logic out of the component). A rejected write
was a console line; it is now a `cloudStatus` the profile page shows with
the shared `Alert`. **Where that note sits is his to move**; it is placed
under the account header because that is the screen the account lives on.
#29 (a stale device's whole snapshot wins) is deliberately left: it changes
what is written, not when, and wants `onSnapshot`. Not verified against a
real Firestore from the container.

## 2026-10-13 — A new character's art profile comes from a schema, not from Duke's file

His words: *"we have to make sure, like, we have a schema that Claude or
myself can use when drafting a new character. And so it doesn't have to be
using duke kit as base."* `scripts/lora/characters/profile.schema.json`
describes every key a profile carries and which script reads it;
`new_profile.py` writes a fresh one with the TODO fields the lock fills in
and a body-shot list that already carries the action shots #186 requires;
`check_profile.py` validates (no dependencies: `jsonschema` is not on his
PC) and warns when a set has too few actions, which every existing profile
now does on purpose. The existing profiles were not rewritten to the schema;
it is written loosely enough that they pass, and the checker's warnings say
where they fall short. If he also meant a schema for the kit JSON or a
template in `toll-kits`, that is a second job.

## 2026-10-13 — Area CLAUDE.md files, and the engine rules leave AGENTS.md

His yes to the suggestion. `lib/game/CLAUDE.md` holds the engine rules, the
simulator's limits and the save's three rules; `scripts/skill_art/CLAUDE.md`
holds that folder's traps and its registry rule. Each fact moved rather than
copied (§SCALE), and the root `AGENTS.md` keeps a pointer. The root file is
still long; the next candidates to move are the mobile rules (to
`components/CLAUDE.md`) and the kit-import block (to `data/characters/`),
not done because neither folder had a session touching it.

## 2026-10-13 — The collab units are deleted, and the mechanics they carried are kept

Ruling #187 has his words. The four choices the question tool put to him and
what each cost: **keep the mechanics** (Extort, Lifesteal, max-HP shred,
Deathblow, Detonate, Rupture, turn ramp, characterSynergy) rather than delete
them with the kits, so the engine keeps its vocabulary for a later kit and the
price is six neutral fixtures in `tests/fixtures/characters/` that exercise
them; **drop silently** from saves (v12 migration), because nobody paid for
them; **delete the Knuckle and Netero file in `toll-kits` from this cloud
session**, a push to that repo's `main` on his explicit pick; **keep the
KIT_DESIGN prose** that cites them as illustrations. The fixtures are not
kits: same numbers and mechanics, new names, card numbers in the sim
placeholder range, never in the catalog. `lib/game/removedCharacters.ts` is
append-only, because a pre-removal save can arrive from any device at any
time. Not asked and not done: the `Demon` and `Giant` tags remain valid tag
strings (tags are free text), and the DBZ brainstorm stays for later.

## 2026-10-13 — A kit starts from a template and a schema, not from another kit

His second reading of the schema line: *"I also meant the schema for the kit
JSON itself too, or a template."* The zod schema in `lib/game/characterSchema.ts`
was already the law; what was missing was a documented starting point, so
every new kit was a copy of the nearest shipped one. Three choices: the field
descriptions live in the zod schema (`.describe()`) and nowhere else, and the
JSON Schema file is generated from it with a drift test, because a hand-written
schema would have been a second source of truth; the template carries its
prose as `$comment` keys that `newkit` strips, so a kit never ships with
commentary; and `nextFreeCardNumber` never refills a gap, because a deleted
card number stays retired (#187). `newkit` writes `unreleased: true` and prints
the registration steps rather than editing `characterCatalog.ts` itself; the
registration test is the guard that catches a forgotten step.

## 2026-10-13 — His answers on the open decisions, in one pass

Asked for context on every open item, then answered them in a list. The
audit's Part 5: the theme stays open until he is on the PC (*"We'll see"*;
listed on the roadmap so it is not lost); starter gems to 500 as a playtest
value (#190); the repeatable gem source and the day-two hook, what leads the
hub while Orders is closed, and the Second Trial with Molvarr tiers 2 to 4 all
go to a **PvE content phase after the foundation** (*"Will plan PVE content
once we have the foundation and core stuff ready."*); sign-in over a guest
save asks **with the differences shown** (`docs/specs/save-conflict.md`, the
pure half built); practice stays ownership-free by design (#189).

The rules: STATUS format, mockup location and Trello as #188 records; Node 24,
read from the Vercel project rather than guessed.

The cleanup: `public/unreleased/` **kept** (*"Intentionally kept"*); the dev
duel tool **removed**; gsap **replaced** by the motion library the repo already
uses; the MDX news stack **removed**, the news page left as a static Coming
soon and its overhaul on the roadmap; `docs/design/characters/refs`
**kept** (*"Useful"*); knip's unused exports **removed**. Not removed from
knip's "unused files": `.claude/hooks/block-heredoc.mjs` (a hook, wired in
settings), `public/sw.js` (registered by a string, not an import),
`tests/stubs/next-image.tsx` (a vitest alias) and `scripts/capture-screens.mjs`
(a tool); knip cannot see any of those four uses.

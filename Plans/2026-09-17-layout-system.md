# A layout system for every screen except battle

**Status, 2026-09-17: steps 1-4 of the order at the bottom are BUILT.**
L4 (tracking), L1 (widths), L2 (`Screen`), L5 (`Panel`), L6 (`SectionHeader`)
and L7 (`RewardList`) all exist, and `app/events/` is the first screen moved
onto them. Twelve screens still hand-type a shell; `tests/layoutSystem.test.ts`
ratchets that number so it can only go down. **Still unbuilt: Q-a, Q-b, Q-c,
Q-d.**

Written because he opened the scope:
*"I am open to let you change all other pages other than battle UI. You can
start by proposing a consistent and QOL tuned layout and design choices that we
can adopt."* — and then, importantly: *"the game is meant to be mobile first."*

**Adopt or reject it section by section.** Each one is independent, each says
what it costs, and none of it is a rewrite — every piece is a component screens
move onto one at a time, the way the button primitive just went.

**Out of scope:** the battle screen (`BattleArena`, `Hand`, `Deck`, everything
under `components/game/battle/`). Its density is deliberately tuned and he can
only judge it with eyes on the screen.

---

## The spine: 390×844, and desktop is the same column

Ruling **#107**. Every number below is stated at **390px** first. Desktop
renders **the same column, centred, capped** — never a re-laid-out wide variant.

That makes one measured finding worse than it first looked.

### L1 — Ten content widths, and no rule for choosing one

`max-w-md` ×16 · `max-w-6xl` ×7 · `max-w-2xl` ×7 · `max-w-lg` ×4 ·
`max-w-3xl` ×3 · plus `xs`, `sm`, `xl`, `4xl`, `5xl`, `max-w-70`.

At 390px **every one of these is inert** — the viewport is narrower than all of
them, so the side gutter does the work and the screens look identical. They only
diverge on desktop, where `max-w-6xl` (1152px) and `max-w-md` (448px) are not
the same column at all. **That is the "re-laid-out wide variant" #107 rules
out**, arrived at by accident rather than by decision.

**Proposed: three widths, chosen by what the content is.**

| token | width | for |
| --- | --- | --- |
| `--col-read` | `42rem` | prose and documents — kit pages, news, patch notes |
| `--col-app` | `56rem` | boards and lists — events, archive, story, gacha |
| `--col-panel` | `28rem` | a single focused panel — results, modals, confirmations |

Three, because that is how many *kinds* of screen exist. Anything else is a
screen deciding it is special.

### L2 — Eight spellings of three page shells

```
terminal-grid min-screen-below-nav bg-void                    x11
terminal-grid flex min-screen-below-nav items-center …px-4     x4
terminal-grid screen-below-nav relative flex flex-col …        x2
terminal-grid relative flex screen-below-nav flex-col …        x2   <- same CSS
```

The last two are **identical CSS in a different word order**. Nothing catches
that, and nothing ever will by eye.

**Proposed: `<Screen>`, with three variants** — `scroll` (the default; one
vertical scroll, the tab bar cleared), `center` (a single panel centred, for
results and confirmations), `fixed` (full-height, no page scroll; the battle
screen's shape, kept so battle can adopt it later without inventing a fourth).

Precedent exists: `components/game/story/StoryStage.tsx` already does exactly
this for story, with `variant="page" | "stage"`. This generalises it rather than
inventing it.

### L3 — A spacing rhythm, not a sprawl

`px-3 py-2` ×34 · `px-3 py-2.5` ×17 · `px-5 py-4` ×10 · `px-4 py-6` ×10 ·
`px-4 py-3` ×10 · `px-3 py-1.5` ×8 · and on.

**Proposed: three densities**, carried by the `Panel` component below rather
than typed per usage — `tight` for list rows, `default` for panels, `roomy` for
a page's own header block. The 16px side gutter at 390px is fixed by #107 and
is the `Screen` component's job, not each panel's.

### L4 — Letter-spacing: 18 values, 364 uses (audit C2)

`0.18em` ×53 · `0.16em` ×48 · `0.14em` ×46 · `0.1em` ×34 · `0.12em` ×34 ·
`0.22em` ×32 · `0.2em` ×31 · then a tail down to single uses of `0.03em`.

The top six all do **one job** — the uppercase micro-label.

**Proposed: three steps**, matching the three jobs that actually exist.

| token | value | job |
| --- | --- | --- |
| `tracking-label` | `0.14em` | uppercase micro-labels — the common case |
| `tracking-title` | `0.08em` | heading-font display text |
| `tracking-wide` | `0.22em` | the rare eyebrow above a page title |

`0.14em` is proposed because **it is what the button primitive already uses**,
so the most-migrated component needs no change. **These three values are the one
thing here that is genuinely his** (ruling #139) — the structure is the
proposal; the numbers he can overrule and I will follow.

---

## Components the measurements ask for

### L5 — `Panel` (audit C3)

`border border-edge-strong bg-panel` typed by hand **15 times**, plus four
one-off surface variants. Props: `surface` (`panel` / `inset` / `raised`) and
`density` from L3.

### L6 — `SectionHeader`

The eyebrow-plus-title block that opens nearly every screen — a `text-[10px]`
uppercase `text-signal` line above a `font-heading` title — is retyped
everywhere, and it is where half of L4's tracking values live.

### L7 — `RewardList` (audit C6)

Reward rows are implemented **twice**: a tuple type plus three builders in
`app/events/page.tsx`, and a `RewardRows` component in `StageBrief.tsx`. A new
reward type has to be added in both, and the banked/claimed dimming already
exists in one and not the other. One component, taking
`{ id, label, amount | range, banked? }[]`. `ItemIcon` already centralises the
art side across 14 files, so only the row layout is duplicated.

---

## QOL — his definition, applied

*"Can a player find, narrow, order and understand what is on this screen?"*

### Q-a — `TeamPicker` gets search and sort (audit Q1)

It lists the **entire owned roster**, is opened **before every fight**, and has
neither — while the archive, which is browsed idly, has both. **The casual
screen is better equipped than the hot path**, and it degrades with every
banner.

At 390px this is a sheet, not a sidebar — the archive's filter sheet (#124) is
the precedent to copy rather than a new pattern to invent.

### Q-b — Every list screen gets a real empty state

`StageList` has no `length === 0` branch at all. The others mostly do. One
`EmptyState` component — a line saying what would be here and, where it exists,
the action that fills it.

### Q-c — Route-level error boundaries (audit Q4)

Eight routes, **none** with `error.tsx`. Only the root `app/error.tsx` exists,
so any throw takes out the whole shell rather than the screen that failed. At
least `events`, `story` and `gacha`.

`loading.tsx` is deliberately **not** proposed: state comes from localStorage
via Zustand, not server fetches, and `hasHydrated` is the real gate — already
fixed for the two pages that were missing it.

### Q-d — Bottom-pinned actions clear the tab bar

Already a rule (`bottom-[var(--tabbar-h)]`, pinned by
`tests/overlayStacking.test.ts`) after START and the launch bar were both
covered outright the day #123 shipped. Named here so `Screen`'s `fixed` variant
takes care of it structurally rather than each screen remembering.

---

## What this is worth, and what it costs

**Worth:** every screen stops deciding its own width, shell, rhythm and label
spacing — so a new screen inherits the system instead of copying the last one,
which is how all of the above happened. And each piece gets a guard, like the
44px floor (#119) and the button primitive have.

**Costs:** roughly 30 files touched, in independent passes. **Appearance will
shift slightly** wherever a screen currently sits off-system — mostly on
desktop, where the width zoo collapses to three. At 390px, which is the target,
**most screens should look unchanged**, because the widths were already inert
there.

**Suggested order**, each independently adoptable:

1. **L4 tracking tokens** — needs his three values, unlocks everything else.
2. **L5 `Panel`** + **L2 `Screen`** — the two with the most call sites.
3. **L1 widths**, applied through `Screen` so no screen states one again.
4. **L6 `SectionHeader`**, **L7 `RewardList`**.
5. **Q-a**, **Q-b**, **Q-c**.

**Verified in a browser, 2026-09-17**, at 375×812 against a scratch build on
:3210 (never his :3000). The events board, both briefs and a live trial fight
render correctly; entering the trial charges 30 stamina **once** for the whole
run, which is the behaviour the refactor was most likely to break.

Two things that check found, neither caused by this work:

1. `tests/touchTargets.test.ts`'s `title=` guard had **never run on the events
   page**. Its walk-back used `lastIndexOf("<")`, and `disabled={autoRuns < 1}`
   one line above the attribute meant the search landed on that `<` instead of
   the tag. The Auto Clear button's blocker message was hover-only the whole
   time. Guard fixed and falsified; the message is now visible text.
2. The brief announced a trial as **Standard** tier — `enemy?.tier === "elite"
   ? "Elite" : "Standard"` on an event that resolves no enemy — while the
   trial's last fight is Molvarr, who is elite.

**Still not verifiable by me:** whether any of it *looks* right. Geometry and
behaviour are pinned; taste is his pass.

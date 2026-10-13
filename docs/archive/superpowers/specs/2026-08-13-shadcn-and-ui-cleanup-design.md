# shadcn and the game UI — cleanup, and what to actually use it for

> Spec written 2026-08-13 after Tanveer asked whether shadcn had quietly stopped
> being used. Every number below was measured against the repo at commit
> `018e9d0`, not recalled.
>
> **Status: built the same day.** He answered the three open calls; see
> [Decisions and what shipped](#decisions-and-what-shipped) at the foot of this
> document for what was done, what was deliberately not done, and the two things
> the plan got wrong before contact with the screens.

## The question he asked

*"I have shadcn as devdependency but i feel like it wasn't used for a long time
while developing UI. confirm to me if that's the case."*

Largely yes. But "unused" is the wrong diagnosis, and fixing the wrong thing
here would cost a lot of churn for nothing.

## Measured state

Counts from `app/` and `components/`, excluding `components/ui/` itself.

| Primitive | Importers | Lines |
| --- | --- | --- |
| `button` | 10 | 67 |
| `card` | 4 | 103 |
| `input` | 3 | 19 |
| `badge` | 2 | 49 |
| `tooltip` | 2 | 57 |
| `progress` | 1 | 31 |
| **`label`** | **0** | 24 |
| **`select`** | **0** | 192 |
| **`table`** | **0** | 116 |

- **75** UI files total. **55 import nothing from `components/ui` at all.**
- Raw `<button>`: **97**. shadcn `<Button>`: **36**.
- `<Card>`: 29 usages, from **4** files.
- `cn()` is used in exactly **1** file outside `components/ui/`.
- Variant props in use: `outline` ×16, `ghost` ×9, `secondary` ×2. Never
  `destructive`, `link`, or `default`-by-name.

## The actual root cause: two token systems

This is the finding that matters, and it is not "someone got lazy".

`styles/globals.css` defines **14** shadcn tokens (`--primary`, `--muted`,
`--border`, `--background`, …) **and 15** Combat Terminal tokens (`--color-edge`,
`--color-panel`, `--color-readout`, `--color-signal`, the five element hues).

shadcn's variants paint with the first set:

```
outline: "border-border bg-background hover:bg-muted hover:text-foreground …"
```

The game paints with the second. So every `<Button>` in the arena reads like:

```
className="h-11 rounded-none border-2 border-el-red bg-transparent
           font-heading text-base tracking-[0.12em] text-el-red hover:bg-el-red/10"
```

Height, radius, border, background, font, tracking and colour all replaced —
`variant="outline"` passed on one line and contradicted on the next. The
override *is* the seam between the two systems. shadcn isn't unused so much as
**out-voted**, every time, by a design system that arrived later and is more
specific to this game.

The Combat Terminal palette (2026-08-11) is a real design system. shadcn's
defaults — `rounded-lg`, neutral greys, soft borders — are a different one.
Keeping both means every component pays a tax to pick a side.

## One correction to the premise

`shadcn` in `devDependencies` is the **CLI** (`npx shadcn@latest add`). It is a
codegen tool, ships nothing, and its presence is not evidence of use either
way. The runtime dependencies that matter are `radix-ui`,
`class-variance-authority`, `clsx` and `tailwind-merge`.

Removing the `shadcn` devDependency would save nothing and would cost the
ability to pull a new primitive when one is genuinely wanted. **Keep it.**

## What Radix is actually doing

Worth separating, because "shadcn" is really two things — styling opinions, and
Radix behaviour underneath.

- **`tooltip`** (2) and **`progress`** (1) use real Radix behaviour: positioning,
  collision handling, ARIA. Rewriting these by hand is how you get a tooltip
  that escapes the viewport on mobile.
- **`select`** would be the highest-value Radix component in the codebase —
  keyboard nav, typeahead, focus trap, portal — and has **zero importers**. The
  difficulty picker, the team picker and the archive filters are all hand-rolled
  buttons doing a select's job.
- **`button`/`badge`** touch Radix only for `Slot` (`asChild`). Trivial.
- **`card`** has no Radix at all. It is a styled `div` with five sub-components.

## Recommendation

**Do not "adopt shadcn properly", and do not rip it out.** Both are large
changes that fight the direction the UI already went.

Instead, three separate moves, in increasing size. They are independent — any
one can ship without the others.

### Phase 1 — Delete what is dead (small, no risk)

Remove `label.tsx`, `select.tsx`, `table.tsx` (332 lines, zero importers).

**Caveat worth stating:** `select` is dead *because nobody reached for it*, not
because the app has no selects. If Phase 3 is wanted, `select` should be
re-added by the CLI rather than deleted now and regretted. My recommendation:
**delete `label` and `table`, keep `select`** and treat its zero importers as
the bug rather than the evidence.

`table` is the sharper embarrassment — I hand-rolled the Auto Clear results
table in `app/events/page.tsx` today with raw `<table>` markup while
`components/ui/table.tsx` sat unused. That is exactly the failure mode this
spec exists to stop.

### Phase 2 — Make the primitives speak Combat Terminal (medium)

Rewrite the variants in `button.tsx`, `badge.tsx` and `card.tsx` so their
*defaults* are the game's look: `rounded-none`, `border-edge`, `bg-panel`,
`font-heading`, `text-readout`. Then delete the per-usage overrides they exist
to cancel.

The test of success is mechanical and checkable: **`<Button>` usages carrying a
`className` should drop sharply**, and the ones that remain should be adding
something real (a width, a grid position) rather than restating the palette.

This is where the actual win is. It converts 36 overridden buttons into 36
buttons that inherit, and it makes the *next* screen cheaper to build rather
than only tidying the last one.

Order matters: do this **before** any conversion of raw `<button>`s, or the
conversion just creates more overrides to unwind later.

### Phase 3 — Convert selectively, never wholesale (larger, optional)

97 raw `<button>` elements is not a defect to be fixed by a codemod. Most are
tiles, cards and chips that were never buttons in the shadcn sense — the
character grid, the event board, the difficulty picker. Converting them all
would produce worse markup, not better.

Convert only where a primitive brings **behaviour** the hand-rolled version
lacks:

- **Selects** — difficulty picker, archive filters, team preset chooser. Real
  keyboard and screen-reader wins.
- **Tables** — the Auto Clear results table, the effects modal tables, the
  archive rank tables. Consistent overflow and header semantics.
- **Tooltips** — anywhere currently using `title=""`, which is unstyleable and
  invisible on touch.

## Explicitly out of scope

- **Removing the `shadcn` devDependency.** It costs nothing and pays for the
  CLI.
- **Removing `radix-ui`.** Tooltip and progress depend on it, and select should.
- **A global codemod over the 97 raw buttons.** Named above as the wrong move.
- **Changing the Combat Terminal palette itself.** It won; the primitives should
  move to it, not the reverse.
- **Anything in a reserved dedicated session** — the mobile pass in particular
  will touch a lot of the same files, and Phase 2 should land before it, not
  during it.

## Verification

Phases 1 and 2 are behaviour-preserving, so the check is that nothing moves:
`npx vitest run`, `npx tsc --noEmit`, `npm run lint`, and
`NEXT_DIST_DIR=.next-verify npm run build`. There is no test coverage of visual
output, so **Tanveer playtests the look** — the usual rule.

One measurable acceptance check for Phase 2, worth running before and after:

```bash
grep -rn -A3 "<Button" --include=*.tsx app/ components/ | grep -c "className="
```

It reads **16** today at commit `018e9d0`.

## Decisions and what shipped

Answered by Tanveer on 2026-08-13, and built the same day.

| Call | His answer | Outcome |
| --- | --- | --- |
| Phase 1 scope | Delete `label` + `table`, keep `select` | **Amended** — `label` deleted, `table` and `select` both kept (see below) |
| Phase 2 | Yes, retheme the primitives | Done. `<Button>` usages carrying a className: **16 → 6** |
| Phase 3 | Selects, Tables and Tooltips | Tables and Tooltips done. **Selects: nothing to convert** (see below) |

### Where the plan was wrong

Two of this document's own claims did not survive reading the screens they
described. Both were written from counts rather than from the markup.

**1. `table` was scheduled for deletion and for adoption in the same session.**
Phase 1 said delete it; Phase 3 said convert the Auto Clear and effects tables
to it. Deleting and re-adding a primitive inside one batch is exactly the
failure this document exists to stop, so `table` was kept and adopted — the same
reasoning he accepted for `select`, applied to the primitive that had a
confirmed consumer waiting. Only `label.tsx` was deleted; its 3 raw `<label>`
elements all live in `DevGrantPanel` and none of them want the primitive.

**2. "The difficulty picker, the team picker and the archive filters are all
hand-rolled buttons doing a select's job" is false.** Reading them:

- The **difficulty picker** is a 4-tile segmented control where every tile
  shows its own state (Locked / Cleared / New). A select would collapse four
  always-visible states behind a trigger — strictly worse.
- The **archive filters** are multi-select tag and mechanic chips, plus a sort
  control carrying tri-state (off / ascending / descending) in one button. A
  Radix Select can express neither.
- The **team preset chooser** renders member portraits on each chip; a preset is
  recognised by its faces, not its name. Its actual defect is the `window.prompt`
  and `window.alert` calls beside it — `docs/design/UX_IDEAS.md` **N1**, a
  different fix.

So the app currently has **zero** genuine select candidates. `select.tsx` stays
on his call, but the reason given for keeping it (its emptiness is the bug) is
now known to be wrong: nothing in the app wants it today. It should be revisited
the first time a real single-choice control appears, and deleted if one never
does.

### What Phase 2 changed

`button.tsx`, `badge.tsx` and `card.tsx` now paint from the Combat Terminal
tokens by default — `rounded-none`, `border-edge`, `bg-panel`, `font-heading`,
`text-readout`. Size carries the typeface too, because the two always travelled
together: `xs`/`sm` are body-font uppercase readouts, `default`/`lg`/`xl` are
heading-font display text. An `xl` size was added for the h-12 result-screen
buttons.

Variant names are unchanged and now mean something in this game's vocabulary:
`default` is filled signal (primary action), `secondary` is outlined signal,
`outline` is neutral `edge-strong`, `ghost` is quieter `edge`, `destructive` is
`el-red`.

Every remaining `<Button className>` adds something a variant cannot know — a
width, a chamfer, a grid margin, a type size. None restate the palette.

### Two live bugs the retheme fixed

Both were `bg-primary` — shadcn's near-white in dark mode — showing through a
className that overrode text and border but forgot background:

- The victory/defeat screen's **CLAIM REWARDS / CONTINUE STORY / RETRY BATTLE /
  REMATCH** rendered as near-white buttons with cyan text.
- The progression panel's **Ascend** button (`<Button className="mt-2">`) was a
  near-white button inside a Combat Terminal panel.

Neither was reported; both were invisible in code review precisely because the
override *looked* complete.

### What Phase 3 shipped

- **Tables** — `table.tsx` rethemed and adopted by both hand-rolled tables
  (`app/events/page.tsx` Auto Clear results, `components/game/battle/EffectsList.tsx`
  effects modal). The Auto Clear totals row is now a real `<TableFooter>`. Both
  now inherit the `overflow-x-auto` container, which the effects table had been
  getting only by hand.
- **Tooltips** — `tooltip.tsx` rethemed from shadcn's white-on-black pill to a
  `panel-raised` card with an `edge-strong` border. Converted the cases where a
  native `title` was carrying information nothing else showed:
  - the **TopNav resource strip** (stamina, gems, coin, world level, account
    rank) — five explanations that never appeared on touch at all, on chrome
    that renders on every screen;
  - the **Feed Manual** disabled reason in the progression panel, where a native
    `title` fires on neither a disabled control nor a tap — invisible in exactly
    the two cases that needed it.

The other ~40 `title=` occurrences were left alone: most are React props named
`title` (panel headings, overlay titles), not HTML attributes, and the genuine
ones restate a label already visible next to the icon.

### Verification

`npx vitest run` → **1192 passed / 96 files**. `npx tsc --noEmit` → clean.
`npm run lint` → 0 errors, the same 3 known warnings in `tests/duel.test.ts`.
`NEXT_DIST_DIR=.next-verify npm run build` → compiled, 48 pages.

No test covers visual output, so **the look is unverified** — Tanveer playtests,
per the usual rule. The screens most changed are the battle result modal, the
story reward and skip screens, the events Auto Clear results, the effects modal
and the top nav.

### Still open

- **`select.tsx`** — kept, but with no consumer and no candidate. Revisit when a
  real single-choice control appears.
- **The 97 raw `<button>` elements** are untouched and should stay that way; see
  the out-of-scope list above.
- The **mobile pass** will touch many of the same files. Phase 2 landing first
  was deliberate.

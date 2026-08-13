# shadcn and the game UI — cleanup, and what to actually use it for

> Spec written 2026-08-13 after Tanveer asked whether shadcn had quietly stopped
> being used. **Not built.** Every number below was measured against the repo at
> commit `018e9d0`, not recalled.

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

## Open — his calls

1. **Phase 1 scope**: delete all three dead primitives, or keep `select` for
   Phase 3? (I recommend keeping `select`.)
2. **Is Phase 2 wanted at all**, or is hand-rolled Tailwind the intended house
   style from here? It is a legitimate answer — this codebase is proof it works.
   It just needs to be a decision rather than a drift.
3. **Phase 3 appetite**, if any. It is the only phase with real risk, and it
   buys accessibility rather than looks.

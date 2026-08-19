---
name: mobilecheck
description: Audit one screen against the mobile-first rule (ruling #107) — 390x844 canvas, dvh not vh, 44px touch targets, no hover-only affordances, one scroll per screen. Use before shipping any new screen, when reworking a screen built before 2026-08-18, or when Tanveer says "/mobilecheck", "check this on mobile", "is this phone-safe", "mobile pass on X". Reports findings ranked blocker vs bug; proposes fixes, does not apply them unasked.
---

# mobilecheck

**One screen per invocation.** A route, or a component and its children — not the
whole app. A sweep produces a list nobody acts on; one screen produces a fix.

## The rule being enforced

Ruling **#107** (2026-08-18), his words: *"must be mobile first and desktop
second. most of the player who are willing to try out my game would play on
mobile."* The full statement lives in `AGENTS.md` and `docs/HANDOFF.md`.

What that makes this audit: **a break at 390px is a blocker, a break at 1440px is
a bug.** Rank every finding that way and say which it is. Desktop is the same
column centred at a capped width — never a re-laid-out wide variant, so "it looks
fine on desktop" is not a defence and "it needs a desktop-specific layout" is
usually the wrong fix.

## Where the truth lives

- `AGENTS.md` — the standing rule, in the block after the stack table.
- `docs/HANDOFF.md` #107 — the ruling with his phrasing.
- `styles/globals.css` — the tokens; `components/ui/` — the primitives, already
  Combat Terminal by default (ruling #84), so a fix rarely needs a className.
- `components/game/story/` — **the calibration set.** Story mode v2 is the only
  surface built under #107. If a check fires there, suspect the check.

## The checks, in order

Run each grep against the screen's own files. A hit is a *candidate*, not a
finding — the judgement is what makes this worth doing.

### 1. `vh` units — always a blocker

```bash
grep -rn "h-screen\|min-h-screen\|100vh\|\[100vh\]" <paths>
```

Tailwind 4 compiles `screen` to `100vh`, the **largest** viewport. On a phone with
browser chrome showing, `min-h-screen` is taller than what the player can see, so
every such page carries a phantom scroll. Fix is `min-h-dvh` / `h-dvh`.

Known state 2026-08-19: **15 live hits across 12 files** — `app/archive/*`,
`app/events`, `app/login`, `app/news`, `app/practice`, `app/profile`,
`components/HomeMenu.tsx`, `components/gacha/BannerScreen.tsx`,
`components/news/NewsPostLayout.tsx`. This is the known debt, not a surprise.

### 2. Hover-only affordances — blocker

```bash
grep -rn "hover:\|onMouseEnter\|title=" <paths>
```

A phone has no hover. The finding is only real when the hover **carries
information or is the only way to reach an action** — a `hover:bg-*` polish state
is fine, a tooltip holding a mechanic's numbers is not. Check that anything
informational also fires on tap/focus. `title=` holding real content is always a
finding.

### 3. Touch targets under 44px — blocker on anything tappable

```bash
grep -rn "className=\"[^\"]*\bh-[1-9]\b" <paths>
```

Judgement required: `h-3 w-3` on a decorative icon is fine; the same on a button
is not. Look at what the element *does*. The real question is the tappable
element's total box — an `h-4` icon inside a `p-3` button is a 40px target and
still fails.

### 4. Nested scroll — blocker

```bash
grep -rn "overflow-y-auto\|overflow-auto\|overflow-scroll" <paths>
```

One vertical scroll per screen. Wide content (tables, wave rails, reward lists)
scrolls **horizontally inside its own container**, which is correct and expected.
Two vertical scroll regions stacked is the failure — the player cannot tell which
one their thumb is in.

### 5. Fixed widths and desktop-shaped grids — usually blocker

```bash
grep -rn "w-\[[0-9]\{3,\}px\]\|min-w-\[[0-9]\{3,\}px\]" <paths>
grep -rn "grid-cols-[3-9]" <paths> | grep -v "sm:grid-cols\|md:grid-cols\|lg:grid-cols"
```

Anything over ~358px (390 minus padding) overflows.

For grids, **the unprefixed class is the mobile one** — `grid-cols-3 sm:grid-cols-4`
is correct and must not be flagged (calibration case:
`components/gacha/MilestonePicker.tsx:40`, which is fine). The bug is a large
unprefixed count with **no larger breakpoint above it**, which means the column
count was chosen for a desktop width and never revisited — hence the second grep
excluding the responsive forms. Then check what's *in* the cells: three columns
of 12px labels at 390px is unreadable even when the grid itself fits.

### 6. Thumb reach — judgement, no grep

Primary action in the lower third. A confirm button at the top of a long scroll
is reachable only by re-gripping the phone. Read the JSX order and say where the
primary lands.

## What this skill does not do

- **It does not browser-verify.** Tanveer does the visual pass on his own server
  (:3000 is his — never start or kill one). Findings are static-analysis plus
  reading the JSX; say so, and never claim a screen "looks right".
- **It does not mass-fix.** A 15-file `min-h-screen` sweep touches gacha, archive
  and the hub, all of which are known debt with their own sessions coming
  (`docs/ROADMAP.md`). Report, propose, and apply on his word — per-screen.
- **It does not redesign.** If a screen needs a different layout to work at 390px,
  that is a design proposal and goes to him as an HTML mockup (ruling #106), not
  as an edit.

## Finish

Report a table: `file:line`, check, **blocker** or **bug**, and the one-line fix.
Then state the screen's verdict in one sentence — phone-safe, or the count of
blockers standing between it and phone-safe.

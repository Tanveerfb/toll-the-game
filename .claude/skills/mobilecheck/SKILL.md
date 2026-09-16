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
- `docs/HANDOFF.md` **#119** (the 44px floor lives in the primitives) and **#120**
  (nothing explanatory may be hover-only) — the two rules now enforced in code.
- `styles/globals.css` — the tokens, plus `.screen-below-nav` and `.pb-safe`;
  `components/ui/` — the primitives, already Combat Terminal by default (ruling
  #84) **and** touch-sized since 2026-08-21, so a fix rarely needs a className.
- `tests/touchTargets.test.ts`, `tests/viewportUnits.test.ts` — what is pinned.
  Read these before reporting: a rule with a test behind it produces a *test
  failure*, not an audit finding, and reporting it as a finding wastes his time.
- `docs/design/mockups/battle-mobile.html` — the open layout questions in battle.

**On the calibration set.** This skill used to say story mode was the only
surface built under #107 and *"if a check fires there, suspect the check"*. Both
halves are now wrong: the 2026-08-21 sweep took every screen, and the check that
fired on story mode was **right** — `StageBrief` and `StageList` had 36px
buttons, inherited from a primitive whose default was wrong. A screen authored
mobile-first is not evidence that a finding is a false positive.

## Start at the primitives, not the screen

**Most violations are inherited, not authored.** The 2026-08-21 audit found
`components/ui/button.tsx` shipping nine sizes with **five under 44px**, `default`
worst at 36px — and 20 of 51 call sites take `default` without naming a size.
`components/game/story/`, built mobile-first as this skill's own calibration set,
still shipped two 36px buttons: it asked for the default and the default was
wrong.

So before auditing a screen, check whether the thing you are about to flag comes
from a primitive. If it does, the finding belongs in `components/ui/` and fixes
every screen at once. The floor is enforced there now and pinned by
`tests/touchTargets.test.ts` (ruling #119) — a *new* violation in a screen is
usually a raw `<button>` that never went through the primitive.

## The checks, in order

Run each grep against the screen's own files. A hit is a *candidate*, not a
finding — the judgement is what makes this worth doing.

### 1. `vh` units — always a blocker

```bash
grep -rn "h-screen\|min-h-screen\|[0-9]vh\]" <paths>
```

Tailwind 4 compiles `screen` to `100vh`, the **largest** viewport. On a phone with
browser chrome showing, `min-h-screen` is taller than what the player can see, so
every such page carries a phantom scroll. Fix is `min-h-dvh` / `h-dvh`.

**Match any `vh` in a height, not just `100vh`.** This grep used to read
`100vh\|\[100vh\]`, and that is exactly how four `max-h-[80vh]`/`[85vh]`/`[92vh]`
shells — `ModalShell`, `DetailOverlay`, `PullReveal`, `UnitDetailPanel`, i.e. the
container behind *every* modal in the game — survived the 2026-08-19 sweep and
sat unnoticed until 2026-08-21. `vw` is fine; `max-w-[92vw]` is not a finding.

State 2026-08-21: **zero live hits.** `tests/viewportUnits.test.ts` now covers
both forms, so a hit here means someone wrote one this session.

### 2. Hover-only affordances — blocker

```bash
grep -rn "TooltipTrigger\|hover:\|onMouseEnter" <paths>
npm run test -- touchTargets   # the `title=` half is a test now, not a grep
```

**Do not grep for `title=` by hand — it drowns.** `title` is a prop name on
half the modals in this codebase, so the 2026-08-21 sweep ran that grep, got a
wall of `<ModalShell title=…>` hits, and missed **ten real ones** including the
summon banner's twelve featured tiles. `tests/touchTargets.test.ts` scans for
`title=` on *lowercase* JSX tags only — that is the discriminator between a DOM
attribute and a component prop, and it is why this is a test rather than a
check you run by eye (ruling #125).

A phone has no hover. The finding is only real when the hover **carries
information or is the only way to reach an action** — a `hover:bg-*` polish state
is fine, a tooltip holding a mechanic's numbers is not. `title=` holding real
content is always a finding.

**`TooltipTrigger` is the one to lead with, and no earlier version of this skill
looked for it.** A radix `Tooltip` opens on hover and focus; wrapped around a
bare `<span>` — which is how every mechanic keyword, every nav counter and the
progression panel's disabled-reason message were written — a phone gets neither.
That is not a degraded experience, it is **information that does not exist on
mobile at all**, and it was the single largest finding of the 2026-08-21 audit.
The fix is `components/ui/Hint.tsx` (ruling #120), a `Popover` with a real button
trigger. `tests/touchTargets.test.ts` forbids `TooltipTrigger` outside the
primitive, so a hit is a regression.

Watch for the shape that hides it: a `<span>` wrapper added *specifically*
because the real control was disabled or wasn't focusable. That wrapper is the
tell — it means someone already noticed the trigger didn't work and reached for
a workaround that a touch device still can't use.

### 3. Touch targets under 44px — blocker on anything tappable

```bash
grep -rn "className=\"[^\"]*\bh-[1-9]\b" <paths>
grep -rn "py-0\.5\|py-1\b\|py-1\.5\b" <paths>
```

Judgement required: `h-3 w-3` on a decorative icon is fine; the same on a button
is not. Look at what the element *does*. The real question is the tappable
element's total box — an `h-4` icon inside a `p-3` button is a 40px target and
still fails, and **most misses are padding, not height**: `px-2 py-0.5` on 10px
text is a 20px target and carries no `h-*` at all, which is why the second grep
exists.

Two documented exceptions, so don't re-flag them:

- **An inline control inside a sentence** — a keyword, a tag in a metadata run —
  cannot be 44px without wrecking its paragraph. Those take `py-1 -my-1`, which
  buys 8px from the line box.
- **A control that lives inside something smaller than 44px** — the Merge button
  on a hand card. Sizing it would cover the thing it sits on; that is a layout
  finding, not a target finding, and it goes to Tanveer as a mockup.

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

### 5b. A grid with no unprefixed `grid-cols` — blocker

```bash
grep -rnoE 'className=\{?"[^"]*\bgrid\b[^"]*"' <paths> |
  grep -E '(sm|md|lg|xl):grid-cols' | grep -vE '(^| )grid-cols'
```

A `grid` whose **only** `grid-cols` sits behind a breakpoint gets one implicit
**`auto`** track below that breakpoint — and an auto track is allowed to exceed
its container. `/archive/[id]` scrolled sideways **86px** at 395 because its
single track sized to 453px inside 351px and dragged the whole portrait rail
off-screen (2026-09-01). `grid-cols-1` is `repeat(1, minmax(0, 1fr))` and the
`0` floor is the entire fix; the `lg:` override is unaffected.

Four more files carried the same shape latently. It only *bites* when a child's
intrinsic width exceeds the container, which is why it hides: the same markup is
fine on three screens and broken on the fourth.

### 5c. Anything pinned to the bottom edge — blocker

```bash
grep -rn "fixed inset-x-0 bottom-0\|fixed bottom-0" <paths> | grep -v app-tabbar
```

The bottom tab bar (#123) is `fixed bottom-0 z-50`. A screen's own pinned action
bar at `bottom-0` sits **under** it and is simply not there. `TeamSelect`'s START
(`z-40`) and `StageBrief`'s launch bar (`z-20`) were both covered outright from
the day the tab bar shipped — practice and the world boss were unstartable on a
phone, and nothing caught it because both elements are correct in isolation.

Use `bottom-[var(--tabbar-h)]`, which is `0rem` wherever the bar does not
render. Pinned by `tests/overlayStacking.test.ts`. A full-viewport overlay
(`inset-0`) is not a bottom bar and is exempt.

### 6. Thumb reach — judgement, no grep

Primary action in the lower third. A confirm button at the top of a long scroll
is reachable only by re-gripping the phone. Read the JSX order and say where the
primary lands.

## If you are given a browser: measure, do not look

Tanveer lifted the no-browser rule for one session on 2026-09-01. It found
seven real bugs — and it also produced **three false findings in a row**, every
one of them from believing a screenshot. Bank both halves.

**A screenshot is a race, not a record.**

- **Portraits are `loading="lazy"`.** A shot taken right after `navigate`
  catches empty boxes. "The banner shows twelve blank squares" and "the arena
  tiles are empty" were both wrong; the images were loading fine and a JS check
  said so. A `wait` before the shot helps and does not fix it.
- **Entering elements are mid-animation.** Battle notices measured at
  `35..394` — "4px clipped" — and their row is actually at `15..374`, well
  inside. The 20px offset was `initial={{ x: 20 }}` caught in flight.
- So: **`javascript_tool` with `getBoundingClientRect` is the finding;
  the screenshot is orientation.** Every number in a report should come from
  the DOM, not from counting pixels in an image.

**`elementFromPoint` is the only honest "can I tap this" test.** Geometry said
START was a 172x44 button in the right place; it was invisible to the player and
a tap navigated to Gacha. One line finds it, and it finds occlusion that no
`getBoundingClientRect` sweep can:

```js
const r = el.getBoundingClientRect();
const hit = document.elementFromPoint((r.left+r.right)/2, (r.top+r.bottom)/2);
const clickable = !!(hit && el.contains(hit));
```

Run it on every primary action. **A control you cannot reach is worse than one
that is 40px**, and only this catches it.

**Claude-in-Chrome cannot resize a maximized window.** `resize_window` returns
*"Successfully resized"* and `outerWidth` does not move, so every subsequent
measurement is silently at desktop width — which looks like the fix working.
Check `innerWidth` after resizing, every time. The in-app browser
(`mcp__Claude_Browser__*`) does real viewport emulation and is the reliable tool
for a width; it has no access to his signed-in session, which only matters for
`/profile`.

**A stale server lies with total confidence.** `pkill -f "next start"` does not
match the npx-spawned process on Windows. The replacement then dies on
`EADDRINUSE`, the old one keeps serving, and two rounds of "the fix didn't
work" follow. Kill by PID from `netstat -ano | grep LISTENING | grep :<port>`,
and check the log says `Ready` rather than assuming a 200 means your build.

**Verify against a build you started.** `:3000` is his — never start or kill
one. `NEXT_DIST_DIR=.next-verify next build` then
`NEXT_DIST_DIR=.next-verify next start -p 3210` gives a production build on a
spare port; stop it by PID and delete `.next-verify` when done. The live
deploy is the *previous* commit and will not contain the work under test.

**What a browser is uniquely for.** Three bugs this session were invisible to
every test and to reading the source: a `fixed` bar rendering at the top
because an ancestor's `backdrop-filter` established a containing block; a
tab bar keyed to the wrong state removing navigation entirely from one screen;
and a battle screen resuming without its hand. None had a failing test. All
three took one page load.

## What this skill does not do

- **It does not browser-verify the LOOK.** Tanveer does the visual pass on his
  own server (:3000 is his — never start or kill one). Findings are
  static-analysis plus reading the JSX; say so, and never claim a screen
  "looks right".

  **Behaviour is a different matter since 2026-08-21.** `npm run test:browser`
  runs component tests in real Chromium, so a hover-only or gesture finding can
  now be *proven* rather than argued — and should be, when the fix is
  non-obvious. That harness immediately caught a bug nothing else could see:
  `Hint` opened on focus and toggled on click, so a mouse (which focuses before
  it clicks) opened the popover and then closed it again. Nothing in the markup
  was wrong. A grep proves a class is present; only a browser proves a gesture
  works.

  **Three traps in that harness, all found 2026-09-01 writing
  `tests/battleLogDrawer.browser.test.tsx`, all of which produce a test that
  fails — or worse, passes — for a reason unrelated to the thing under test:**

  - **A component that animates needs `MotionProvider` around it.** `m.*`
    without `LazyMotion` renders the element, applies its `initial` style and
    then never animates it away. The log drawer enters from `x: "100%"`, so it
    sat ~380px off the right edge of a 390px viewport and every geometry
    assertion measured a panel the player would never see. Mount it the way
    the app does, and wait out the enter animation before measuring.
  - **A portalled component needs explicit `cleanup()` plus
    `document.body.replaceChildren()`.** `render`'s own teardown does not
    reach a portal, so the second test in a file measures the first test's
    leftovers too, and `getByText` goes ambiguous on anything that appears
    once per render.
  - **`resolve.dedupe: ["react", "react-dom"]`** is already in
    `vitest.config.ts` and must stay. Without it framer-motion and
    vitest-browser-react are pre-bundled with a React each, and
    `AnimatePresence` dies on `useContext` of null before the first assertion.
- **It does not mass-fix screens.** Report, propose, and apply on his word —
  per-screen. The exception, learned 2026-08-21: **a fix that belongs in a
  primitive is one edit, not a sweep**, and holding it back per-screen is how
  the same bug gets re-authored. Raising `button`'s floor touched every screen
  in the game and was still a single, reviewable change; hand-patching the
  screens instead would have left the scale broken for the next one.
- **It does not redesign.** If a screen needs a different layout to work at 390px,
  that is a design proposal and goes to him as an HTML mockup (ruling #106), not
  as an edit. Battle is the live example: its target sizes were fixed outright,
  its rail, hand width, merge gesture and tile density went to
  `docs/design/mockups/battle-mobile.html` and are still unbuilt (#118).

## Finish

Report a table: `file:line`, check, **blocker** or **bug**, and the one-line fix.
Then state the screen's verdict in one sentence — phone-safe, or the count of
blockers standing between it and phone-safe.

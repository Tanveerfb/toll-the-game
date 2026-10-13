---
name: redesign
description: Run a visual redesign round the way he decides it — ask what works before drawing, capture the live screens at 390×844, draw two or three options that take different positions from the live component anatomy and real art, make the interaction live, measure it in Chromium, publish it as an artifact when he is on his phone, and record his pick as a ruling. Use when he says "redesign", "mockup", "draw options", "the X screen looks bad", "something more professional", or any request to change how a screen looks.
---

# redesign

The loop he decides by: **options, not a proposal** (ruling #144), drawn from
what is already on screen (#177, #185), chosen through a picture he can tap.

## Where the truth lives

- `docs/HANDOFF.md` **#144** (draw more than one; each option a different
  position; live interaction), **#177** (hand-drawn mockups were "not website
  accurate": draw from the live screen's markup and compiled CSS), **#185**
  (keep what works; the Characters page is the benchmark; catalogue motif swaps
  drawn without looking were rejected as generic), **#106/#107** (390×844).
- `docs/design-system.md` — the tokens, the type scale, the components table.
- `components/ui/` — the primitives; `components/game/UnitTileFace.tsx` — the
  tile anatomy he loves (#172). A mockup renders the same anatomy span for span.
- `docs/design/<name>.html` — the designs he locked, one file each (#188); a
  draft never lands there. `docs/design/mockups/screens-from-characters.html`
  is the one open round (round two of the theme), kept committed until he
  decides. Read the newest before drawing:
  what he rejected is as binding as what he picked.
- `scripts/capture-screens.mjs` — captures the live screens at phone size with a
  seeded roster.
- `project-rules.md` §OWNER, §DESIGN, §SHADCN — the fleet rule: every visual
  change starts as a mockup he approves; the component round follows a lock.

## Step 0 — Ask what works before drawing anything

**The 2026-10-13 lesson.** He said the motif "did not grow on me" and three
whole-motif swaps were drawn. All three were rejected: *"those are generic"*.
What he meant was *the screens it looks bad on*. He keeps the Characters page
and the nav; Home, Events, Gacha, Profile and Settings change.

So, before drawing, ask in prose (§ASK) and wait:

1. Which screens work and must stay as they are?
2. Which screens are the problem, in order of how much they bother him?
3. Anything that must survive (art, colours, a component)?

Then read `docs/HANDOFF.md` for every ruling on those screens.

## Step 1 — Capture the live screens

A mockup drawn from memory is not website accurate (#177). Start a scratch
server and capture what is there:

```bash
NEXT_DIST_DIR=.next-verify npx next dev -p 3210     # never his :3000
node scripts/capture-screens.mjs --out <scratch>/live --full
```

Look at every capture. Measure the thing that is wrong (*"Home uses the top 40%
of the viewport"*), because a measurement is why an option exists (AGENTS.md:
measuring is Claude's, deciding is his). Take the markup of the components the
options reuse from the page (`element.outerHTML` in Playwright) and the utility
values from `styles/globals.css`, verbatim.

Afterwards: kill the server by PID, `rm -rf .next-verify`,
`git checkout tsconfig.json` (`next dev` rewrites its `include`).

## Step 2 — Draw two or three options that take different positions

- **One file** in `public/_mockups/<subject>.html` (gitignored; the dev server
  serves it at `/_mockups/<subject>.html`, so art is referenced as `/characters/...`),
  a `.phone` frame at
  390×844, an option chooser, and a notes panel per option: the position it
  takes, what changes, what stays, watch-outs, what it costs to build.
- **Different positions, not variations.** Three looks on one idea are one
  option. Round two's positions were: everything is a tile / tiles for units
  only, dark board for the rest / full-width posters.
- **The kept screens appear unchanged** in every option, as the benchmark.
- **One markup, rendered by one function per component** (the tile, the row,
  the poster), so every instance is the same component — the mockup obeys
  consistency the way the code does.
- **Real art, by relative path** from `public/` (`../../../public/...`). Never
  data-URIs over a few hundred KB: the browser pane cannot open a 1.4 MB file.
- **Make it live** (#146): tabs switch, selections select, costs recompute, a
  sheet opens and closes on Escape and backdrop, a draw spends gems.
- **Tokens and type as the game has them.** Bangers draws capitals; the
  sentence-case decision (2026-09-27) is a separate queued question, not a
  thing to settle inside a mockup.
- **Less is more (#178):** no counts, no helper sentences, no label that
  repeats the screen. A closed mode is not a tile.
- A tab-bar or chrome colour he said may change gets a toggle, not a fourth
  option.

## Step 3 — Measure it in Chromium before showing it

Playwright, viewport 1100 wide so the frame renders at 390, transitions
frozen. For every option and screen: a screenshot; every `a`/`button` inside
the frame ≥ 44×44; no `<img>` with `naturalWidth === 0`; text contrast per
token pair ≥ 4.5:1 when the mockup defines its own tokens (round one's script
is the pattern: compute relative luminance from the computed `--` variables).
Fix what fails, re-run, then look at the screenshots yourself.

## Step 4 — Show it where he is

- Drafts are not committed (#188, the fleet rule): `public/_mockups/` is
  gitignored. **A cloud session's draft dies with the container**, so from the
  cloud always publish the artifact below as well, and say the file is not in
  the repo. When he locks one, `git mv` it to `docs/design/<name>.html`, fix
  its art paths to `../../public/...`, and record the pick (step 5).
- **If he is on his phone, publish an artifact as well** (his ask, 2026-10-13:
  *"I'm on the phone and I can't see the mockups any other way"*): copy the
  HTML with art paths rewritten to `public/...`, publish with `files` mapping
  every image under `root: /home/user/toll-the-game`, and send the link. The
  page is private until he shares it.
- Send the screenshots too (`SendUserFile`), one per option for the screen that
  matters most.

## Step 5 — His pick is a selection; his reasoning is his words

Record with the `ruling` skill. The letter he picks is a **selection** of a
heading you wrote; what he says while rejecting one is **his** (the ruling
skill's #145 rule). Supersede the ruling the old screen was built under. Then
the component round (§SHADCN): the core kit in the picked look, two or three
creative options per core component, before any screen is rebuilt.

## Never

- Draw before asking what works (Step 0).
- Hand-draw a screen that exists; capture it.
- Offer three versions of one idea as three options.
- Restate the theme at a usage in the build that follows (#84).
- Decide a queued question (sentence case, nav colour) inside a mockup
  without a toggle or a note that it is open.

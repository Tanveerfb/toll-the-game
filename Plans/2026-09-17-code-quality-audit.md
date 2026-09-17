# Code quality audit — consistency, modularization, QOL

**Run 2026-09-17**, against the three values he named as his standing criteria
(ruling #139): *"consistency, modularization, and QOL."*

Everything below is **measured**, not opined. Nothing has been changed. Each
finding names what it costs and roughly what fixing it touches, so he can pick.

> **The first version of this audit was shallow** — about eight greps over
> 42,000 lines, covering only UI class drift, file sizes and list affordances.
> Tanveer asked whether it was really deep. It was not. This version adds type
> safety, dead code, test coverage, accessibility, hydration, error boundaries,
> debt markers and compliance against his own mobile rulings. **Three of the
> five most serious findings below (M3, Q3, T1) were missed by the first pass.**

---

## What is already good — do not churn these

Worth stating first, because an audit that only lists faults invites rework of
things that are working.

- **The colour token layer is disciplined and well named.** `void`, `panel`,
  `inset`, `hairline`, `edge`, `edge-strong`, `readout{,-strong,-dim,-muted}`,
  `signal`, `el-*`, `role-*` — named by **role**, not by colour, so a repaint
  never orphans a name. Hardcoded hex outside the token file is effectively
  absent: 39 matches, of which the Google brand marks on `/login`, the manifest
  theme colour, and `storyBackgrounds.ts`'s per-locale tints are all legitimate.
- **Enforcement-by-test is an established pattern here and it works.**
  `touchTargets`, `viewportUnits`, `overlayStacking`, `effectColours`,
  `skillTypeColours`, `cardFrameStyle`, `sourceControlChars`. Rulings #119-120
  moved the 44px floor **into the primitives** rather than fixing it per screen —
  that is the template every finding below should be fixed with.
- **Story mode is properly decomposed** — nine screens in
  `components/game/story/`, with the page acting as a state machine over them.
- **`lib/game/` is mostly single-purpose and pure.** `stageRun`, `stageMissions`,
  `accountRank`, `worldLevel`, `autoClear`, `cloudSave`, `stageEffects` are each
  one idea, testable without React. That is why 1,485 tests exist at all.
- **Type safety is genuinely tight.** One `any` in the whole source tree; ten
  `as unknown as`, each at a real boundary and most carrying a comment; **zero
  `@ts-ignore` or `@ts-expect-error`** outside Next's generated
  `.next/dev/types/`.
- **Almost no debt markers.** Two `TODO`s total, both recording a decision
  (ascension bands 4-6 uncosted, the per-band bump left as tuning) rather than
  marking rot.
- **No stray logging.** Ten `console.*` calls, every one deliberate error
  handling — the Firestore permission warning, the catalog guard, the error
  boundary. No `console.log` anywhere.
- **His mobile rulings are holding, with zero violations.** No `title=` on a
  lowercase tag (#125), no `TooltipTrigger` outside `components/ui/` (#119), no
  bare `vh` or `h-screen` (#107 — the single match is a *comment* explaining why
  not), and the three `h-7`/`h-8` hits are all decorative `<span>`s, not touch
  targets. **This is the strongest evidence in the audit that
  enforcement-by-test works** — it is the one area with guards, and it is the one
  area with no drift.
- **Accessibility basics are sound.** Zero `onClick` on a `div` or `span`, 45
  `aria-label`s, exactly one `<Image>` without `alt` (`ItemIcon.tsx`, decorative
  with a documented fallback).

---

## Consistency

### C1 — The same primary button exists in seven hand-typed variants · **high**

No component owns the pattern, so every screen re-types it and drifts:

```
3x  bg-signal/12 py-3        tracking-[0.18em]  hover:bg-signal/20
1x  bg-signal/12 py-3        tracking-[0.18em]  (no hover at all)
1x  bg-signal/12 px-5 py-3   tracking-[0.18em]  hover + disabled
1x  bg-signal/12 px-4 py-2.5 tracking-[0.16em]  hover + disabled
1x  bg-signal/10 px-4 py-1.5 tracking-[0.18em]  (no hover)
1x  bg-signal/10 px-4        tracking-[0.16em]  hover:bg-signal/20
1x  bg-signal/12 px-4        tracking-[0.16em]  hover:bg-signal/25
```

They disagree on opacity, letter-spacing, padding, and **whether hover and
disabled styling is written at all**. None of it is catchable by eye in review.

> **Correction, 2026-09-17.** This finding first claimed some of these buttons
> had **no disabled styling**, which would have been a live QOL fault. **That was
> wrong** — an artefact of the detecting regex, which used `<button[\s\S]*?>`
> and stopped at the `>` inside `onClick={() =>`, never reaching the
> `disabled:` classes that follow. Re-measured with brace-depth tracking:
> **all 17 disable-able buttons already show it**, 14 via `disabled:` utilities
> and 3 via a conditional class on the same flag. The real fault is that each
> one **restates** the styling rather than inheriting it.

**Fix shape — and note the primitive already exists.** `components/ui/button.tsx`
was rethemed on 2026-08-13 so its variants *are* the game's look; these screens
simply bypass it. So the work is **migration, not construction**: adopt
`<Button variant=… size=…>`, plus a test forbidding the raw pattern outside the
primitive — exactly how `touchTargets.test.ts` guards the 44px floor.

**DONE 2026-09-17.** 12 buttons across 7 files migrated, one `claim` variant
added for the repeated `el-light` reward action, and
`tests/buttonPrimitive.test.ts` now fails the build on a new hand-rolled
uppercase action button (falsified). The battle HUD and the `chamfer` buttons
are in a documented allow-list — the first because its density is deliberately
tuned and unreviewable without eyes on the screen, the second because `chamfer`
carries its own unlayered focus ring that would fight the primitive's.

### C2 — Letter-spacing has 18 values across 364 uses · **high**

`0.18em` x53 · `0.16em` x48 · `0.14em` x46 · `0.1em` x34 · `0.12em` x34 ·
`0.22em` x32 · `0.2em` x31 · `0.06em` x26 · `0.08em` x18 · `0.04em` x17 ·
`0.05em` x9 · `0.34em` x7 · then single uses of `0.4`, `0.28`, `0.09`, `0.3`,
`0.26`, `0.03`.

The top six are all doing **one job** — the uppercase micro-label. That is drift,
not a scale.

**Fix shape:** pick three or four named steps (his call which), express them as
tokens, and migrate. A test can then forbid arbitrary `tracking-[...]`.

### C3 — The panel container is typed by hand 15 times · **medium**

`border border-edge-strong bg-panel` x15, plus `bg-inset` x2,
`bg-readout-strong` x2, `bg-transparent` x1, `bg-panel-raised` x1. Same fix
shape as C1: a `Panel` primitive with a variant prop.

### C4 — `#ffffff` hardcoded in the battle arena · **low**

`components/game/BattleArena.tsx:660` and `:896`. Two instances, trivially
replaced by a token. Noted only because the rest of the codebase is clean, so
these are genuinely anomalous rather than typical.

### C5 — The code says "wave" where it means "fight" · **high, and growing**

Ruling **#137**: a *fight* is a separate battle; a *wave* is new enemies arriving
**inside** one fight, and waves are reserved but deliberately unbuilt. Every
`wave` symbol in the codebase currently means **fight**: `StoryWave`,
`waveIndex`, `waveCount`, `waveEnemies`, `waveTeam`, `applyWaveOutcome`,
`WaveBreak`, `foldWaveFromBattle`, `launchWave`.

**26 files** reference it. The player-facing strings already say "Fight N of M",
so the code is the only place using the wrong word.

**Why this is not cosmetic:** the name is occupied by the concept one level up.
The day real waves are added, `waveEnemies` will mean two different things, and a
future reader of it would reasonably expect reinforcements. **Cheapest now**,
before more content is authored against it.

### C6 — Reward lists are rendered by two separate implementations · **medium**

`app/events/page.tsx` has a `RewardRow` tuple type plus `rewardRows()`,
`farmablePreview()` and `firstClearPreview()` builders.
`components/game/story/StageBrief.tsx` has its own `RewardRows` **component**
doing the same job for story payouts.

Same concept — an icon, a label, an amount, zeroes dropped — implemented twice
with different shapes. A new reward type has to be added in two places, and
already-diverged behaviour (banked/claimed dimming exists in one, not the
other) will keep diverging.

**Fix shape:** one `RewardList` in `components/game/`, taking a normalised
`{ id, label, amount | range, banked? }[]`. `ItemIcon` already centralises the
art side and is used in 14 files, so only the row layout is duplicated.

---

## Modularization

### M1 — `app/events/page.tsx` is 1,235 lines and holds 11 view branches · **high**

It contains the board, the brief, the battle, results, auto-clear results, the
trial battle, the trial road and trial results — plus `EventCard`,
`AutoClearResults`, `TrialMissing` and three reward/preview helpers, all inline.

The contrast is instructive: **story mode did this correctly.** Nine screens live
in `components/game/story/` and `app/story/page.tsx` is a state machine over
them. `components/game/events/` now exists but holds **one** file — `TrialRail`,
created yesterday — while everything else stayed in the page.

**I made this worse yesterday**, adding three view branches to the page rather
than extracting them.

**Fix shape:** mirror the story layout. `EventBoard`, `EventBrief`,
`EventResults`, `AutoClearResults`, `TrialResults` move to
`components/game/events/`; the page keeps the state machine and the callbacks.

### M2 — Four files over 1,000 lines · **medium, needs his judgement**

`lib/game/combat.ts` 1,793 · `components/game/BattleArena.tsx` 1,482 ·
`lib/game/damagePreview.ts` 1,410 · `hooks/BattleProvider.tsx` 1,091 ·
`store/playerStore.ts` 1,034 · `store/gameStore.ts` 1,026.

**Large is not automatically wrong** — `combat.ts` is the engine and its size is
mostly the ruling density that makes it trustworthy; splitting it has real risk
and little reward. `BattleArena.tsx` is the more plausible candidate, since it is
a *view* rather than a rule set and the battle overlays were already split out
of it once. **Flagged for his call, not asserted as a defect.**

### M3 — `lib/game/mechanicTemplates.ts` is dead code · **high, and free to fix**

174 lines. **Zero source files import it. Zero tests reference it.** Nothing in
`app/`, `components/`, `lib/`, `hooks/` or `store/` touches it.

This is precisely the failure `AGENTS.md` describes for stale skills — *"a stale
skill does more damage than a stale doc"* — arriving as code instead. A future
session reading it will reasonably assume it is live and build against it.

**Fix shape:** delete it, or, if it encodes something he wants kept, move it to
a doc. Confirm with him first: 174 lines of authored mechanic templates may be
intent he has not used **yet**, which is a different thing from rot.

---

## QOL

*His definition: the affordances that make a feature usable rather than merely
functional — can a player find, narrow, order and understand what is on screen?*

### Q1 — `TeamPicker` lists the whole roster with no search and no sort · **high**

Measured across every list screen:

| screen | search | sort | filter |
| --- | :-: | :-: | :-: |
| `CharacterBrowser` (archive) | **yes** | **yes** | **yes** |
| `TeamPicker` | no | no | ownership only |
| events board | no | no | visibility only |
| `BannerScreen` | no | no | no |
| `InventoryModal` | no | no | no |
| `OrdersBoard`, `ChapterList`, `StageList` | no | no | no |

Most of those are fine — three events, two orders, one chapter, five stages.
**`TeamPicker` is the exception that matters**: it lists the player's entire
owned roster, it is opened **before every single fight**, and it has neither
search nor sort — while the archive, which is browsed idly, has both.

**The inconsistency states the problem by itself:** the casual screen is better
equipped than the hot path. And it degrades with every banner, since the roster
only grows.

### Q2 — Screens lacking a considered empty state · **low**

`StageList` has no `length === 0` branch. Low impact today (one chapter, five
stages) but it is the kind of gap that surfaces the first time content is
authored wrong.

### Q3 — The two biggest screens do not gate on hydration · **high** · *missed by the first pass*

`store/playerStore.ts` documents `hasHydrated` in its own words: *"True once
zustand-persist has rehydrated from localStorage — **gate any first-paint read of
roster/inventory on this** to avoid a flash of the default starter state ahead of
the real persisted data."*

Eleven components do gate on it — `TeamPicker`, `CharacterBrowser`,
`OrdersBoard`, `BannerScreen`, `TopNav`, `HomeMenu` and others, 44 references in
all. **But the two route pages that read the most player state do not:**

| page | `usePlayerStore` reads | gates on `hasHydrated` |
| --- | ---: | :-: |
| `app/events/page.tsx` | **20** | **no** |
| `app/story/page.tsx` | **7** | **no** |

So on first paint the events board can render against **rank 1 and default
stamina** before the real save arrives — which decides whether a trial shows as
locked, what the stamina bar reads, and which difficulties are offered. It is
exactly the flash the field exists to prevent, on the screen where the
consequences are most visible.

**Fix shape:** gate both pages the way the eleven components already do.

### Q4 — No per-route error or loading boundaries · **medium**

Eight routes (`archive`, `events`, `gacha`, `login`, `news`, `practice`,
`profile`, `story`); **none has `error.tsx` or `loading.tsx`.** Only the root
`app/error.tsx` exists, so any throw anywhere takes out the whole app shell
rather than the screen that failed.

`loading.tsx` matters less here than in a server-data app — state comes from
localStorage and Zustand, which is what `hasHydrated` is for — but a
route-level `error.tsx` on at least `events`, `story` and `gacha` would keep a
failure contained.

---

## Testing

### T1 — Five `lib/game` modules have no tests at all · *missed by the first pass*

| module | lines | source callers | severity |
| --- | ---: | ---: | --- |
| `mechanicQueue` | 106 | **3** | **high** — the passive queue, engine-critical |
| `storyTeam` | 184 | 2 | medium — resolves story lineups and levels |
| `storyBackgrounds` | 174 | 2 | low — mostly a data map |
| `waveDriver` | 53 | 2 | **medium — written 2026-09-16 and shipped untested** |
| `mechanicTemplates` | 174 | **0** | dead (see M3) |

`mechanicQueue` is exercised *indirectly* through battle and simulator tests, so
it is not unverified — but it has no test that fails for its own reasons, which
is a different guarantee.

**`waveDriver` is mine.** I extracted it yesterday specifically so two screens
would share one copy of the wave-fold logic, and then did not test the shared
copy — against his value #2 in the same commit that served it.

---

## Suggested order, if he wants them fixed

1. **Q3** — gate the two pages on `hasHydrated`. Smallest fix in the list, a
   user-visible defect, and the store already documents the rule.
2. **M3** — confirm and delete `mechanicTemplates.ts`. Free, and it stops a
   future session building on something dead. **Needs his yes** — it may be
   unused intent rather than rot.
3. **C5** — the `wave` -> `fight` rename. Cheapest today, most expensive later,
   and it is ruling #137's direct consequence.
4. **T1** — tests for `mechanicQueue` and `waveDriver`, in that order.
5. **C1 + C3** — the button and panel primitives, with guards; they stop new
   drift immediately.
6. **M1** — decompose the events page, mirroring story mode.
7. **C6** — one reward list.
8. **C2** — the letter-spacing scale. **Needs his values first.**
9. **Q1** — search and sort in `TeamPicker`. **Touches UX, so his direction.**
10. **Q4, C4, Q2, M2** — small, or his judgement.

**Nothing here is started.** Everything except 2, 8 and 9 is structural and
Claude's to do on his word; **M3 needs his yes**, **C2 needs his visual
values**, and **Q1 is UX direction** (ruling #139).

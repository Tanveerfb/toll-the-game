# Foundation audit — what is broken, and why nothing caught it

> **Progress, same day (2026-09-26).** His answers, then the work:
>
> | | outcome |
> | --- | --- |
> | **F1** story blank screen | **Moot**: story mode removed (ruling #152), restorable from `2f6b016` |
> | **F2** phase ignores difficulty | **Fixed**. One builder (`lib/game/buildUnit.ts`) and one pipeline (`battleStats.ts`) for battle, simulator and phases; `tests/battleStats.test.ts`, falsified. **Changed trial difficulty:** Lv20 balanced team 77% → 2.2% at the authored Molvarr Lv24. Tuning test parked; **he is playtesting** |
> | **F3** brief prints base stats | **Fixed**, through `battleStats` |
> | **F4** picker shows catalog stats | **Fixed**. He picked **leveled stats** (a selection). Practice's opposing side shows base, which is what it fields. Story-only anchor/trial props removed |
> | **F5** battle outlives its screen | **Fixed** as ruling #153: `BattleOwner`, `BattleLock`, and resume on reload, including the reward card. **Gap:** a reload *between* two trial fights still loses the run |
> | **S1** three copies of the stat path | **Done** with F2 |
> | **L2 / L3** arena state across a retry | **Fixed** in `BattleArena` |
> | S2, S3-rest, P1–P3, L1, T1, Q1, Q4, C2 | **Open**. He will take them one section at a time |

**Run 2026-09-26**, at Tanveer's request: *"if we develop the game without
reworking or improving the foundation, then it's not gonna go well… deep
audit, what's not working with the game or what needs to be optimized."* He
reported two defects to start from — Molvarr's difficulty 2 not scaling, and
story mode going blank after a scene.

The 2026-09-17 audit (`Plans/2026-09-17-code-quality-audit.md`) measured
**UI consistency**. This one is about **correctness of flows**. Both of his
bugs slipped past **1,556 green unit tests, 17 browser tests and a clean
build**, all run today, and they share a cause worth more than either fix.

**Evidence levels, stated per finding:**
- **read**: traced through the code.
- **measured**: numbers taken from the data or a command.
- **reproduced**: seen running.

**Nothing here was reproduced in a browser.** No browser was granted this
session.

---

## The finding under all the others

**No test renders a screen flow.** There are 125 unit test files and **zero**
of them render a component. The 3 browser test files cover a hint, the hand
and the log drawer. `app/story/page.tsx` and `app/events/page.tsx` are state
machines: 9 and 8 view kinds, and every transition between them is a
`setView` inside a callback. **No test drives any of those transitions.** The
tests that touch those pages read their source as **text**, as grep-style
guards. None of them renders the page.

So the suite checks every *rule* thoroughly and no *flow* at all. Both of his
bugs live between two correct pieces:
- **The story bug**: the reader works, and the page is correct, view by view.
- **The Molvarr bug**: the level math works, and so does the phase math.

Neither is wrong on its own. The bug is in the handover between them, and
nothing in the suite looks at handovers.

---

## F — Broken now

### F1 — Story scene stages end on a blank screen, and soft-lock chapter 1 · **critical** · read

Stage 1 and stage 4 of chapter 1 have **no fights** (measured: `s1` intro 6
lines / outro 3, `s4` intro 3 / outro 1). The page sends intro → outro as
`{kind:"scene", which:"intro"}` → `{kind:"scene", which:"outro"}`. **Both
views render `<StorySceneReader>` in the same slot, so React keeps the same
instance and its state.**

- `index` is still 5 from the intro's last line.
- `scenes[5]` does not exist in a 3-line outro.
- `if (!scene) return <div className="flex-1" />` renders nothing.
- `onFinish` never fires, so the stage is never cleared.

`isStageUnlocked` opens stage 2 only when stage 1 is cleared. So **a player
who reads stage 1 instead of skipping it can never progress**, and pays 3
stamina every time they try. The only ways through are Skip ▸▸ or the brief's
skip-story toggle.

**Fix:**
- Key the reader by stage and scene list (`key={`${run.stageId}:${view.which}`}`).
- Make the reader safe on its own: reset `index` when `scenes` changes, the
  same adjust-during-render pattern it already uses for the reveal.
- A test that fails first.

### F2 — A world boss's second phase ignores difficulty and stage effects · **high** · read + measured

`startCustomBattle` builds every unit through catalog → progression (level) →
stage effects (`hooks/BattleProvider.tsx:976`). Phase 1 therefore scales.
**Phase 2 is built by `enterBossPhase` (`lib/game/phases.ts:61`), which copies
the phase's raw JSON stats and skips both steps.**

Measured from `data/characters/molvarr.json`:

| | HP | ATK | DEF |
| --- | ---: | ---: | ---: |
| phase 1, JSON | 8,500 | 285 | 175 |
| phase 1 at difficulty 2 (Lv26, 1.424x) | 12,102 | 406 | 249 |
| **phase 2 at every difficulty** | **10,000** | **400** | **230** |

- **At difficulty 2 and up, the boss gets weaker when it breaks into its
  second phase.** Phase 2 is weaker than the phase 1 that came before it.
- At difficulty 4, phase 1 is 2.0x and phase 2 is still 1.0x.
- A stage effect that buffs the enemy side vanishes at the break too.
- **The simulator has the same bug**, since `lib/game/simulate.ts:342` calls
  the same function. So any `npm run sim` of a leveled boss understates its
  second phase, including encounter tuning against a `playerBand`.

**Fix:** there should be one way to turn a catalog statline into battle
stats, and `enterBossPhase` should go through it (see S1). The unit carries
its level, ascension and stage effects, so a phase can apply them.

*He asked for this one to be put in the roadmap. It is there as well: see
`docs/ROADMAP.md` → Foundation pass.*

### F3 — The boss brief prints base stats at every difficulty · **high** · read

`EventBrief`'s `EnemyCard` renders `enemy.hp / atk / def` straight from the
catalog, while the line under it reads *"Level 26 at difficulty 2"*. So the
brief says the level went up and shows stats that didn't.

That is very likely **what he actually saw**: the brief is the only screen
that puts a level next to stats. Phase 1's real stats in the fight do scale
(F2's table).

**Fix:** render through the same stat function as the battle, at
`enemyLevelForDifficulty(difficulty)`. Show phase 2 as well, since the brief
already knows the phase count.

### F4 — The team picker shows catalog stats, not the player's · **medium** · read

`TeamPicker.tsx:520` prints `character.atk / def / hp`. A Lv30, ascension-2
unit reads the same as a fresh pull. This is the screen opened before every
fight, and the one place a player compares units to choose between them.

**Fix:** read the player's progress and render through the same stat
function.

### F5 — A battle outlives the screen that owns it · **medium** · read

`gameStore` persists the live battle to `sessionStorage` (`toll-battle-session`)
so a reload resumes it. But **the view that owns the battle does not persist**:
story's and events' `view` is plain `useState`.

**After a reload mid-fight:**
- Story and events come back on their list screens.
- The battle is still live in the store, with no screen showing it.
- **`/practice` renders any live battle it finds.** Opening Practice then
  resumes the orphaned story or boss fight with no story or boss handlers, so
  winning it pays nothing and clears nothing. The stamina for that attempt is
  already spent.

**On desktop you do not need a reload.** The bottom tab bar hides during
battle; the top nav does not. So Practice is one click away from any fight.

**Fix:** needs his call on *behaviour* (resume or discard); the structure is
Claude's. The battle records who owns it (`owner: story | event | practice`,
plus ids). Each page resumes only its own battles, and practice shows only
practice.

---

## L — Latent: not broken today, one change away

### L1 — Timed screens restart their timer on every parent render · read

`VersusSplash` and `ChapterTitleCard` run `setTimeout(onDone, 1600)` inside
an effect keyed on `onDone`. Both receive a **fresh inline arrow from the
story page on every render**, and the story page re-renders on every battle
store write (P1).

Nothing writes during those two screens today. The day something does, the
splash never ends.

**Fix:** a ref for the callback, the same pattern `useEscapeKey` should
already use.

### L2 — `autoContinuedRef` is never reset · read

`BattleArena.tsx:325` sets it once and nothing clears it. That is safe only
because every current flow unmounts the arena between two victories. A
retry-into-auto-continue would silently skip `onContinue`.

### L3 — The events page reuses one arena across a retry · read

A boss retry sets `{kind:"battle"}` again, so the same `BattleArena`
instance keeps its open panels, log drawer and detail unit across the new
fight. This is the same class of bug as F1, with milder symptoms.

---

## P — Performance

### P1 — Whole-store subscriptions on hot paths · read

`useX()` with no selector re-renders on **every** write to that store.

| where | store | cost |
| --- | --- | --- |
| `hooks/AuthProvider.tsx:31` | player | **App-wide.** Also passes an unmemoised context value, so every `useAuth()` consumer re-renders on every player-store write |
| `app/story/page.tsx:108` | battle | Every story fight re-renders the page, `BattleArena` and `Deck` on every battle write, including each animated HP step |
| `components/game/Deck.tsx:81` | battle | Every fight, every mode |
| `app/practice/page.tsx:12` | battle | Every practice fight |
| `components/game/DevGrantPanel.tsx:38` | player | Dev only |

**`app/events/page.tsx` already does this correctly** (per-field selectors),
and so do `BattleArena` and `BattleProvider`. This is a consistency gap as
much as a speed one.

**Fix:**
- Selectors, or `useShallow` (used 0 times today).
- Memoise the auth context value.
- Add a guard test forbidding a bare `useXStore()` in `app/`, `components/`
  and `hooks/`.

### P2 — Cloud autosave fires on any player-store change · read

The subscriber in `AuthProvider` debounces **every** change into a full
document write, including device-local fields. It works, but it spends
Firestore writes on changes the cloud never stores. Compare the
`CLOUD_FIELDS` slice before scheduling.

### P3 — The whole battle is serialised on every write · read, not measured

`toll-battle-session` persists teams, decks and the **entire `battleLog`**,
which grows all fight, synchronously on every store write. **This is
unmeasured**, so it is a question rather than a finding. Profile a long 4v4
before touching it.

---

## S — Structure: what would have prevented F1–F5

### S1 — Three copies of "catalog stats → battle stats" · read

1. `BattleProvider.buildBattleChar`: progression, then stage effects.
2. `simulate.buildUnit` + `buildTeam`: the same two steps, written again.
3. `phases.enterBossPhase`: **neither step. This is F2.**

The two display screens (F3, F4) make a fourth and fifth path by skipping it
entirely.

**One function** in `lib/game/` — `battleStats(raw, progression, stageEffects,
side)` — is used by all five, with a test that pins them against each other.
Value #2 (modularization), and the direct cause of F2 to F4.

### S2 — Screen flows are untestable by construction

This is the headline finding above. **Fix:** move each page's view transitions
into a pure reducer:
- `lib/game/storyFlow.ts` and `eventFlow.ts`: `next(view, event) → view`.
- Pages keep rendering and side effects (stamina, rewards).

Then:
- **Unit tests walk every transition.** For example: every stage of chapter 1
  from brief to result, a scene-only stage, a retry, a quit mid-run.
- **One browser test walks chapter 1 end to end** with fights stubbed to a
  win, which is what would have caught F1.

The same shape as `stageRun.ts`, which already made the fight loop testable.

### S3 — The battle has no owner

The structural half of F5. `gameStore` is one global battle with no idea
which mode started it. An `owner` field fixes F5 and makes a mismatch
testable.

---

## Carried from the 2026-09-17 audit, still open

- **Q1** — `TeamPicker` has no search or sort. **UX, so his direction.** F4
  lands in the same file, which makes this a good moment.
- **T1** — no tests for `storyTeam.ts` (184 lines), `storyBackgrounds.ts`,
  `worldBossPreview.ts` or `immunity.ts`.
- **Q4** — no route-level `error.tsx`. A throw in any screen takes the whole
  shell down.
- **M2** — six files over 900 lines:
  - `combat.ts` 1,707
  - `BattleArena.tsx` 1,458
  - `damagePreview.ts` 1,090
  - `BattleProvider.tsx` 1,020
  - `playerStore.ts` 1,003
  - `gameStore.ts` 950

  Size alone isn't a defect. `BattleProvider` is where S1 lands, which is
  the natural moment to split it.
- **C2** — letter-spacing scale. **Needs his values.**
- C3, C4, C6, Q2 — not re-measured today.

---

## Suggested order

Each phase ends with `npm run check` and `npm run test:browser` green, and
nothing ships until he calls it.

1. **Broken now: F1, F2 + S1, F3, F4.** Each fix gets a test that fails
   against the current code first. F1 is the priority: story is unplayable
   for a reader. F2 and S1 are one change. F3 and F4 fall out of S1 for free.
2. **Flows testable: S2.** The story reducer, the events reducer, and the
   chapter-1 walk. This is the actual foundation work, and the thing that
   stops the next F1.
3. **Battle ownership: S3 + F5.** Needs his answer first: **after a reload
   mid-fight, resume the fight or drop back to the brief?**
4. **Performance: P1**, with its guard. Then P2. P3 only after measuring.
5. **Latent: L1–L3.** Small. L3 folds into S2.
6. **Carried items.** T1 and Q4 are Claude's. Q1 and C2 need his direction.

**His calls:**
- The F5 resume-or-discard behaviour.
- Q1 (search and sort in the picker).
- C2 (tracking values).
- Whether F3's brief should show phase 2's stats alongside phase 1's.
  (It's a display choice; the numbers themselves are measurement.)

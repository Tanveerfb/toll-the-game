# Story parts 3–6 — adaptation draft

**Status: DRAFT for Tanveer's review. Nothing here is in `data/story/`.**
Written 2026-08-11 from `E:\Toll - Web toon` (`Master_Context.md`, `Chapter 3–6.md`).
Story is Tanveer's to own — this is a proposed mapping, not a decision.

---

## How the game has been splitting the webtoon so far

| Webtoon chapter | Game part | Game chapters |
| --- | --- | --- |
| Ch1 — Rawspent and Ledger | Part 1 | 4 |
| Ch2 — Lyra | Part 2 | 2 |

So one webtoon chapter becomes one game part, split into however many chapters
its beats support. A game chapter is **scenes → one battle → scenes**, which
means the split is driven by *where the fights are*, not by runtime.

That's the whole problem with the next four, and it's worth saying plainly
before the tables: **webtoon chapters 3, 4 and 6 contain almost no combat.**
Ch3 is arrival, registration and an announcement. Ch4 is travel and
observation — the beat sheet says outright "no fight this chapter." Ch6 is a
debrief. Only Ch5 is a fight, and it's one long one.

**RULED 2026-08-11: chapters may be scene-only**, and still pay first-clear
rewards. That's now built — `StoryChapter.battle` is optional, and such a
chapter runs brief → title → intro → outro → complete → rewards with no
versus splash and no fight.

So the invented battles below are **optional, not load-bearing**. Where a beat
sheet says there is no fight, the honest adaptation is now available. Two
places still argue for promoting a fight anyway:

- Ch4 explicitly shows other candidates fighting across the forest ("a gust of
  wind in one direction, blue electricity somewhere else"). Those candidates
  are unnamed, so making them fightable invents nothing about Duke or Lyra —
  and `frost`, `gale`, `iron` and `prism` are otherwise unused kits that read
  exactly like exam fodder.
- A part of three consecutive scene-only chapters may read as a lull in a game
  where the loop is combat.

Each table below marks which battles are invented, so they can be dropped
individually.

---

## Part 3 — "Welcome to the Ledger Exam" (webtoon Ch3)

Base difficulty 1. Trial level 10.

| Ch | Title | Beats | Battle | Team mode |
| --- | --- | --- | --- | --- |
| 3-1 | The Long Road | Road walk, "2 hours later", cresting the hill, the scale of the venue | Road ambush — a last bandit pair before the city | `anchored` (Duke) |
| 3-2 | Number 22 | Registration montage, number tags, the waiting room | A candidate picks a fight in the waiting room | `anchored` (Duke) |
| 3-3 | Phase One | Tao's announcement, the rules, the 20-qualifier cap | Scuffle at the forest gate as candidates break for the tree line | `anchored` (Duke, Lyra) |

**Proposed enemies:** 3-1 `road_bandit` ×2 · 3-2 `iron` · 3-3 `frost` + `gale`.

**Why anchored, not canon:** part 3 is where the exam turns into a crowd, and
it's the natural first place to hand the player their own team. Duke stays
required throughout; Lyra joins as a second required lead from 3-3, when the
webtoon has them established as a pair.

**Invented content flagged:** the three battles. The webtoon has no fights in
Ch3. 3-2 and 3-3 are the ones I'd most want you to veto or rewrite — putting
Duke in a scuffle before Phase 1 may cut against "keeps a low profile."

---

## Part 4 — "Master of Fire" (webtoon Ch4)

Base difficulty 1. Trial level 12.

| Ch | Title | Beats | Battle | Team mode |
| --- | --- | --- | --- | --- |
| 4-1 | The Zipline | Prepping to leave, the zipline, entering the forest | First contact — a candidate pair mistakes them for easy marks | `anchored` (Duke, Lyra) |
| 4-2 | Someone Else's Fight | The observed fight through the trees, the shared look, moving around it | **Optional/replay-only** — the observed fight, playable as the other candidate | `free` |
| 4-3 | Something Big | Lyra in the tree, the canopy view, spotting the inferno | Something in the forest finds *them* while she's up the tree | `anchored` (Duke) |

**Proposed enemies:** 4-1 `prism` + `gale` · 4-2 `frost` vs `iron` · 4-3 `wild_beast` ×2.

**4-2 is the interesting one.** The webtoon's whole point in that beat is that
Duke and Lyra *don't* engage. Making it a normal chapter battle would break
that. As an optional side-fight — you play the strangers, not Duke — it turns
a passive beat into content without contradicting it. It's also the natural
first `free` chapter, since neither lead is in it.

If that reads as too clever, cut 4-2 and part 4 is two chapters.

---

## Part 5 — "Trial by Fire" (webtoon Ch5)

Base difficulty 1. Trial level 15. **The centrepiece.**

| Ch | Title | Beats | Battle | Team mode |
| --- | --- | --- | --- | --- |
| 5-1 | Round One | Arrival at the blast site, Duke sprints in, no Toll | Duke vs Tao, Toll suppressed | `canon` (Duke alone) |
| 5-2 | The Plan | Lyra approaches, the whispered plan, Toll active | Duke + Lyra vs Tao, tag team | `canon` (Duke, Lyra) |
| 5-3 | Scorched Earth | Tao splits them, Smoldering Palm, Funeral Pyre, the shove | Duke vs Tao while Lyra is down | `canon` (Duke) |
| 5-4 | The Combination | Lyra retrieves the bow, the arrow lands, full ignition, red ice + water | Duke + Lyra vs ignited Tao | `canon` (Duke, Lyra) |

**All four canon.** This is the fight the arc has been building to and the one
place the player shouldn't be able to bring a preset. It's also the strongest
existing case for **stage effects** rather than new kits:

- 5-1: `statBoost` player −50% ATK (Toll suppressed — the round exists to
  establish the gap, and it should feel like it)
- 5-3: `bonusActions` enemy +1 (Tao has split them; Lyra is out)
- 5-4: Tao at a raised **enemy level** rather than a second kit

**RULED 2026-08-11: ignited Tao is a levelled version, not a second phase.**
`master_tao` (2900/300/140) gets a `level` on the enemy pick — the field now
exists and runs the same curve as everything else. No second kit, no phase
table, nothing to keep in sync.

---

## Part 6 — "Aftermath" (webtoon Ch6)

Base difficulty **2** — first part in the raised band.

| Ch | Title | Beats | Battle | Team mode |
| --- | --- | --- | --- | --- |
| 6-1 | Debrief | Admin room, drone monitors, Tao debriefs them individually | Sparring rematch with Tao, no stakes | `anchored` (Duke) |
| 6-2 | Phase Two | Transport back, the Phase 2 glimpse, the official cut off | A Phase 2 warm-up bout | `free` |

**RULED 2026-08-11: the Seris closing scene gets no battle.** It's a
three-line reveal whose whole job is intrigue; a fight there would tell the
player she's a boss, which is exactly what the beat sheet says not to do
("audience intent is intrigue only, not villain identification"). It goes as
**outro scenes on 6-2**.

With scene-only chapters now supported, 6-1 (the debrief) is also a strong
candidate for having no fight at all — the sparring rematch below is invented
and easily cut.

That does mean part 6 is the thinnest of the four, which is honest — Ch6 is a
comedown chapter.

---

## Account XP continuing the ramp

Existing: p1 10/11/12/13, p2 15/16. Keeping the gentle rise:

| Part | Chapters | XP each |
| --- | --- | --- |
| 3 | 3-1 … 3-3 | 18 / 19 / 20 |
| 4 | 4-1 … 4-3 | 22 / 23 / 25 |
| 5 | 5-1 … 5-4 | 28 / 30 / 32 / 40 |
| 6 | 6-1, 6-2 | 45 / 50 |

Totals 352 XP across parts 3–6 on first clear. Worth being blunt: that's a
third of the way to rank 4. **First clears will never be the ladder** — with a
10%-compounding bar, world boss (and whatever PVE follows) does that work.
These numbers are for feel, not pacing.

---

## What I did not do

- **Nothing written to `data/story/`.** No part 3–6 JSON, no chapter ids.
- **No dialogue drafted.** Every scene above is a beat reference, not written
  lines. Scene text is yours; I'd be inventing voice.
- **No new characters.** Every proposed enemy already exists as a kit.
- `UPCOMING_PARTS` in `lib/game/storyCatalog.ts` still lists parts 3–6 by name
  and the index still renders them as a count, unchanged.

## Open questions

Resolved 2026-08-11: scene-only chapters are allowed and built; ignited Tao is
a levelled `master_tao`; the Seris scene gets no battle.

Still open:

1. **Which of the invented battles survive?** Every one is marked above and
   can be cut individually now that scene-only chapters work.
2. **When does `anchored` start?** I've proposed part 3. Everything before it
   stays `canon`, which matches "Part 1 is Duke alone and must stay that way."
3. **Is 4-2 (play the strangers) too clever?** It's the one beat where the
   player isn't Duke or Lyra.
4. **Candidate NPCs** — `frost`, `gale`, `iron`, `prism` are unused kits that
   fit exam fodder. Are they intended as exam candidates, or something else?

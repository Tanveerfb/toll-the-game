# Economy audit — every source against every sink

> Run 2026-08-13 at Tanveer's request, after he noticed Bureau Orders were
> paying too many gems: *"i still have 3k and i went 2 cycles through the banner
> already."*
>
> Every number here was computed from the shipped data — `data/orders/*.json`,
> `data/story/*.json`, `lib/game/worldBossRewards.ts`, `lib/game/leveling.ts`,
> `lib/game/ascension.ts`, `lib/game/stamina.ts` — not from the design docs,
> which have drifted before.
>
> **Retuned 2026-08-13, all on his call.** Order gems 4,600 → 1,500; story gems
> 6,430 → 1,140 against a 3,000 budget for the finished 24-part story; Molvarr
> tier-1 Training Manuals 3-6 → 4-8 (and tiers 2-4 shifted to stay monotonic).
>
> His framing for the size of these moves, and the reason none of them go
> further: *"i will add more events in the future to daily grind out coin,
> manuals and other stuff... there will be more bosses, more PVE content in
> general later... you don't have to 'donate' resources right now across current
> content. a frugal dev and dev helper (you) is good to have right now."*

## The headline

The gem complaint was real but it was not the biggest problem, and Bureau
Orders were never the main gem faucet — story was, at 56% of all gems, and its
values had never been totalled.

**Manuals are the binding constraint on the entire game, by a factor of ten.**
That is a finding, **not a defect**. Tanveer, 2026-08-13: *"level 40 is the hard
grinder ceiling... right now? i don't want anyone to grind all of their
characters to lvl 40 easily."* The wall is the pacing. What this audit is
actually for is checking that the **first** band stays reachable while the top
one stays expensive — see §2.

## 1. Gems

### Sources — all one-time, none repeatable

| Source | Before | **Now** |
| --- | ---: | ---: |
| Story first clears (12 parts / 37 chapters) | 6,430 | **1,140** |
| Bureau Orders (20) | 4,600 | **1,500** |
| Molvarr first clears (5 tiers: 0/50/75/100/150) | 375 | 375 |
| **Lifetime total, content that exists** | 11,405 | **3,015** |
| **Projected at 24 parts** | — | **4,875** |

### The story gem budget — all 24 parts

The finished story is **24 parts** (Tanveer). Twelve exist, holding 37
chapters. The whole story is budgeted at **3,000 gems**, ramping in six tiers of
four parts so later parts pay better without the tail running away:

| Parts | Gems per part | Subtotal |
| --- | ---: | ---: |
| 1–4 | 70 | 280 |
| 5–8 | 95 | 380 |
| 9–12 | 120 | 480 |
| 13–16 | 140 | 560 |
| 17–20 | 155 | 620 |
| 21–24 | 170 | 680 |
| **Total** | | **3,000** |

Parts 1–12 are authored to **1,140**; parts 13–24 hold the remaining **1,860**.
**Author future parts against this table** — it exists so the next twelve parts
don't get improvised the way the first twelve were.

Repeatable gem sources: **none.** Ruling #80 made gems first-clear only,
game-wide.

### Sinks

| Sink | Gems |
| --- | ---: |
| Single pull | 5 |
| Multi (11 pulls) | 50 |
| First milestone | 500 spent |
| Full milestone lap | 1,000 spent |

**3,015 gems today = 60 multis = 660 pulls = 3.0 milestone laps.** At the full
24 parts it becomes 4,875 = 97 multis = 1,067 pulls = 4.9 laps. Before the
retune it was 8.3 laps from content that already existed.

### What this means

- **Orders were never the faucet.** At 4,600 they were 40% of supply against
  story's 6,430 at 56%. Cutting orders alone would have moved lifetime supply
  from 11,405 to 8,305 — a 27% reduction aimed at what merely *looked* like the
  cause. Story had to move too, and did.
- **Story's values had never been totalled.** 6,430 across 37 chapters averaged
  174/chapter, authored per-part across several sessions with no running sum.
  That is how a number gets to 4× its intended size without anyone deciding it
  should. The budget table above exists so it cannot happen again for parts
  13–24.
- **The supply is finite and front-loaded.** A player who finishes the story has
  spent the gem economy — there is no repeatable gem income at all. Fine while
  the shop is unbuilt; a real question the day it ships.

## 2. Manuals and levelling — the actual bottleneck

### The cost of one character, Lv1 → Lv40

`xpToNext(level) = 100 * level`, so the full climb is:

| | |
| --- | ---: |
| XP required | **78,000** |
| Coin at 2/XP | 156,000 |
| = Training Manuals (100 XP each) | **780** |
| = Advanced Manuals (400 XP each) | 195 |

### Against the farm

Molvarr tier 1 pays **4–8 Training Manuals** per clear (avg 6) for 40 stamina —
raised from 3–6 on 2026-08-13. Stamina regenerates 288/day, so **7.2 runs/day**,
so **~43 manuals/day**.

| Target | Manuals | Before (3–6) | **After (4–8)** |
| --- | ---: | ---: | ---: |
| Lv1 → **Lv20** (one ascension band's worth) | 190 | 5.9 days | **4.4 days** |
| Lv1 → **Lv40** (the current ceiling) | 780 | 24.1 days | **18.1 days** |

### At team scale — the number that matters

Nobody levels one character. A team is four.

| Who | To Lv20 | To **Lv40** |
| --- | ---: | ---: |
| One character | 4.4 days | 18.1 days |
| **A team of 4** | **17.6 days** | **72.2 days** |
| Eight characters | 35.2 days | 144.4 days |
| All 27 | 118.7 days | 487.5 days |

This is the shape Tanveer asked for. The first band is a fortnight-ish for a
full team, so a new player can field a levelled squad; Lv40 across that same
team is over two months, and mass-Lv40ing the roster is not a thing anyone will
do by accident. **The 4–8 bump moved the team-to-Lv40 figure from 96 days to
72** — still a hard ceiling, with the early climb meaningfully softer.

### Compare that to everything else

| Resource | Needed for one built character | Days of farming |
| --- | ---: | ---: |
| **Training Manuals** | 780 | **18.1** |
| Coin | 241,000 | 5.6 |
| Sea Monster's Eye | 19 | 2.4 |
| Corroded Seaweed | 50 | 1.7 |

The ascension materials — the resources the world-boss design was built to gate
progression with — remain **seven to ten times less binding than manuals** even
after the bump. A player is never waiting on eyes or seaweed. They are always
waiting on XP.

**The bump was deliberately partial, and the remaining gap is intentional.**
Levers 3 and 4 below (Advanced Manuals in the tier-1 farm, flattening the XP
curve) were left unpulled *on purpose*: both attack the Lv40 tail, which is the
grind Tanveer wants to keep. Re-run this table when daily events land, but treat
a shrinking Lv40 number as a regression to question, not a win.

### Why this matters more since ruling #85

Ascension used to be materials-only, so the 24-day XP wall could be skipped
entirely — a Lv1 character could be carried to ascension 4. Adding the level
gate was correct, but it means **the manual bottleneck is now mandatory rather
than optional**. The fix and this finding are the same day; they should be read
together.

One-time sources barely dent it: story and orders together pay **153** Training
Manuals and **21** Advanced (= 23,700 XP), against 78,000 XP for a single
character. Roughly **30% of one character**, across the entire game's one-time
content.

### Levers, if this should change

Any one of these closes the gap; they are alternatives, not a list to apply
together.

1. ~~**Raise the manual drop count** on Molvarr tier 1~~ — **done** 2026-08-13,
   3–6 → 4–8. Partial by design; see above.
2. **Daily events.** Tanveer's own plan, and the right answer: manuals from a
   repeatable daily source rather than a bigger boss drop. Nothing to do here
   until they exist.
3. **Put Advanced Manuals in the tier-1 farm.** Worth 4× each; they currently
   enter at tier 2. Trades against the "higher quality, not more" principle that
   shapes the tier ladder, so it is a real design cost, not a free lever.
4. **Flatten the XP curve.** `100 * level` means Lv39→40 alone costs 3,900 XP —
   39 manuals for one level. A gentler curve fixes the tail without touching any
   drop table.

**Still open: what is the intended level ceiling right now, Lv20 or Lv40?** At
Lv20 the wall is 4.4 days and nothing further is needed. At Lv40 it is 18. The
answer decides whether levers 3 and 4 are wanted at all, which is why neither
was applied.

## 3. Coin

| | |
| --- | ---: |
| One-time sources (story 183k + orders 28k) | 211,000 |
| Molvarr tier 1 farm | ~6,000/clear → **43,200/day** |
| One character fully built (levelling 156k + ascension 85k) | 241,000 |

Coin is **not** a constraint: 5.6 days of farming covers a whole character, and
the one-time sources nearly cover one on their own. It is the healthiest number
in the audit and needs no change.

## 4. Ascension materials

| | Eye | Seaweed |
| --- | ---: | ---: |
| Needed, bands 1–3 | 19 | 50 |
| Tier-1 farm per day | 7.9 | 29.5 |
| Days | 2.4 | 1.7 |

Both comfortable, and the 2026-08-13 seaweed change (base 2 → 4) did its job —
the ratio now roughly matches what ascension asks for, where before seaweed was
the sole gate.

## 5. Stamina

| | |
| --- | ---: |
| Cap | 120 |
| Regen | 1 per 5 min = 288/day |
| Molvarr run | 40 |
| Runs per day | 7.2 |
| Runs from a full bar | 3 |

Stamina is the master clock — every farm number above is derived from it. Worth
noting the cap holds only 3 runs, so a player who cannot check in twice a day
loses regen to overflow.

## 6. Auto Clear Tickets and Permanent Tickets

- **Auto Clear Tickets:** 10 from orders (my 6/4 split, still awaiting his
  review) + 5 per account rank-up. Each skips one fight at full stamina cost, so
  they can never inflate supply — they buy time only, and are safe by
  construction.
- **Permanent Tickets:** 2 from orders, 1 per Molvarr first clear. They buy
  nothing today and are **accruing on purpose** — a shop is planned (Tanveer,
  2026-08-13). Do not repurpose them.

## Open questions for Tanveer

1. ~~What is the intended level ceiling?~~ **Answered 2026-08-13: Lv40 is the
   hard grinder ceiling, and mass-Lv40 should NOT be easy.** The 18-day
   single-character / 72-day full-team figure is therefore working as intended.
   Do not "fix" it.
2. ~~Should story's gems be audited too?~~ **Answered** — retuned to a 3,000
   budget across the finished 24 parts.
3. **Is a finite gem supply intended?** Still finite: 4,875 lifetime at 24
   parts, with no repeatable source. Fine today, a real question the day the
   shop ships.
4. **Molvarr tiers 2–4 reward numbers are still mine**, placeholders from
   2026-08-13, now including the raised manual ranges (6–11 / 9–15 / 13–21).
   Tier 1 is his.
5. **Which Bureau Orders pay Auto Clear Tickets is still my 6/4 split**,
   unreviewed.

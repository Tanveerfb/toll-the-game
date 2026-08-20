# Filler drafts — proposals, approvals and rejects

Every piece of invented story content proposed for the game lands here first,
whether or not it survives. Approved items are copied to
`Filler/Approved_chapter_N.md`; **rejects stay here with the reason**, because the
rejects are what stop a later chapter re-proposing the same idea.

Written and maintained by the `FillerAssist` skill. The rules it works under are
ruling **#108** in `docs/HANDOFF.md` and the filler paragraph in `AGENTS.md`.

**Status vocabulary:** `proposed` · `approved` · `rejected` · `revised`.
Every item states *why the game needs it* and *what canon claim it touches* —
and the second answer should always be "none".

---

## Chapter 1 — "Rawspent and Ledger"

Canon source: `E:\Toll - Web toon\Chapter 1.md`. Shipped in
`data/story/chapter-1.json` on 2026-08-18 as part of the story mode v2 rebuild.

> **These items shipped to `master` before approval** — the rebuild needed a
> chapter in the game to prove the shell worked, and the deploy is live. They are
> in the game *provisionally*. Anything rejected below gets pulled or rewritten.

### Stage 1-1 "The World That Toll Built" — canon, no filler

Scene stage, 6 intro + 3 outro scenes drawn from the chapter's own opening.
Nothing invented. **No approval needed.**

### Stage 1-2 "The Wilderness Answers" — `proposed`

- **Kind:** battle, 2 waves (1 beast → 2 beasts). Stamina 5.
- **What it is:** Duke's training years, played rather than narrated. Wilderness
  animals, no named opposition.
- **Why the game needs it:** stage 1-1 and 1-4 are both scene stages. Without
  this the chapter's first playable fight is the boss, and the player reads for
  two stages before touching a card.
- **Canon touched:** none. The chapter establishes nine years of training and
  does not enumerate what he fought.
- **Deliberately not proposed:** a raid on the village. Canon has Duke **away**
  during the raid; staging it as a playable fight would contradict the chapter.
- **Enemy:** `wild_beast`, a generic `storyOnly` kit. **Numbers are his** — bands
  for `storyOnly` are unassigned at `docs/design/KIT_DESIGN.md:83`.
- **Missions:** m1 no losses (3 gems) · m2 within 10 turns (3 gems).

### Stage 1-3 "Nine Years" — `proposed`

- **Kind:** battle, 2 waves (2 + 2). Stamina 6.
- **What it is:** the back half of the training years — the same wilderness,
  harder.
- **Why the game needs it:** one fight does not teach wave attrition. The second
  battle stage is where a healer or a sub first has a reason to exist.
- **Canon touched:** none.
- **Missions:** m3 clear both waves (3 gems) · m4 finish a wave with an ultimate
  (3 gems).

### Stage 1-4 "The Notice" — canon, no filler

Scene stage, the Ledger Bureau notice arriving. From the chapter. **No approval
needed.**

### Stage 1-5 "Where the Traffic Thins" — `proposed`

- **Kind:** boss, 3 waves (2 → 2 → 1). Stamina 9. Clearing it unlocks chapter 2.
- **What it is:** the road out. Opportunists on a thinning trade route, the last
  wave a single stronger one.
- **Why the game needs it:** a chapter needs a climax stage to end on, and canon
  chapter 1 ends on a departure rather than a fight.
- **Canon touched:** none — an incident on a journey the chapter states happens,
  with no named character and no outcome that changes anything downstream.
- **Missions:** m5 no losses (3) · m6 within 14 turns (3) · m7 two ultimates (2).

### Chapter 1 economy

| | Gems |
|---|---|
| First-clear bundles across 5 stages | 50 |
| Missions (7 across 3 stages) | 20 |
| **Total** | **70** |

Matches tier 1 of the `docs/design/ECONOMY_AUDIT.md` table (70 per chapter for
chapters 1–4). Farm pays coin and training manuals only — no gems, per #47/#80.

### Stage 1-3 "Nine Years" — revised 2026-08-21

Wave 2's beasts became **Ford Bandits** (2 units). The training years now include
one human encounter, which is what makes the beasts in wave 1 read as a different
kind of problem. Canon touched: none — the chapter states nine years of solo
wilderness training and does not enumerate what he fought.

Mission `m4` changed from an ultimate goal to **"Play four Rank 2 cards"**, the
first use of the `useSkillRank` goal added the same day.

### Stage 1-5 "Where the Traffic Thins" — rebuilt 2026-08-21, `approved`

Was three waves of `road_bandit`, ending on a level-12 `road_bandit` — the same
mook as wave 1 wearing a bigger number. Rebuilt as **the checkpoint**, his design:

| Wave | Enemies |
|---|---|
| 1 | 2 × Ford Bandit — opportunists at the crossing |
| 2 | Bruiser, Enforcer, Bruiser — the muscle on the barrier |
| 3 | Enforcer, **the Toll Collector**, Bruiser |

**What it is:** a licensed Ledger running an unofficial checkpoint on a road
nobody watches, charging travellers to pass. Duke breaks it and walks on — to go
and get the same licence.

**Why the game needs it:** the chapter's climax was a recoloured mook, and waves 2
and 3 are the game's first **three-enemy** fights (his ask). Thematically it is
the only thing chapter 1 can show Duke about what a licence actually buys, and it
touches no thread: no name, no raid connection, no outcome that carries.

**Canon touched:** none. An incident on a journey the chapter states happens.

**Bleed resolved 2026-08-21:** the Enforcer's Bleed is **1 turn**, as he
originally specified. Ruling #52 amended — 2 is the default, not a roster-wide
mandate.

**Changed without being asked, flagged for reversal:**
- `teamMode` **`canon` → `anchored`**. Every other chapter-1 stage fields Duke
  alone; against three enemies that is 2 player actions against 3, at the
  chapter's hardest fight. `anchored` keeps Duke fixed and lets the player bring
  their own units, which is what makes a three-enemy wave a fight rather than a
  wall. One field to flip back.
- The Toll Collector is **not `tier: "elite"`** — proposed, then **confirmed by
  him 2026-08-21** (*"collector isn't a elite"*). Elite would hold him at 3
  actions after his escort dies; his passive is built to fade as they fall, and
  elite would fight that design. The fight thins out rather than escalating,
  deliberately.

**Missions rebuilt** to the types he asked for, gems unchanged at 8:
`Play five Rank 2 cards` (3) · `Clear within 12 turns` (3) · `Fire three
ultimates` (2). Chapter total still **70**, matching tier 1 of `ECONOMY_AUDIT`.

### Open for his decision

1. Do 1-2, 1-3 and 1-5 stay, as drafted?
2. `wild_beast` and the 1-5 opposition need **his kit numbers**, and
   `storyOnly` bands are still unassigned.
3. Filler depth: currently the lightest register — unnamed opposition, no
   dialogue put in a canon character's mouth beyond travel small talk.

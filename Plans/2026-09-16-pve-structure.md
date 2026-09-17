# PVE structure — Tanveer's vision, in his words

**A dictated planning session, 2026-09-16 to 09-17.** Taken during a deliberate
pause after the first ascension-trial build — ruling #136 is marked PROVISIONAL
for exactly this reason. His purpose, in his words:

> *"This brainstorming session is between me and you so that you can also learn
> my vision, how I think, what I think, and what's in the plan, so that there's
> no gap in how we both think on some levels."*

**Read this before designing any PVE content.** It carries what the repo cannot:
how he thinks about categories, difficulty, counterplay and ownership.

**His words are quoted verbatim.** Anything outside a quote is Claude's reading
and can be wrong. He dictates long messages by speech-to-text, so transcription
artifacts are expected — the meaning is his, the spelling may not be.

## Index

| # | Point | Status |
|---|---|---|
| 1 | World boss is a category, not just Molvarr | **ruling #137** |
| 2 | A stage may hold several fights; each starts clean | **ruling #137** |
| 3 | Stage / fight / wave / phase are four things | **ruling #137** |
| 4 | The events board is sectioned by category | open — "later" |
| 5 | Visible and playable are independent states | re-confirms #127 |
| 6 | Ascension trial stage one, fight by fight | **#136, provisional** |
| 7 | Story — the open problem | unsolved, parked |
| 8 | Story is parked; what he thinks already works | memory |
| 9 | He tunes kits directly; a big number is often the point | **ruling #138** |
| 10 | Power Strike — his planned counter to high DEF | `ARCHITECTURE.md` |
| 11 | Power Strike adopted; rate settled | `ARCHITECTURE.md` |
| 12 | Its ultimate ladder, and DR as its counter | `ARCHITECTURE.md` |
| 13 | Counterplay cycles, not balance patches | **ruling #138** |
| 14 | The division of work | **ruling #139** |
| 15 | How the mobile work actually succeeded | `AGENTS.md` |
| 16 | Consistency is measurable, and already drifting | audit follow-up |
| 17 | His three engineering values | **ruling #139** |

**What graduated where.** Rulings **#137** (the taxonomy and the two stage
shapes), **#138** (dominant strategies are missing counters) and **#139**
(ownership, and the three values) are in `docs/HANDOFF.md`. The working-style
half of #138 and #139, plus the plan-first lesson from point 15, are in
`AGENTS.md`, which loads automatically. Power Strike's rate and semantics are in
`docs/ARCHITECTURE.md`'s glossary. **This document stays the long-form record** —
the ledger carries intent, this carries his reasoning.

**Still open and his:** the ascension-trial structure (point 6), how the events
board is sectioned (point 4), the story adaptation (point 7), and every value on
every dial discussed below.

---

## 1. A world boss is its own category, and it is not the model for PVE

> *"Right now, Molvarr fight is a world boss stage. That's basically like a
> different category than what should be the other PVE content. So don't take
> Molvarr as an example, a good example right now, because that's like a
> special case. And also any other boss, I consider that a world boss battle.
> So it's going to be like one main boss that may or may not have phases, but
> more often than not they will have phases."*

**What it settles:**

- **World boss is a category, not an instance.** Molvarr is one member of it,
  not the definition of PVE content. Any future single-boss encounter belongs
  to the same category.
- **Shape of the category: one main boss**, typically **multi-phase**. Phases
  are the norm, not the exception.
- **Molvarr is not a reference for the rest.** Do not generalise from him when
  designing stages or events — his structure, rewards and Auto Clear
  eligibility are all special-case.

**What it means for the code as it stands:**

- `EventKind` is currently `"boss" | "trial"`. His framing says `boss` is
  already a real category with a defined shape — one elite, usually with
  `phases` — rather than a label Molvarr happens to carry.
- Today **only `molvarr` and `lyra_npc` carry `tier: "elite"`**, and only
  `molvarr` has `phases` (2). So the category has exactly one member built.
- The world-boss reward table (`lib/game/worldBossRewards.ts`), the
  per-difficulty tiers, and Auto Clear eligibility are all bound to this
  category. The trial work already split trials off that reward path, which
  now reads as the first step of this same separation rather than a one-off.

**Open, not yet asked:** whether "world boss" implies the rest of Molvarr's
apparatus — the world-level difficulty ladder, ascension-material drops, Auto
Clear — or just the *fight shape*.

*(He confirmed **phases**. He dictates by speech-to-text, so expect
transcription artifacts throughout this document — the meaning is his, the
spelling may not be.)*

---

## 2. A stage may contain several fights, and each fight starts clean

> *"This ascension would not be a normal stage. Ascension would be a
> multi-fight stage. If you want an example from other games, from Dokkan
> Battle, you can say it is like Super Battle Road, like I showed you. So it is
> a map. You fight one boss, aka fight one. Then you exit that fight, then you
> go to the next fight and start that fight.*
>
> *Now this will not be like — so if you are ending first fight at turn five,
> the next fight you start is gonna be turn six. No. The next new fight will
> always be basically like how we start new fights, right? It's a brand new
> fight, it's not continuing, it's not a phase. So it's going to be like that.*
>
> *Now one stage can have multiple fights. Yes. It can have multiple fights. It
> doesn't work the other way. I was thinking it may work the other way."*

**What it settles:**

- **"Multi-fight stage" is a stage type**, distinct from a normal stage. The
  ascension trial is one; a normal stage is not.
- **Containment is one-directional.** A stage may hold several fights. The
  inverse does not hold — he considered it and rejected it.
- **Every fight starts clean.** The turn counter does **not** continue: ending
  fight 1 on turn 5 does not open fight 2 on turn 6. A new fight is started the
  way any fight is started.
- **A fight is not a phase.** Phases live inside one fight (`CharacterPhase`,
  Molvarr's two, point 1). Fights are separate battles inside a stage. Two
  different layers, and the distinction is deliberate.

**Already true in the engine — verified, not assumed.** `startCustomBattle`
rebuilds every unit per fight: `ultGauge: 0`, `buffs: []`, `debuffs: []`,
`passiveState: {}` (`hooks/BattleProvider.tsx:1011`), and `playerTurns` resets
to 0 (`store/gameStore.ts:436`). The only thing that crosses a fight boundary is
`carryHp` — and death, which is permanent for the run. So "brand new fight,
only HP stays" is what the code already does.

**A consequence worth his eye:** because the ult gauge resets too, a player can
**never open fight 2 or 3 with a charged ultimate**. On a stage that ends in a
boss, the boss fight always begins at zero gauge. That is a real difficulty
lever and it currently points one way only — not raised as a problem, just as
something that follows from the rule rather than from a decision.

**Vocabulary mismatch to settle eventually:** he says **fight**; the code says
**wave** (`StoryWave`, `waveIndex`, `waveEnemies`, `TrialRail`'s "Fight N of
M"). Same thing. Worth aligning on his word, since the player-facing text
already does.

**Open:** what "it doesn't work the other way" rules out. Most likely that one
fight cannot span several stages — i.e. a stage is always the outer container.
Asked; awaiting confirmation.

---

## 3. Fight, wave and phase are three different things

Correcting an assumption I had made — that "wave" was just the code's word for
his "fight". It is not.

> *"I think wave is still different than a separate fight or a phase… A phase
> would be something like, you know how demonic beast battles work in Seven
> Deadly Sins Grand Cross? I would call that a phase fight. Same with Molvarr.
> So technically Molvarr has two phases.*
>
> *But wave is basically a group of enemies, a new set of enemies appearing.
> Phase is just a single enemy transitioning to a new state, basically, right?
> So a wave of enemies can also be part of something we can introduce — it just
> means loading more characters as the enemies, so four at a time or three at a
> time. Which could be a thing, but **I don't think we should lean towards
> that** for now.*
>
> *So a world boss fight, for now, a single stage with a single fight — which
> I will let you know what content would be covering that. And ascension trial,
> which is going to be like multiple fights in a single stage. It's more like a,
> I don't know, marathon fights you can say, in ascension."*

### The taxonomy

| Term | Means | Exists today? |
| --- | --- | --- |
| **Stage** | The container a player selects from a board. Holds one or more fights. | Yes |
| **Fight** | A whole separate battle. Starts clean — new turn count, no buffs, no ult gauge (point 2). Only HP and death carry. | Yes — but **misnamed "wave"** in code |
| **Wave** | A **new set of enemies appearing inside one fight**. Reinforcements, three or four at a time. | **No.** Reserved, deliberately not built |
| **Phase** | **One enemy transitioning to a new state** inside one fight. Molvarr's two. Reference: 7DSGC demonic beast battles. | Yes — `CharacterPhase`, one kit uses it |

The line between the last two is the useful one: **a wave changes how many
enemies there are; a phase changes what one enemy is.**

### The two stage shapes he named

- **World boss** — **a single stage with a single fight**, that fight usually
  carrying phases (point 1). He will say which content falls under this.
- **Ascension trial** — **several fights in a single stage**. His word for the
  feel: *"marathon fights"*.

### Consequence: the code's "wave" means his "fight"

`StoryWave`, `waveIndex`, `waveEnemies`, `waveTeam`, `applyWaveOutcome`,
`WaveBreak`, `foldWaveFromBattle` — **every one of these means a separate
fight**, which is his *fight*, not his *wave*. The player-facing strings already
say "Fight N of M"; the code is the odd one out.

That naming is now actively dangerous rather than merely untidy: the moment
real waves are introduced, `wave` is already taken by the thing one level up,
and a future session reading `waveEnemies` would reasonably expect
reinforcements. **Recommend renaming the wave vocabulary to fight before any
more content is authored against it** — his call, not started.

### A partial wave already exists, by accident

Enemy sub promotion is a small version of his wave: `promoteSubs` runs on both
teams, so a 4th enemy authored with `isSub` walks on when a field enemy dies.
The trial's first fight (Frost/Gale/Prism + Iron benched) already uses it. It is
capped at the field limit and triggers only on a death, so it is not the
general mechanic — but the engine is not starting from nothing if he ever wants
it.

---

## 4. The events page is sectioned by category

> *"Right now World Boss only has Molvarr, and it is the only boss we have so
> far. So that's gonna be that one. We can categorize the events page later. So
> world bosses have their separate section, and all other categorized content
> has their own section, so that it's not confusing for both of us and our
> players.*
>
> *For example, ascension trials will have a dedicated section, and it will
> only be active when one is eligible to fight the battle, and there's one
> unlocked. So right now ascension trial one will not be available until the
> player reaches level 20. And the next one will be shown but it will not be
> able to play until player reaches level 40 — I think, was it 30 or 40."*

**What it settles:**

- **The board is grouped by category, not a flat list.** World bosses in one
  section, each other content type in its own. Stated reason: *"so that it's
  not confusing for both of us and our players"* — the categories are for
  authoring as much as for the player.
- **World boss has exactly one member: Molvarr.** Confirmed, and that is the
  whole category for now.
- **A section is only active when something in it is live** — the ascension
  section when a trial is both eligible and unlocked.
- **Timing: "later."** He is describing the target shape, not asking for the
  page to be rebuilt now.

**40 is correct.** He was unsure between 30 and 40: `RANK_WALLS = [20, 40]`,
bands of `RANK_BAND_SIZE = 20` to `MAX_ACCOUNT_RANK = 60`
(`lib/game/accountRank.ts`).

**This re-confirms ruling #127, it does not change it.** His 2026-09-01 words
were *"First ascension unlocks when account level is 20 but visibility stays
there from level 1 onwards. The second ascension will show up if both of the
following conditions are met: Account level 21+ and first ascension cleared. It
unlocks only at next level cap (40)."* Today's description — first not
available until 20, second shown but unplayable until 40 — is the same shape,
and the visibility preconditions on the second (rank 21+ **and** first cleared)
stand unaltered. Authored exactly that way in `lib/game/events.ts`. **Nothing to
re-decide.**

**Two different 20s, and they are unrelated.** The trial is gated on **account
rank 20**; it was tuned against a team of **character level 20** units. Those
are separate ladders that happen to share a number, and the coincidence is a
trap for anyone reading either figure later.

**What the board does today:** `GAME_EVENTS` is a flat array rendered in
declaration order, with `isEventVisible` filtering rows. There is no grouping
and no section concept. So sections are new work — small, but not free.

---

## 5. Visibility and availability are two independent states — and he authors both

Correcting his own wording in point 4, not the substance.

> *"No no no. So there's going to be two states of how an event is shown. An
> event can be visible on the events menu — or stage, is what I mean — but
> whether it's available to be played or not, aka whether it is locked or
> unlocked, depends on the unlock conditions. And again, the visibility also
> depends on certain conditions.*
>
> *I will always tell you when that quest will be available to be shown and
> accessed, so don't worry about that — but keep that in mind.*
>
> *For now, Molvarr's fight will not be visible or available unless a player
> clears chapter, I think 9 was it. But right now, since we don't have chapter 9
> coded into the game, it's fine. We can just use Molvarr fight as dev-only
> testing right now."*

**What it settles:**

- **Two independent states, each with its own conditions**: *visible on the
  board* and *playable*. Neither implies the other, and both are authored.
  This is ruling **#127** restated, and it now reads as a general rule for all
  PVE content rather than a per-event quirk.
- **He supplies both conditions for every piece of content.** *"I will always
  tell you."* So never infer a gate from a pattern in the existing events —
  ask, or wait. Matches the standing memory that he asked to be asked.
- **Molvarr's real gate is a chapter 9 clear**, both for visibility and for
  entry. He was unsure of the number; `visibleWhen: { clearedChapter: "c9" }`
  is what is authored, from his 2026-09-01 answer *"Its chapter 9."*
- **Until chapter 9 exists, Molvarr is dev-only testing**, and that is
  acceptable to him.

**Already the behaviour — verified.** `isEventVisible` treats a gate naming an
unauthored chapter as **inert**, so Molvarr is visible and playable today and
the gate starts biting the day `c9` lands in `data/story/`. One of twelve
chapters is adapted. Nothing to change.

**One honest gap in "dev-only".** There is no dev-only mechanism — no build
flag, no account check. "Inert gate" means *visible to everyone*, so on the
deployed build any player reaching the events page can fight Molvarr. That is
identical to what he described in effect, and harmless while there is no
audience, but it is not literally dev-only. If it ever needs to be, that is a
mechanism the game does not have.

---

## 6. Ascension trial, stage one — the three fights in detail

> *"There are going to be three fights in that stage. First fight is going to
> be four enemies total. Now we did decide on who will be fighting, but we have
> not decided what the difficulty will be and what their order is going to be —
> like who are we actually facing as the first three, and then who's going to be
> the sub person. That's fine, we can decide that after I test it a bit. But it
> shouldn't be too hard, considering it's just fight one of the ascension.*
>
> *Then fight two, what I was thinking was probably Lyra fight from chapter
> two, but a bit more tougher. It's gonna be like basically a team versus elite
> boss battle.*
>
> *And then after that, a Molvarr world boss battle. Now from what I've played
> the game, Molvarr fight isn't that hard once you level up your characters, at
> least on the base difficulty, like the world boss quest one. So we will up the
> stats a bit, but not by too much. So yes, they'll still struggle, but they
> won't struggle to the point that they will be defeated more than they win the
> fight. But since they only have to clear the ascension trial once, we'll make
> it decently challenging so that they have to actually try and then win.
> Obviously I will playtest once we have the in-game prototype ready."*

### Fight 1 — four enemies, and it is the gentle one

- **Four enemies total.** Who they are is settled (Frost, Gale, Iron, Prism).
- **Field order and who benches are NOT settled.** He will decide after
  testing. What is authored today — Frost/Gale/Prism fielded, Iron benched —
  is **my placeholder, not his decision.**
- **Deliberately not hard.** *"It's just fight one of the ascension."*

**Measured, for when he picks:** the three orderings land within noise of each
other — 77% / 81% / 81% clear for a balanced level-20 team. Fight 1 costs that
team roughly 15% of its HP. So **the field/sub split is a flavour call, not a
balance one**, and it is already in the "not too hard" band he asked for.

### Fight 2 — Lyra, tougher, team versus elite

- **A team-versus-elite-boss fight**, not a group fight.
- Based on the chapter 2 Lyra encounter, **made tougher**.

**That encounter no longer exists.** `data/story/` holds `chapter-1.json` and
nothing else, and **`lyra_npc` is referenced by no story data at all** — only
her kit file survives. The fight he remembers is from the retired v1
Part-to-Chapter structure, deleted when story mode v2 landed. So this is
authoring a new fight that echoes the old one, not reusing it.

**The mechanism for "but tougher" already exists and this exact case is why.**
`types/stageEffects.ts` documents it: *"Part 2 Chapter 2 was built the wrong way
first: `lyra_npc_2` was a byte-for-byte copy of `lyra_npc` whose only difference
was a passive line granting 'All stats 5% up'. That duplicate drifted (it never
got registered for art) and has been deleted in favour of a stage effect."* So:
**a `statBoost` stage effect or an authored `level`, never a second Lyra kit.**

### Fight 3 — Molvarr, harder than world level 1

- His judgement from actually playing it: **Molvarr is not hard once characters
  are levelled**, at base difficulty (world level 1).
- **Raise the stats a bit, not by much.**
- Target feel: they struggle, but **win more often than they lose**.
- One-time clear, so **decently challenging — they have to try**.

**The measurements back the instinct, and say how little "a bit" can be.** A
balanced level-20 team clears the whole three-fight stage 74–80% of the time at
enemy levels 15/20/24, arriving at Molvarr and finishing on roughly 26% HP —
already "struggle but win more than you lose". And the margin is thin in a way
worth knowing before tuning: **+25% enemy ATK took every team archetype from
75/38/100% to 1/3/3%**. Subtractive mitigation makes damage-through scale
violently, so "a bit" is genuinely a few levels, not a few tens of percent.

**Still unsolved and not his to work around:** a DEF-stacked team clears at
100% regardless of any of this. See the balance findings in `docs/STATUS.md`,
session log 2026-09-16b.

### Process

**He playtests once the prototype is in-game.** Final difficulty is his call
from play, not from the simulator — the simulator's job was to get the first
draft into the right band so his test is about feel rather than about whether
it is winnable at all.

---

## 7. Story — the open problem, in his words

Recorded as **an unsolved problem**, not a decision. He was explicit that he has
not settled it: *"we'll see, we'll see. I'm still not sure."*

> *"The elephant in the room was first story. I did have up to I think five
> chapters ready in a very early version of the game. Maybe five, maybe at least
> two were ready and planted. But I scrapped it because I wasn't sure how we
> would adopt the story into the game. The way I first initially implemented it
> did not work out like I wanted it to. So that's what I did — scrap everything,
> then we'll replan everything.*
>
> *It's mainly because the story is mainly straightforward. It doesn't have
> filler. It doesn't have enough side content to fill out the in-game story
> elements, such as fights in every chapter, or how it would pace out without
> being too fast or too slow. So that's why I was leaning on creating a bit of
> NPC characters too, so that we can fill in the gaps, we can fill in filler
> data, filler story.*
>
> *You can still find the current canon story details in that other directory I
> mentioned, but I'm still not sure how we can implement it. It has to be
> something, a mix of story panels and then a fight and then the reward screen.
> But yeah, we'll see. I'm still not sure."*

### The problem, stated plainly

**The canon is too lean to be a game on its own.** It is straightforward, has no
filler, and does not supply enough fights or beats to pace a chapter. So an
adaptation must invent material, and his instinct is **NPC characters** as the
vehicle for it.

### Where this already stands, factually

Much of what he describes as uncertain is **already built and shipped**, which
may or may not be what he wants — recorded here so the question is about
whether it works, not about whether it exists.

- **The scrap-and-replan happened.** Story v1 was Part → Chapter; v2 is
  **Chapter → Stage** (ruling #108, `types/story.ts`). The Lyra chapter 2 fight
  from point 6 is one of the casualties.
- **Filler is sanctioned and tagged.** Ruling #108 allows Claude to draft
  filler stages, scenes and NPCs **under his approval**, every filler stage
  carries `origin: "filler"` in the JSON, approved content lands in
  `Filler/Approved_chapter_N.md`, and **NPC kit numbers stay his**. The
  `FillerAssist` skill runs the workflow.
- **"Story panels, then a fight, then the reward screen" is the built shape.**
  A stage carries `intro: StoryScene[]`, its fights, `outro: StoryScene[]`, then
  `firstClear` and `farm` rewards through `StageResult`.

### And chapter 1 already answers the pacing problem — one way

`data/story/chapter-1.json`, as it stands:

| stage | kind | origin | scenes in/out | fights |
| --- | --- | --- | --- | --- |
| s1 The World That Toll Built | story | **canon** | 6 / 3 | 0 |
| s2 The Wilderness Answers | battle | *filler* | 2 / 2 | 2 |
| s3 Nine Years | battle | *filler* | 3 / 1 | 2 |
| s4 The Notice | story | **canon** | 3 / 1 | 0 |
| s5 Where the Traffic Thins | boss | *filler* | 4 / 4 | 3 |

**The pattern: canon carries the narrative, filler carries the combat.** Both
canon stages are pure scene stages with zero fights; all seven fights in the
chapter are in filler stages. That is precisely the gap he describes — and it
is one worked answer to it, already playable.

**Scale of what remains: one chapter of twelve is adapted** (Arc One, per
ruling #127's note).

### The question this raises, and he has not answered it

Is chapter 1's alternation — canon scene stages between filler fight stages —
**the pattern to extend to chapters 2–12**, or is it the thing that did not
work? He has not been asked and should not be assumed either way. Nothing about
story gets built until he answers.

---

## 8. Story is deliberately parked — and what he thinks is already working

> *"That's why I stopped working on the story section of the game, because I'm
> gonna let myself build out the story first, complete arc one, and then we'll
> see how we can implement and adopt it into the game. So I'm just waiting until
> I have everything ready. But until then, we can at least add other elements
> into the game, PVE content. We can fix the game.*
>
> *Gameplay-wise it is good now. The screens are good, and the action — well,
> what more can I expect from a card-based game which runs in the browser? But
> what I am doing good, it is also in the kits section. So each character is
> unique in their own way. They have distinct kits, and the gameplay revolves
> around planning around tactics. It's not just like, yes, I have a stronger
> character, I can beat you now. Team synergy is also a thing. Character kit is
> a thing. Obviously power creep does come into it as well. So I'm focusing on
> other things mainly."*

### The decision

**Story is blocked on him, on purpose, and not on the game.** He is finishing
**Arc One as a webtoon first**, and only then deciding how to adapt it. This is
a deliberate pause, not a backlog item that slipped.

**So: do not start story work.** Not chapter 2, not an adaptation plan, not a
filler draft — the answer to "how does the story become a game" is waiting on
source material that does not exist yet, and any structure proposed now would
be designed against an incomplete arc. That supersedes the open question at the
end of point 7 for now: it is not answerable yet either.

**Everything else is fair game**, and that is where the effort goes: PVE
content, and fixing what is there.

### His own read on what is already good

Recorded because it is a steer on what **not** to churn:

- **Gameplay** — good as it stands.
- **Screens** — good.
- **Action/presentation** — acceptable for a browser card game, and he said so
  without being asked.
- **Kits are the strength.** *"Each character is unique in their own way. They
  have distinct kits."* The game is won by planning and tactics, **not by
  bringing a stronger character**; team synergy and kit interaction carry it.
  Power creep is acknowledged as present.

**What that implies for proposals:** the value is in **content and kits**, not
in reworking combat or rebuilding screens. A suggestion to overhaul either is
arguing against his own assessment of his game and needs a much better reason
than tidiness.

**A tension worth holding, not resolving:** his pride in kit variety and
tactical depth sits against the two measured balance findings — DEF stacking
beating content outright, and difficulty collapsing on a 25% ATK swing. Both
reduce the space where kit choice decides a fight. Not raised as a
contradiction; raised because fixing them would *protect* the thing he values
most, which makes them worth more than they look.

---

## 9. He tunes kits directly, and a big number is often the point

> *"If I feel like a character is too strong or too weak, I usually just adjust
> their kits anyway. So for example, originally Lyra's passive buff was only 50%
> extra defense as first attacker. I buffed it to 150% just because I wanted her
> to have a gimmick, and as long as the character is open to playing her gimmick
> then they get rewarded — at least on Lyra. It's a very niche type of gameplay
> reward mechanic, but it's a unique thing."*

**What it settles:**

- **Balance is handled at the kit, not at the encounter.** If something is too
  strong or too weak he edits the kit. So an encounter should not be built to
  work around a kit he can simply change.
- **A large number can be a deliberate reward for a gimmick.** Lyra's 150%
  first-action DEF is a **tripling of the original 50%**, done on purpose, to
  pay off a niche playstyle. It is not a mistake to be corrected.
- Consistent with ruling **#56** — *"Values are free. A number that doesn't land
  on a tier is intentional, not a bug"* — and with `kitcheck`'s boundary that
  wording and structure are auditable but values are not.

**Where this landed in the argument about DEF.** Lyra reaching ~1,479 effective
DEF in a Mustafa/Gabrist/Ban team — enough to take the 1-damage floor against
Molvarr's biggest hit — is **his design working**, not the formula misbehaving.
The genuinely open question is narrower than "DEF is broken": a *team* of such
characters compounds into immunity, and no encounter-side dial reaches it,
because every lever that raises the hit above the wall kills everyone else
first.

**How to behave, going forward:** report an outlier with the measurement and
the consequence, and **do not propose a nerf**. He decides whether a number is
a gimmick or a problem. What is worth bringing him is the *interaction* — the
thing no single kit's author can see — not the individual figure.

---

## 10. Power Strike — his planned counter to high DEF

> *"Yes, this high defense can be a problem later into the game, but I already
> have a counter to that planned, and that comes in the form of power strike
> mechanic. That power strike skill — the skills that have power strike will do
> extra 2% extra damage per 1% defense. Oh well, I think it was the other way.
> Yeah, so the skill becomes stronger the higher the opponent's defense is. So
> that's basically going to be a direct counter to high defense characters."*

**What it settles:**

- **He has already planned the answer**, and it is a *mechanic*, not an
  encounter dial. Consistent with point 9 — balance lives in kits and
  mechanics, not in fights built to dodge the problem.
- **Direction is certain even though the ratio is not**: damage rises with the
  **target's** DEF. He was unsure whether it is 2% per 1% or the reverse, and
  explicitly left it open.
- **It does not exist yet.** No `powerStrike` anywhere in the engine or data;
  only `pierce` and `critical` touch DEF today (`lib/game/damage.ts`).
  **Ruling #65 applies — no description may name it until it is built.**

### The shape, measured — so the ratio can be picked against numbers

The natural formulation is bonus damage proportional to the target's DEF, added
before mitigation:

    damage = max(1, baseDamage + DEF*k - DEF)
           = max(1, baseDamage - DEF*(1 - k))

which gives `k` a real meaning: **how much of the target's DEF is turned against
them.** Against Molvarr's Crushing Maw R3 at level 24 (1,188 base):

| target | DEF | k=0 | k=0.5 | **k=1.0** | k=1.5 | k=2.0 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Lyra, full stack | 1,479 | **1** | 448 | **1,188** | 1,928 | **2,667** |
| Mustafa, buffed | 675 | 513 | 850 | 1,188 | 1,526 | 1,863 |
| Master Tao, buffed | 586 | 602 | 895 | 1,188 | 1,481 | 1,774 |
| Master Tao, raw | 208 | 980 | 1,084 | 1,188 | 1,292 | 1,396 |

Two landmarks worth knowing before choosing a number:

- **k = 1.0 exactly cancels DEF.** Every target takes the same 1,188 whatever
  their defence. A clean, explainable place to sit.
- **k > 1.0 makes DEF a liability** — at k=2 the tankiest unit on the board
  takes **more** damage than the squishiest. That is literally *"stronger the
  higher the opponent's defense is"*, so his first instinct (2% per 1%) is the
  one that matches what he described.

**And "the other way" lands on something the game already has.** 1% per 2% is
k = 0.5, which reduces effective DEF by half — the same reach as **Pierce**
(`piercePercent` defaults to 50). Choosing it would duplicate an existing
mechanic rather than add one.

**Still his:** the ratio, the name, which skills carry it, and whether it
stacks with Pierce or replaces it. Nothing here is a proposal — it is the shape
of the dial, so the number he picks means something.

---

## 11. Power Strike — adopted, and its rate settled

Reading the pending Knuckle / Netero drafts in `author_notes.md` turned up that
**Power Strike was already defined** — `docs/ARCHITECTURE.md` carried *"+1%
damage per 2 points of enemy DEF"* (5% per 10), and Netero's drafted S1 and
ultimate already carry it. Shown the discrepancy against the 3% per 10 he had
quoted from memory, he settled it:

> *"We will adopt power strike from it and we will rebalance it to 30 percent
> per 100 defense… so 30 percent damage increase per 100 defense. So in the
> description you can mention the very lower amount of explanation — so I think
> it would be three percent extra damage per 10 defense. Yes, so we have to
> explain it like that."*

**Settled:**

- **Rate: 30% per 100 enemy DEF** — identical to 3% per 10, or 0.3% per point.
  All three of his phrasings agree; the documented 5%-per-10 is superseded and
  `docs/ARCHITECTURE.md` now says so and says when.
- **Reads EFFECTIVE defence**, his explicit call: *"it would target their
  effective defense or current defense, not the base stats. So even if defense
  number ends up going to 1000, then it would punish that number."* Buff
  stacking is therefore punished, which is the whole point.
- **Explained in the smallest unit.** Player-facing text says **"3% extra
  damage per 10 defense"**, not "30% per 100" — the smaller figure reads as a
  gentler slope and is easier to hold in the head. That is a wording rule for
  the glossary pill, matching rulings #26/#27 where a pill reveals the number a
  keyword hides.
- **Carrier skills take below-standard scaling.** *"Power strike cards will not
  have high damage scaling numbers… maybe lower than standard rank scale
  numbers, and even on ultimates it would be a bit lower."* Already true in the
  Netero draft: his S1 is 260/320/400 against Knuckle's standard 390/480/600.
  His ultimate is **not** discounted in the draft (both at 500), which is the
  one place the draft and the stated principle disagree.

**Measured: why the low scaling is what makes it a decision.** Against
Molvarr's reference hit, at 150% scaling — roughly half a standard skill — a
Power Strike does **less** than a normal card into low DEF and **more** into
high DEF:

| target | DEF | standard skill | Power Strike @150% |
| --- | ---: | ---: | ---: |
| Master Tao, raw | 208 | 23% of HP | **18%** |
| Mustafa, buffed | 675 | 9% | **19%** |
| Lyra, full stack | 1,479 | **0%** | **33%** |

At 100% nobody but Lyra notices it; at 200% it beats a standard card against
*everyone* and stops being a choice. **Not a proposal** — the crossover is
stated so his scaling numbers can be picked against it.

**Not built.** No `powerStrike` mechanic type exists. Ruling **#65** forbids any
description naming it until it does.

---

## 12. Power Strike's ultimate ladder, and damage reduction as its counter

**Settled:** the Power Strike ultimate is **single-target**, treated as a
**premium-tier mechanic**, and ladders `250, 300, 350, 400, 450, 550` across ult
levels 1-6.

That step shape — `+50 x4, then double` — is **already house convention**:
Mustafa runs `200, 250, 300, 350, 400, 500` and Seras `350 ... 650`. Its +120%
growth is second only to Mustafa's, so it rewards ult investment more than most.

**Raised and consciously accepted:** at 250% it is a *strict upgrade* over a
normal 350% ultimate against **every** target, including the squishiest —
1,526 vs 1,286 against 208 DEF. The break-even is **216%**, because no unit in
the game has low effective DEF (the floor is ~208 at Lv20, already worth +62%).
He kept 250 anyway: it is single-target, and Netero pays for it with a 3-turn
self-lockout that also clogs the shared hand. **The character is situational
even though the card is not.**

### Damage reduction is the intended counter, and it counters *asymmetrically*

> *"A direct opponent for power strike would be damage reduction. Damage
> reduction does not work same as high defense — it actually reduces the damage
> taken… I also drafted kits for Dragon Ball Z characters, and Goku or Vegeta,
> they have damage reduction as part of their passive, so that will directly
> counter power strike."*

Correct, and it falls out of the order of operations in `lib/game/damage.ts`:
DEF is **subtracted** from the hit *and* inflates the Power Strike bonus, while
DR **multiplies last** and never feeds it.

**DR needed to cancel Power Strike's advantage over a normal ultimate:**

| target | DEF | DR required |
| --- | ---: | ---: |
| Master Tao, raw | 208 | **15.7%** |
| Meliodas, raw | 231 | 19.9% |
| Mustafa, buffed | 675 | 68.0% |
| Lyra, full stack | 1,479 | **99.7% — unreachable** |

So a modest 20-30% DR passive fully protects a normal-DEF character, and **no
achievable DR saves a DEF-stacked one.** The bonus scales with DEF, so the
tankier a unit is the further out of DR's reach it goes.

**The emergent property, which is the good part:** you cannot buy immunity by
taking both defensive stats. DEF loses to Power Strike and loses *harder* the
more you stack; DR beats Power Strike cheaply but only if you did not also stack
DEF. The counterplay is "do not be a tank", not "add another defensive layer".

*(The DBZ kits are under his own **PARKED** heading in `author_notes.md` —
*"wouldn't implement it anytime soon"*, and marked not to be treated as roster
facts. His DR intent is recorded; the kits were not read as design input.)*

---

## 13. The design philosophy: counterplay cycles, not balance patches

> *"My whole game is based around this rock paper scissors mechanic. Now I may
> introduce characters in the future who have stances that let them have the
> damage reduction effect. But then characters with cancel stances would be in
> meta to counter such units. Likewise, if we have infinite stackers, then
> skills that either punish or cancel such effects will be effective in the meta
> then. So it will always be something like this. And obviously we have
> creativity, we have examples from the real-life games out there — so don't
> worry about that. There will never be a problem that will interfere in the
> game for too long. We will always have a solution in some shape or form."*

**This changes how a balance finding should be reported.** A dominant strategy
is **not a defect** in this game; it is a strategy the meta does not yet have an
answer to, and the answer is the **next mechanic**, not a nerf to the old one.

So the useful report is *"X currently has no counter"* plus the measurement —
not *"X is broken"*, and never a proposed nerf. Compare point 9: he adjusts kits
himself, and a big number is often a deliberate gimmick reward.

**The layer already exists in code.** `cancelBuffs` and `cancelStances` reach
**different things** (ruling #132, built 2026-09-16): a stance survives
`cancelBuffs`, a free-standing buff survives `cancelStances`. That is precisely
the counter-mechanic layer he describes, authored ahead of the units that will
need countering.

**The corollary worth holding onto:** an unanswered strategy is a *design
opportunity*, and flagging one is doing him a favour — it names where the next
mechanic should go. The DEF/Power Strike/DR triangle in points 10-12 is this
philosophy working end to end, in one conversation: a dominance found, a counter
adopted, and the counter's own counter identified before either shipped.

---

## 14. Why this document exists — the division of work

> *"This brainstorming session is between me and you so that you can also learn
> my vision, how I think, what I think, and what's in the plan, so that there's
> no gap in how we both think on some levels.*
>
> *I manage the thinking process of the story side. You handle the code side and
> the design side. And obviously I would test, and I would play the game myself,
> and I would give you my reviews on what things to improve and how to improve
> them. It's mostly like you are my co-assistant — you are doing the coding
> stuff and I am doing the thinking stuff. But our vision should also match, and
> this is why we are talking right now."*

**The split, as he states it:**

| His | Mine |
| --- | --- |
| The story, and the thinking behind it | The code |
| Playing and testing the game | The design side (see the boundary below) |
| Reviews — what to improve, and how | Acting on those reviews |

**Why the document exists:** so the two halves do not drift. Everything above
is him loading context that lives only in his head, deliberately, because a
shared vision is the thing a repo cannot carry.

### The one boundary worth naming precisely

He says *"you handle the code side and the design side"*, and **"design" has to
mean systems design, not game design.** Everything else he has said — today and
in the ledger — keeps game design firmly his:

- `AGENTS.md`: he owns skill names, mechanical effects, damage multipliers, kit
  JSON, and **who gets drafted**.
- Point 9: he adjusts kits himself; a large number is often a deliberate
  gimmick reward, not a defect.
- Point 13: a dominant strategy gets a **new counter-mechanic**, and the
  mechanic is his to invent — *"I will also create a solution with you."*
- Ruling #65: never name a mechanic the engine does not have, because
  *"don't want you inventing names and mechanics on your own. consulting me
  first is a must."*

**He corrected this straight away, and it is narrower than the guess above —
UX is HIS, not mine:**

> *"When I said design, it's mostly the site structure, data types, that kind of
> design. I'm not talking about UI, UX — obviously that is my domain mostly, but
> then I do let you know what I need and how I need it, then you can code it out.
> That also comes under programming.*
>
> *And I do ask you sometimes about character names, kits, but that's only for
> characters that are of less significance in the story. For example NPCs, or
> people who I don't feel like writing for them or designing or spending enough
> time only for them — then I can ask for your suggestions on them. Otherwise I
> would handle most of the story elements and kit elements to the game."*

So the real line:

| Mine | His |
| --- | --- |
| **Site structure and data types** — architecture, schemas, what a thing is called, what is measurable | **UI and UX direction** — he says what he needs and how |
| Implementing his UX direction (that is programming, not design) | Story, mechanics, kits, numbers, characters |
| Measuring, and describing the shape of a dial | Choosing every value on it |

**Two consequences worth being exact about:**

- **I do not originate UX direction.** The mobile rules in `AGENTS.md` (#107,
  #118-125) are the *record of his direction*, not a mandate to invent more.
  Surfacing a screen that breaks one of his established rules is measurement and
  is welcome; proposing a new interaction model is not mine to start.
- **There is one narrow, invitation-only carve-out on kits.** He may ask for
  **names or kits for low-significance characters** — NPCs, anyone he does not
  want to spend his own time on. It is *by request only*; it does not loosen
  ruling #65 or `AGENTS.md`, and it never extends to a character who matters to
  the story. Sits alongside ruling #108, where filler is allowed under his
  approval and NPC kit numbers stay his.

Where the two halves touch, the useful contribution is a **measurement and the
shape of the dial**, never a chosen value — what points 10-12 did with Power
Strike: model the curve, name the landmarks, leave every number to him.

---

## 15. How the mobile work actually succeeded — the process to copy

> *"The reason why the mobile version of this app works is because I had to sit
> down with you at the time and properly plan every single thing — how each
> section of the UI would look, how the gameplay would feel, what would be the
> sizes of the cards, how, what would be the sizes of the card deck. Every
> single thing I sat down and discussed with you, and then we implemented it
> together.*
>
> *So it wasn't just done in first batch. I think this took like four or five
> tries in total to properly nail down. And even now it's not like fully fully
> nailed down, but it is very good now — we're in a very good state at the very
> least."*

**His count is accurate.** Four distinct passes in the ledger, not one:

| pass | date | what landed |
| --- | --- | --- |
| #107 | 2026-08-18 | mobile-first declared; 390x844, `dvh`, 44px targets |
| #118-120 | 2026-08-21 | the sweep; the 44px floor moved **into the primitives** |
| #123-126 | 2026-09-01 | bottom tab bar, filters sheet, first browser audit |
| corrections | 2026-09-16 | hand-card floor 56 -> 44, and the test that had pinned the old number |

**The method, which is the transferable part:** he specified the detail *before*
implementation — section by section, down to card and deck sizes — and they
built it together, then measured, then corrected. **Not a spec handed over and
executed; a conversation, iterated four times.**

**And it is honestly assessed.** *"Not fully nailed down, but very good"* — the
same posture `AGENTS.md` takes, where geometry and behaviour are browser-verified
and **taste never is**, because that pass is his.

### What this says about today

The ascension trial was built **before** this conversation, not after. That is
the inverse of the order that made mobile work, and it is exactly why ruling
#136 is marked PROVISIONAL and why he stopped to say *"this needs more of a
personal touch from me."*

The engine work underneath it survives — the wave runner leaving story, the
reward-path split, the dead `clearRankWall` — because those are structure, which
is the half that is mine. What did not survive contact is the **encounter
design**, which was his all along.

**So the rule for the next feature:** plan it with him at this level of detail
first, in a document like this one, and build second. The cost of the other
order is visible in this very repo, one commit back.

---

## 16. Consistency is a system problem, and it is already measurable

He raised UI consistency as the thing to fix before the game grows:

> *"Consistency in terms of the UI design, the components, colors — what we
> planned earlier, taxonomy I think you called it. It's a very good thing moving
> forward that we will have a standard and selected colors of what represents
> what things… a red color would mean attack skill, yellow would mean stance
> skills. And the same with the stage menus, battle screen, the brief screen,
> the result or reward screen. So we need a proper standard for all that, so
> that even by accident it doesn't go inconsistent on any of the instances of
> when someone's playing the game."*

### Measured, and it is worse than it looks

**The same primary action button exists in seven hand-typed variants**,
differing in opacity (`bg-signal/10` vs `/12`), letter-spacing (`0.16em` vs
`0.18em`), padding (`py-1.5` / `py-2.5` / `py-3`), and whether hover and
disabled states exist at all.

**Letter-spacing has 18 distinct values across 364 uses:** `0.18em` x53,
`0.16em` x48, `0.14em` x46, `0.1em` x34, `0.12em` x34, `0.22em` x32, `0.2em`
x31, then a long tail down to single uses of `0.26`, `0.3`, `0.03`. The top six
are all doing the same job — the uppercase micro-label. That is drift, not a
scale.

**The panel container** appears 15 times as `border border-edge-strong bg-panel`
plus four one-off variants.

**I contributed to this today.** `TrialRail.tsx` and the trial results screen
were written by eye-copying class strings from `app/events/page.tsx`, using
`0.18em` and `0.22em` without knowing either was a decision.

### Why it happens, and where the fix goes

**The token layer is good** — `void`, `panel`, `inset`, `hairline`, `edge`,
`readout`, `signal`, `el-*`, `role-*`, all named by role rather than by colour.
The gap is **the layer above it**: there is no `Panel`, no `PrimaryAction`, no
`MicroLabel`, so every screen re-assembles tokens by hand and drift is
invisible in review.

**The enforcement pattern already exists in this repo.**
`tests/touchTargets.test.ts` makes the 44px floor unfailable and
`tests/viewportUnits.test.ts` catches stray `vh`. Rulings #119-120 moved the
44px floor **into the primitives** for exactly this reason. The same shape works
here: components own the patterns, and a test fails when a screen hand-rolls one.

**Ownership:** the structure, the components and the guards are mine (point 14 —
site structure and data types). **Every visual value is his** — which tracking
wins, what the button looks like.

**Offered, not started:** a full audit producing an inventory of every recurring
pattern, its variants, and where they disagree, so he can make the calls in one
pass instead of screen by screen.

---

## 17. His three engineering values

> *"I knew this would be an issue in this project, because I've grown as a web
> developer. What I used to only think about is modularization, but now I think
> three things matter to me more than anything in any project: **consistency,
> modularization, and QOL — quality of life things.**"*

**These are the standing criteria for any code written for him**, and they are
listed in the order he gave.

**1. Consistency.** One primary button, not seven. One letter-spacing scale, not
eighteen values. One colour taxonomy across effects and skills (ruling #133,
which collapsed three disagreeing colour maps into `lib/game/skillTypeStyle.ts`).
Point 16 is the open work.

**2. Modularization.** Not new to him, but no longer sufficient on its own.
Today's good examples: the 44px floor living in `components/ui/` rather than per
screen; `foldWaveFromBattle` extracted to `lib/game/waveDriver.ts` the moment a
second screen needed it; the wave runner generalised out of story types so a
trial does not have to pretend to be a story stage.

**3. QOL — narrowed by him, 2026-09-17.** Not "polish" and not developer
tooling: it is **the affordances that make a feature usable rather than merely
functional.** His definition, from web work:

> *"When you create a new table — without QOL you don't add any search field,
> you don't add any filters, sort options, animations, anything like that. With
> QOL, obviously you would add all that. It's more like a QOL for all purpose."*

So the test for any screen is: can a player **find**, **narrow**, **order** and
**understand** what is on it, or can they only look at it?

**The archive is the benchmark, not a gap.** He floated it uncertainly as an
example; measured, `components/game/CharacterBrowser.tsx` already has all four —
search (`searchValue`), sort (HP/ATK/DEF with direction), filters (tags and
mechanics in a sheet, ruling #124) with an active-filter count, plus escape-key
dismissal. **Other screens should be measured against it.** The events board is
the obvious contrast: a flat list with no grouping, which point 4 already wants
sectioned.

**Auto-battle: he floated it, and he already rejected it.** `lib/game/autoClear.ts`
records why — it needs a player-side AI handling 27 kits, ally targeting, ult
timing and merges, *"and would be judged against how he plays."* **Auto Clear**
is the shipped answer: it pays a fight's cost and grants its reward without
simulating anything, which is why a ticket still spends full stamina. His own
caveat on the day — *"it will need more work than one would assume"* — matches
the recorded reasoning.

**What this changes about proposals:** "it works" is not the bar. A change that
adds an eighth button variant is a regression against value 1 even if it ships
the feature, and a fix that lands in one screen rather than in the primitive is
a regression against value 2.

---

## 18. The vocabulary, restated by him — **supersedes point 3 and ruling #137**

Given unprompted on 2026-09-17, after #137 had been written. **His list is the
authority; #137's table is wrong and must be amended.**

> *"We will have the following terms and concepts in our game.*
>
> *1. **Fight.** Player vs any number of enemies. May or may not have more than
> 1 phase. Starting a new fight meaning it doesn't sustain anything from prior
> fights. Everything goes to initial values.*
>
> *2. **Stage** — a dedicated entry to a particular fight or story panel. For
> example, story stages, event stages, Molvarr boss battle stage.*
>
> *3. **Event** — think of it as like a folder for stages. A group. For example,
> Ascension Quests (Event) and then it would show Ascension Trial 1 (Stage),
> Ascension Trial 2 (another stage).*
>
> *4. **Phases (in fights)** — when fighting waves of enemies in the same fight.
> Think of it as a marathon in a fight. For example, player team vs 4 enemies;
> after those 4 enemies are defeated then it moves to a new set of enemies. **A
> fight would not be considered cleared or won until all phases are
> completed.***
>
> *5. **Stage map nodes** — places on a stage map that player can land on. Each
> node can have anything ranging from item drops, fights, stage jump point,
> stage end point. How players move depends on the stage navigator roll."*

### What changed against #137

| term | #137 said | **he now says** |
| --- | --- | --- |
| **Fight** | a separate battle inside a stage | player vs enemies; **resets everything** on start |
| **Stage** | holds one or more fights | **an entry** to a fight or a story panel |
| **Event** | a kind of board entry | **a folder — a group of stages** |
| **Phase** | one enemy changing state | **a new set of enemies inside one fight** |
| **Wave** | new enemies inside a fight | *gone* — that concept is now **phase** |

**"Wave" is retired as a term.** What it named is what he now calls a **phase**.
And **"event" is promoted** from a single board row to a container: Ascension
Quests is the Event, and Trial 1 and Trial 2 are Stages inside it.

**New, with no equivalent anywhere in the codebase: stage map nodes** — a board
of nodes carrying drops, fights, jumps and an end point, with movement decided
by a **"stage navigator roll"**. That is the numbered token on the Dokkan Super
Battle Road screenshot he shared. Nothing like it exists today.

### Two conflicts this creates, both put to him

**A. The ascension trial's own shape.** Point 2 had him saying of its three
fights: *"it's a brand new fight, it's not continuing, it's not a phase"*, with
the turn counter resetting — and separately that **HP carries and there is no
heal between them**. Under the definitions above those cannot both hold: a new
fight *"doesn't sustain anything from prior fights. Everything goes to initial
values"*, which would restore the HP too.

So the trial is either **one fight with three phases** (HP carries, and a fight
is not won until every phase is cleared — which matches the no-heal rule
exactly) or **three fights in one stage** (everything resets, including HP).
The first reading fits everything he has said about the *feel*; the second fits
what he said about the *turn counter*. **Not resolved here.**

**B. `CharacterPhase` already means something else.** Molvarr's two phases are
**one enemy transitioning form** (`lib/game/phases.ts`,
`transitionBossPhases`) — not a new set of enemies. Under the new definition
the word now covers the other concept as well, so the engine's existing
`phases` field and his `phase` are two different ideas sharing a name. That is
the exact collision #137 was written to prevent, arriving from the other
direction.

### Both answered, 2026-09-17

> *"For the trial quest, it would be **three fights in a single stage, not
> phases**. And the Molvarr fight is a **single fight with two phases**.*
>
> *And phases — it doesn't have to mean a different set of enemies. It could be
> the same enemy, but could be a stronger kit or a different kit. As long as
> it's moving to a different… it could be like three minions and then the main
> guy fight, it could be the same guy who gets stronger in the next phase.
> That's my choice, what phases and what fights would be like."*

**A — the trial is three FIGHTS in one stage.** Not one fight with three phases.

**B — there is no collision after all.** A **phase is any transition to a new
state inside one fight**, and the *content* of the transition is his choice:

- a new set of enemies (three minions, then the main one),
- the **same** enemy returning with a stronger or different kit,
- or an enemy changing form — which is what `CharacterPhase` and
  `transitionBossPhases` already do.

So the engine's existing `phases` is **one kind** of phase, not a different
concept wearing the same name. Nothing has to be renamed for it. Molvarr is the
worked example: one fight, two phases.

**One thing this leaves to reconcile, stated as a reading rather than a
question.** *"Starting a new fight… everything goes to initial values"* sits
against his equally firm rule for the trial — *"the hp of chars stay, and there
is no heal in between"*. Both hold if **"initial values" is in-fight state** —
the turn counter, buffs, debuffs, ult gauge, passive state — while **HP and
death are stage-level**, owned by the stage and carried across its fights. That
is exactly what the engine already does (`startCustomBattle` resets everything
except `carryHp`), and it is how the trial was built. **Say so if that reading
is wrong**, because it is load-bearing.

**Consequence for the audit:** finding **C5** is **unblocked and its original
target was right** — the code's `wave` means his **fight**. Separately, and not
part of C5: `GameEvent` in `lib/game/events.ts` is really a **stage** under this
vocabulary, and the **Event-as-folder** layer (Ascension Quests containing
Trial 1 and Trial 2) does not exist at all. That is new structure tied to point
4, which he marked "later".

---

## 19. The Goku example — what a phase actually preserves

> *"Let's say we have a Goku fight. We have a stage that goes to a Goku fight
> with multiple phases. In that fight, first we fight base Goku. After we beat
> him, then we fight Super Saiyan Goku. Then Super Saiyan 2, 3, God, Blue, Ultra
> Instinct, then Ultra Instinct Master version. All these will be the phases in
> a fight.*
>
> *And because it's the same fight, **we'll keep the damage, we'll keep all our
> stat changes**. For example, an infinite defense or attack stacker would
> benefit from such fights, because it will help them long term. So this is what
> I mean — a fight can have multiple phases, but it will still be a single
> fight."*

### The rule this pins down

**Across a phase boundary the player keeps everything**: HP, buffs, debuffs,
stacks, ult gauge, and the turn count. Only the *enemy* resets, and it resets
into a new form.

That makes **fight** and **phase** two genuinely different tests, which is the
part worth designing around:

| | HP | player buffs / stacks | ult gauge | turn count |
| --- | :-: | :-: | :-: | :-: |
| between **phases** (one fight) | carries | **carries** | **carries** | **continues** |
| between **fights** (one stage) | carries | **resets** | **resets** | **restarts** |

So a **multi-phase fight rewards ramping** — his words, *"an infinite defense or
attack stacker would benefit"* — while a **multi-fight stage punishes it**,
because every stack is wiped at each boundary and only the attrition carries.
The ascension trial is deliberately the second kind.

### Already supported, verified — no engine work needed

`lib/game/phases.ts` does exactly this. `enterBossPhase` states its own
contract: it resets **the boss's** buffs, debuffs, ult gauge and passive state
and swaps in that phase's `atk`/`def`/`hp`/`skills`/`ultimate`/`passives`, and
*"the caller is responsible for what PERSISTS across the transition — player
team state, the global battle turn counter, and boss-applied debuffs already on
the players — none of which this function touches."*

`transitionBossPhases` runs after damage and **before** the victory check, so a
boss at 0 HP with a later phase is not counted as defeated — which is his *"a
fight would not be considered cleared until all phases are completed"*.

**So the eight-phase Goku is authorable today** as one character with eight
entries in `phases`, each carrying a completely different kit. Molvarr already
does it with two. Nothing has to be built.

### The one phase shape that is NOT supported

He also described a phase as *"three minions and then the main guy"* — a
different **set** of enemies. `transitionBossPhases` **transforms a unit that is
already on the field**; it cannot add units or change how many there are. So:

- **same enemy, new form / stronger kit** — works today (Goku, Molvarr).
- **a new set of enemies mid-fight** — **does not exist.** It would need the
  phase to carry a roster rather than a statline, and the field to be rebuilt
  mid-battle without ending the fight.

Not proposed, just named — it is the gap between his definition and the engine,
and it only matters when he authors a fight that needs it.

### A note on "infinite stackers"

Nothing in the roster stacks without a cap today: Diane's ramp is *"Max 5
times"*, Gon's and Killua's fire once, Seras's Charged caps at 6. So the
archetype he is designing these fights to reward **does not exist yet** — which
makes a multi-phase fight the content that would give one a reason to exist.

---

## 20. A phase may change the enemy ROSTER, not just the enemy

Filling the gap point 19 named.

> *"Let's take the Molvarr fight as an example. We have a team of four player
> characters going against Molvarr. Now assume that after beating Molvarr, then
> we fight three different kinds of enemies in the next phase. So we're moving
> away from Molvarr, then we're basically entering the next stage.*
>
> *We can have a transition screen — maybe the screen blacks out before it
> reveals that. But I think we don't need the blackout scene; we can have a mini
> transition indicating that yes, the fight has moved to a different phase now.*
>
> *We don't have 3D models, so Molvarr is taking only one card slot as the enemy
> team, and the three or four enemies would take up three or four spots, like
> how the player team does on the UI. Other than that, it shouldn't be too
> difficult."*

**What it settles:** a phase carries a **roster**, not a statline. The enemy
field is rebuilt at the boundary and **its size may change** — one elite becomes
three ordinary enemies. Player state still persists across it (point 19).
Marked by a **mini transition**, not a blackout.

### Honest assessment of the work

**Already true, no work:**

- **The UI handles it.** The enemy side renders 1-4 tiles today — Molvarr alone
  is one, chapter 1's `s5` fights three. Going from one slot to three is a
  count the layout already draws.
- **Action economy self-corrects.** `actionsForTurn` counts living field
  members each turn, so a field that grows from one to three simply recomputes.
  Note the interaction with `tier: "elite"`, which grants the full three actions
  even alone — so a lone Molvarr phase and a three-minion phase can both act
  three times, and the change in *threat* comes from the kits, not the count.
- **Player persistence is already the rule** — `enterBossPhase` documents that
  it touches nothing on the player side.

**The real change, and it is structural rather than hard:** today `phases`
belongs to a **character** (`types/character.ts`, consumed in **18 files** —
`damagePreview`, `bossPassives`, `KitPhases`, the archive, the schema).
`transitionBossPhases` *transforms units already on the field*; it has no way to
add or remove one.

A roster phase is a phase of the **fight**, not of a character. So the fight
would carry an ordered list of enemy rosters, and the transition would **replace
the enemy team** rather than map over it. Character phases keep working
untouched — a transforming Goku inside a roster phase is still a character with
`phases`. The two layers compose and neither replaces the other.

**The one genuinely dangerous piece** is the victory check. Right now
`transitionBossPhases` runs after damage and before victory is decided, so a
boss at 0 HP with a later phase is not counted as dead. With fight-level phases
that question moves up a level: *the enemy side is empty, but does the fight
have another phase?* Getting it wrong gives either a fight that ends early or
one that cannot be won — and both are the kind of bug that only shows up in the
last phase of a long encounter.

**So: "shouldn't be too difficult" is about right for the engine**, with the
caveat that it adds an authored concept that touches the victory condition.
Additive, not a rewrite. **Not started** — it needs the plan-first treatment
(`AGENTS.md`), and no content asks for it yet.

---

## 21. The Lyra fight, overhauled into two weights

> *"We will overhaul the Lyra fight too. We'll keep a very light version — not
> a world boss, but a very strong fight against Lyra, and it would drop
> materials. It would basically work as the Molvarr boss fight.*
>
> *But in the story, since it's only going to be Duke versus Lyra — one player
> character versus enemy Lyra — I will make a lighter version of the fight for
> the story only. Then it would unlock, after clearing chapter 2, a new entry
> in the events page so that people can farm and gain materials.*
>
> *I have some ideas and extra passives, extra skills we can give Lyra, just
> like Molvarr."*

**What it settles:**

- **Two weights of one fight.** A **light** story encounter — **1v1, Duke
  against Lyra** — and a **heavy** farmable events entry that behaves like the
  Molvarr boss: material drops, repeatable.
- **The events entry unlocks on clearing chapter 2.**
- **Lyra's kit grows** — extra skills and passives, Molvarr-style. His to
  author.

### The trap this is adjacent to, and how to avoid repeating it

`types/stageEffects.ts` records that a second Lyra kit already existed once:

> *"Part 2 Chapter 2 was built the wrong way first: `lyra_npc_2` was a
> byte-for-byte copy of `lyra_npc` whose only difference was a passive line
> granting 'All stats 5% up'. That duplicate drifted (it never got registered
> for art) and has been deleted in favour of a stage effect."*

**His case is not that mistake** — extra skills and passives is a genuinely
different kit, not a stat bump wearing a second file. But **light-story versus
heavy-events is the same shape**: one character, two definitions, drifting
apart the moment either is touched.

**The mechanism that already exists for exactly this:** author **one** Lyra kit
at the heavy weight, and let the story fight be the same kit at a **lower
level** and/or under a **`statBoost` stage effect** (ruling #69). Levels are
per-enemy per-encounter (`StoryTeamPick.level`), which is how the ascension
trial tunes its three fights without touching a kit. One kit, two weights, no
drift — and it is what `lyra_npc_2`'s deletion was in favour of.

**Where a second kit WOULD be right:** if the heavy version has skills or
passives the story version must not have at all. A stat dial cannot remove a
mechanic. That is a real fork and it is his call, but it should be a decision
rather than the default.

### Both answered, 2026-09-17

**Two kits, not one.** He took the second option deliberately: *"they differ in
mechanics"* — the heavy version carries skills or passives the story fight must
not have at all, and a level dial can lower a number but cannot remove a
mechanic. So this is **not** the `lyra_npc_2` mistake repeating; that duplicate
existed only for a 5% stat bump, which is precisely the case a stage effect
should cover.

**It does inherit that duplicate's risk**, though, and the recorded failure mode
is specific: *"it never got registered for art"*. Two kits for one character
drift in the places nobody looks — art registration, tags, element, display
name. **Worth a guard once the second kit exists:** the pair must agree on
identity (colour, tags, art registration) while being free to differ on skills,
passives and stats. Not written yet, because there is nothing to guard.

**Visibility: hidden until chapter 2 is cleared** — Molvarr's shape,
`visibleWhen: { clearedChapter: "c2" }`. Since the unlock is the same clear,
**visibility and unlock coincide**: the entry simply appears already unlocked.
That needs no new mechanism — a `visibleWhen` chapter gate with no rank
requirement does exactly this, and `eventLockReason` has nothing left to
report.

### Not blocked by the story

**Chapter 2 does not exist.** `data/story/` holds `chapter-1.json` only, and
story is parked until he finishes Arc One. A `clearedChapter: "c2"` gate is
therefore **inert** until the chapter lands — deliberate and documented in
`isEventVisible`, the same property that lets Molvarr's `c9` gate sit harmless
today.

So **the events entry can be authored and shipped now**, gate included, and it
switches itself on when chapter 2 arrives. The light 1v1 story fight waits for
the story; the farmable heavy one does not.

**What is needed from him before any of it is built:** the heavy kit's **name**,
its **skills and passives**, and its **numbers**. All three are his
(`AGENTS.md`), and none of it should be drafted ahead of him.

---

## 22. Heading plus name — recorded as ruling #141

His Dokkan-derived convention: a unit shows a **heading** above a **character
name**, the name is shared by every variant, and the heading is what tells them
apart. *"Different kit, different heading, but obviously the same character
name. And in terms of coding, it would mean a different character ID."*

Full entry in `docs/HANDOFF.md` **#141**. Three things worth keeping here:

- **It repairs a live defect.** `lyra` and `lyra_npc` both render as **"Lyra"**
  — the roster's only duplicate display name — across the **57** places a
  character name appears.
- **It removes the bracket from point 6 / the phase spec.** *"Molvarr
  (Roused)"* becomes heading **Roused**, name **Molvarr**. The parenthetical was
  this field missing.
- **It is a different axis from #140.** #140 decides how many archive *entries*
  exist; #141 decides how a unit is *labelled* anywhere it appears. A phase and
  a version both get a heading; only a version gets its own page.

**Sizing, measured:** one optional field on `CharacterData` and the Zod schema,
then the display sites. **57 render sites across 12+ files** read a character
name — archive list and detail, events board and brief, story, battle tiles,
unit detail, the log, team picker, gacha. Not all of them should show a
heading; a battle tile has no room for one and the archive card does. **Which
surfaces show it is UX and therefore his** (#139) — the field and the migration
are not.

### The reference, transcribed (4 screenshots, DokkanDB, 2026-09-17)

He supplied **Ultimate Gohan** as the worked case. Searching "Ultimate go"
returns **six cards**, all named *Ultimate Gohan*:

| card | class | rarity | heading |
| --- | --- | --- | --- |
| 1 | Super AGL | UR (EZA) | *Exceptional Potential* |
| 2 | Super AGL | UR | *Frontline Fighter* |
| 3 | Super PHY | UR (EZA) | — |
| 4 | Super PHY | UR | — |
| 5 | Super AGL | SSR | — |
| 6 | Super TEQ | SSR | — |

**Cards 1 and 2 are both Super AGL and both UR.** Colour and rarity do not tell
them apart — **the heading is the only distinguishing label**. That is the point
of the mechanic, and it is stronger evidence than the description alone: a
heading is not flavour text, it is what a player reads to know which unit this
is.

**One thing follows from the data, and only one:** the heading and the name are
unique only **together**. Six cards share a name; two share name, class and
rarity. So `id` stays the key and this is a display-uniqueness rule — worth a
guard once headings exist.

> **Take the mechanic, not the presentation.** These are screenshots of
> **DokkanDB, a third-party fan database** — not the game. Its typography,
> search behaviour and layout are that site's choices and carry no design
> weight here. Tanveer, 2026-09-17: *"I'm just giving you information on how
> another game does it — everything else doesn't matter."* An earlier version
> of this section read a font style and a search field as evidence; they were
> neither his nor Dokkan's.

**Nothing built.** It wants his heading text for at least `lyra` and `lyra_npc`
before it is worth wiring, since those two are the reason it is urgent.

---

## 23. Stage map nodes — the mechanism, researched

**Research note, not a design.** He supplied 11 in-game screenshots of Dokkan's
"King of the Demon Realm Strikes" board with a walkthrough, and was explicit
about the terms: *"I don't want a plagiarised copy. What I want you to research
is how Dokkan does it and how effectively it does it, so that we can do
something similar — not same — in our own game."* And: *"do not worry about
anything that's not in our game yet."*

**Take the mechanism, not the presentation.** Nothing about its art, layout,
typography or its item system belongs here.

### The mechanism, abstracted

1. **Entry is three levels:** an event, a stage list inside it, then the board.
   That is exactly his Event → Stage model from point 18, already settled.
2. **The player is offered THREE movement values and picks one.** Not a die
   roll — *"it is like a random choice between three selections, and whenever I
   select one, a random number replaces the value after I land on the tile."*
   So the three slots are a standing menu: spend one, it refills at random.
   Randomness sets what is available; the player chooses from it.

   **The pool is an authored property of the board**, which is the tuning dial:
   *"sometimes all three can be forced — so it can be only number two that can
   be selected, you cannot see any other number. And sometimes it's limited to
   only numbers between one to three, so only low level. Normally it is between
   one to six — that's the standard."* A board can therefore be made tight
   (all 2s, no routing freedom), cautious (1-3, short hops, more stops) or
   standard (1-6).
3. **The board shows where each value would land you.** Small numbered markers
   sit beside tiles — a `3` next to the enemy tile, a `2` next to the item tile.
   So the pick is **informed**: each turn is a small routing puzzle, not a
   gamble.
4. **Junctions are a second, separate choice.** On reaching a fork the player
   picks a direction. Movement is otherwise forced along the path.
5. **Tiles carry:** nothing, a fight, a reward, an unknown (`?`), currency, and
   the goal. *(Dokkan also has item tiles; we have no item system and none is
   planned, so those do not transfer.)*
6. **Some tiles are forced stops.** The boss carries a STOP marker and sits
   across the path just before the goal — *"no matter which number you select,
   you will have to face the boss, as it's in the way."* Clearing it leaves you
   standing on that tile; you then move on to the finish.
7. **One pooled HP bar spans the whole board.** **This does NOT transfer** —
   *"don't worry about shared HP bar, that is a different mechanic. In our game
   each character has their own dedicated HP bar"* (7DS Grand Cross style). Our
   equivalent is per-character HP carrying across fights with the fallen staying
   down — ruling **#103** — which is a *different* and, for routing, a stronger
   thing. See below.
8. **Rewards accumulate and are paid once, at the end**, on a stage-clear
   summary.

### Why it works — the part he actually asked about

**THE BOARD IS NOT WHERE DIFFICULTY LIVES — his correction, 2026-09-17**, and
it deflates most of what this section originally claimed:

> *"Don't get the wrong idea. Mastering the map is not the hard part — it
> doesn't even add to difficulty in any shape or form. The actual fight is what
> matters… we can have a small board, it would still feature the Molvarr fight;
> we can have a big board, it might still feature only the Molvarr fight. The
> map has nothing to do with the difficulty. It is just a gameplay mechanic, and
> it really does not contribute much to difficulty in any shape or form."*

**So difficulty is authored entirely in the fights** — enemy levels, kits,
phases — which is where it has always been tuned here (`trialEncounters.ts`
sets a level per enemy per fight, and point 6's 4/10 target was hit by moving
those numbers, not by any board). **The board supplies pacing and texture.**

What carried damage still does is make an *optional* fight cost something
rather than nothing, so taking one is a choice rather than free — and ours
costs something specific, because HP is per-character and the fallen stay down
(#103), so a detour risks a named unit and, with it, an action per turn
(`actionsForTurn`). **That is texture, not a difficulty dial.** An earlier
version of this section read it as resource management that turned the board
into the game; that was **reading far more into it than is there**.

**The three-value pick converts randomness into agency.** A single die would
make the board a slot machine. Three options, with the landing tiles marked,
makes each turn a real if small decision — and crucially a decision the player
can get *wrong*, which is what makes getting it right feel like anything.

**The forced stop guarantees the content.** Routing changes *what condition you
meet it in* — how much you spent on optional fights — but never *whether* you
meet it. So the map cannot be used to skip the thing the stage exists for; it
only decides how well prepared you arrive. That separation is the single most
transferable idea here, and he confirmed it.

**It is a tile property, not a boss feature.** His words: *"this is not just for
the boss, it could be for anything else. It could be a point where you have to
land, a damage point, an item pick spot."* So **forced-stop** is a flag any
tile may carry — a mandatory fight, a scripted loss of condition, a guaranteed
pickup — and the boss is simply its most obvious user.

### What transfers, and what does not

**Transfers cleanly:**

- Three-values-pick-one, with landing tiles marked. Needs no new systems.
- Junction direction choice.
- Forced-stop tiles for content that must be faced.
- One HP bar across the board — **already true** (#103), and the runner that
  does it already exists (`lib/game/stageRun.ts`).
- Accumulated rewards paid at a stage-clear summary.

**Does not transfer — and the screen space it frees is ours to reuse:**

- **The pooled HP bar.** We show per-character HP instead.
- **Item tiles and the ITEM button.** No item system and none planned.
- **Auto Battle.** Rejected on its own merits (`lib/game/autoClear.ts`) — it
  needs a player-side AI across 27 kits and *"would be judged against how he
  plays"*. Auto Clear is the shipped answer.
- **Auto Map.**

His instruction on the gap that leaves: *"we can replace those things with
something else that works in our game — like a button that lets us check the
status of our teams, or something else."* So the board's chrome is a **fresh
layout**, not a translation of the reference's, and what goes there is UX and
therefore his (#139).
- **The wide board.** *(Correction: an earlier note in this session claimed
  Dokkan's board is landscape and would not fit our 390px column. These
  screenshots are **portrait phone** and the board scrolls vertically — so a
  portrait board is demonstrably viable. The concern was wrong.)*

### Board length is a design axis, and it decides who chooses the run

He supplied two deliberately opposite boards.

**Minimal — "Temporary Alliance".** Roughly **four tiles**: START, a blank, a
forced-stop boss, a blank, the goal. No junctions, no optional tiles, nothing
to pick up. His summary: *"just go fight, get out."*

**Branching — "Androids/Cell Saga".** A large board carrying **eight or more
forced-stop fights** (Cell, Trunks, the Androids, Vegeta, Goku, Frieza, Gohan,
Mr Satan), junction arrows throughout — and, crucially, **several goal tiles**
rather than one.

**That last detail is the mechanism.** Multiple exits at different depths mean
the player decides how much of the board to take: *"there's a possibility you
only have to fight one and then you can get out of the stage — this will count
as a clear. And you can also fight up to four or five maximum in a single
run."*

So the two shapes are not "short version" and "long version" of one thing:

| | minimal board | branching board |
| --- | --- | --- |
| path | single | many, with junctions |
| exits | one | **several, at different depths** |
| content faced | **fixed** — all of it | **player's choice**, 1 to ~5 fights |
| the decision | none; the stage is the fight | how deep to go before leaving |

**Length is pacing, and nothing else.** *"A small board would still feature the
Molvarr fight; a big board might still feature only the Molvarr fight."* So size
says how much journey wraps the content and says nothing about how hard that
content is. A minimal board suits a stage that is purely its fight; a longer one
suits a stage meant to feel like a trek. **Neither makes the fight harder.**

**And the roll pool interacts with shape.** On the branching board all three
values were **2** — a deliberately tight pool. Low values mean you cannot fly
past anything: you land often, meet most junctions, and choose constantly. A
tight pool raises **decision density**; a wide one lets a player skip ahead.
That is a second dial, independent of the board's size.

### What this means for us, concretely

- **Molvarr** wants a **minimal** board: start, a forced-stop boss, goal. The
  fight is the content.
- **The ascension trial** is a **linear board with three forced stops** — no
  junctions, no optional tiles, since all three fights are mandatory by design
  (point 6).
- **We have already built the degenerate case.**
  `components/game/events/TrialRail.tsx` is a linear board of forced stops with
  no movement layer. A minimal board is that plus tiles and a roll; a branching
  board is that plus junctions and extra exits. **The rail is not thrown away
  by this work** — it is the base case.
- A **branching** board is **not** the farmable case — see the clear rules
  below. *(An earlier line here said it was; that was wrong.)*

### Losing, clearing, and what a branching board is actually for

> *"Losing meaning you don't clear the stage, aka you have to re-attempt it,
> and then obviously start from the very beginning.*
>
> *In the cases where there are multiple fights and you clear one fight and
> clear the stage — yes, that would technically count as a clear, but it may
> not support auto clears, as it's meant to be difficult content and not
> farmable. It does give you rewards, but only one time. Usually people use
> such stages, or re-attempt such stages, to test their teams and have
> different ways of beating a tough stage."*

**Settled:**

- **A loss costs the whole board.** Re-attempt from the start; no progress
  kept. The whole run is the unit of risk — which is a rule about what a
  re-attempt costs, not a claim that routing is hard.
- **Reaching any exit is a clear**, even after one fight.
- **Rewards are one-time**, and these stages are **not auto-clearable**.
- **Replay is for testing teams**, not for loot — and what is being tested is
  the team against the *fights*. *"People use such stages to test their teams
  and have different ways of beating a tough stage."*

**So a branching board lets the player choose how much of the stage to take** —
one fight and out, or four or five. That is variety within a run, not a
difficulty setting: each fight is whatever it was authored to be, and meeting
fewer of them makes no single one easier. Early exit counting as a clear is
consistent with that, and with these stages not being farmed.

**This needs no new mechanism from us.** It is exactly the shape the ascension
trials already have: `repeatable: false`, no `autoClearEligible`, a one-off
bundle. `lib/game/events.ts` already documents the rule that **a non-repeatable
event must never be Auto Clear eligible** — *"skipping a one-off clear skips the
content itself"* — and `tests/ascensionTrial.test.ts` pins it across every
event. A difficult branching stage inherits all of that for free.

**Shape and farmability are INDEPENDENT axes, and only one of them is mine.**

An earlier version of this section had a table mapping board shape to
`repeatable`, as though branching implied non-farmable. **That was wrong**, and
wrong in a familiar way: he described *one* branching stage as difficult and
non-farmable, and it was turned into a rule about branching boards. The same
mistake as ruling #134, which was written from a single screenshot.

His correction: *"You are assuming that every stage can be farmable. That's not
the case. Only some are meant to be, and it's mostly tied to where things are
rewarded. I would tell you which stages are farmable and which are not."*

So:

| axis | what it is | whose |
| --- | --- | --- |
| **Board shape** — minimal / linear / branching | where the content lives, and whether the player picks the run's depth | structural; mine to build, his to choose per stage |
| **Farmable** — `repeatable`, `autoClearEligible`, the reward table | whether the stage is meant to be run again for loot | **entirely his, per stage** |

**Do not infer one from the other.** A minimal board can be farmable — Molvarr
is `repeatable: true`. A branching board can be one-time. **Ask, or wait to be
told.**

**Nothing needs building for this.** `repeatable` and `autoClearEligible` are
already per-event fields on `GameEvent`, and the guard that a non-repeatable
event is never Auto Clear eligible already exists. The only change required is
to stop deriving farmability from anything.

*(He also mentioned big boards existing for grindable events — a real case
whose clear rules were not discussed. Same rule applies: do not assume.)*

### The board is fixed per stage — answered 2026-09-17

> *"A fixed board per stage. It will never be randomised each attempt, so one
> dedicated board per stage. It might mean there will be a lot of boards if we
> end up making a lot of content, but that's fine… I don't think I'll be doing
> a hundred stages at this point — ten, twenty max, which is fine. Story ones
> may add up a lot, but that's still fine."*

**What it is, and what it is not.** A fixed board makes a stage a *recognisable
place* — the same terrain every attempt, with only the roll varying. **It is
not a mastery layer**, and the paragraph that stood here claiming a re-rolled
board would "turn skill into luck" was written before his correction above and
was wrong on the same point: routing is not the skill being tested. What fixed
boards actually buy is authoring control — he knows exactly what a stage
contains, because he placed it.

**Consequences for the data:**

- **A board is authored content, not generated.** It belongs in the encounter
  alongside its enemies, the way `trialEncounters.ts` already holds fights.
- **Authoring cost is the real constraint on the schema.** At 10-20 stages a
  hand-written board is fine, but the shape has to stay compact enough that
  writing one is not a chore — a tile list with links, not a coordinate
  grid. That is a design constraint on the data types, which is mine (#139).
- Story stages could multiply this, but story is parked until he finishes Arc
  One, so it is not a near-term pressure.

### Three independent axes — the summary this point ends on

| axis | what it decides | whose |
| --- | --- | --- |
| **Board shape** — minimal / linear / branching, and its length | how much journey wraps the content, and whether the player picks the run's depth | structural; mine to build, **his to choose per stage** |
| **Farmable** — `repeatable`, `autoClearEligible`, rewards | whether the stage is meant to be run again for loot | **entirely his, per stage** |
| **Difficulty** — enemy levels, kits, phases | how hard the stage is | **entirely in the fights**; the board contributes nothing |

**None of the three predicts another.** His example is the test case: *the same
Molvarr fight can sit on a small board or a big one*, and it is the same
difficulty either way. Do not derive farmability from shape (that mistake is
recorded above), and do not derive difficulty from either.

**The research in this point is complete.** Every question raised has an
answer: the roll and its authored pool, junctions, forced-stop tiles, board
shapes, multiple exits, loss semantics, clear semantics, farmability, board
persistence, and where difficulty lives. **It is ready to become a spec when he
wants one** — and nothing in it should be built before that spec is written
and read, per the plan-first rule in `AGENTS.md`.


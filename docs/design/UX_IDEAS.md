# Player-facing ideas — for review, not a work queue

> Written 2026-08-13 by Claude during an unattended session, at Tanveer's
> request: *"see how you can improve player facing UI and make a list. Mostly
> focus on QoL, utility, nice new additions or features (from dev to player) and
> overall better product... put that in the list so that i can review and
> understand it before i allow you to implement it during a future session."*
>
> **Nothing here is built.** Every entry is a proposal. Creative liberty was
> granted; the calls are still his.
>
> Deliberately excluded, because each belongs to a session he has reserved: the
> mobile layout pass, audio/SFX, story content and structure (objectives, stage
> map, multi-wave), ascension trials, and anything monetization.

**Confidence** says how sure I am the problem is real, not how good the fix is:
**High** = I read the code or he reported it · **Medium** = inferred from how
the systems fit together · **Low** = a hunch worth arguing with.

---

## Battle

### B1. Auto-battle for repeat clears — **REJECTED 2026-08-13, replaced by Auto Clear**

> Tanveer: *"i am shying away from auto battle because it would also mean
> designing a auto battle ai too and that's a big work."* Correct — a
> player-side AI has to handle 27 kits, ally targeting, ult timing and merges,
> and would be judged against how he plays.
>
> **Replaced by Auto Clear**, his design: an uncommonly-given ticket skips a
> fight you have already beaten, paying full rewards and **full stamina** per
> skipped run. Spec:
> `docs/superpowers/specs/2026-08-13-auto-clear-design.md`. Kept below for the
> reasoning that led there.

**Player:** A toggle that plays your turns for you using the same AI the enemy
uses, at whatever battle speed you've set. Leave it on and the fight resolves
itself; touch a card and you take back control.

**Why:** The world boss costs 40 stamina against a 120 cap, so a full bar is
three runs, and ascension band 3 wants 10 eyes and 25 seaweed — that's several
days of the *same fight* against a boss whose kit you already know. Every game
in this genre answers that with auto. The engine is already ready: `getAIMove`
is side-agnostic and the turn resolver already runs headless.

**Size:** Medium. A settings toggle, a branch in `resolveplayerTurnWrapper` that
calls `getAIMove` for the player side, and a visible "AUTO" badge with a manual
override. No engine change.

**His call:** whether auto is allowed in story battles and against the boss, or
farming only. My instinct: everywhere except a chapter's first clear.

### B2. Undo the last queued card — **High**

**Player:** Queue a card, realise it was wrong, press once to take it back
instead of resetting the whole hand.

**Why:** Reset Hand exists (it restores the turn-start snapshot including
selection merges), but it's all-or-nothing. Misqueuing the third card of three
currently costs you the two correct ones.

**Size:** Small. The snapshot machinery already exists; this is a shallower
version of it.

### B3. Show what a queued card will actually do, before it resolves — **Medium**

**Player:** With cards queued, the enemy tiles show a predicted damage number
the way they already show queued-hit markers.

**Why:** `damagePreview.ts` already computes exactly this for the archive's Kit
Preview, and `TeamUnitTile` already renders `queuedHits`. The information exists
and is already trusted elsewhere; it just doesn't reach the board.

**Size:** Medium. Mostly wiring, but the preview must read *effective* stats
mid-fight, not base ones, or it will lie.

**His call:** this is a real difficulty lever — knowing exact numbers makes
optimal play mechanical. Worth deciding whether it's a setting.

### B4. A turn-start summary of what changed — **Medium**

**Player:** A short line at the top of your turn: "Corrosion ticked 3 units ·
Lyra's DEF buff expired · Molvarr is at 2 stacks."

**Why:** Effects expire and DoTs tick between your turns, and the only record is
the log drawer, which you have to open and read. The turn you most need this is
the turn a buff you were relying on ran out.

**Size:** Medium. The tick events are already emitted (`emitHpTicks`); this is a
presentation layer over them.

### B5. Let the log drawer filter to one unit — **Low**

**Player:** Tap a unit in the log to see only what involved them.

**Why:** The drawer groups by turn, which is right for "what just happened" and
wrong for "why is Chiara dead". Events carry `instanceId` already.

**Size:** Small.

---

## Deck and hand

### D1. Say why a card can't be played — **High**

**Player:** A sealed or unusable card says so on its face, instead of just
refusing the tap.

**Why:** The engine fizzles a sealed skill defensively and logs it (*"Leorio's
attackDebuff skills are sealed — Switchblade Attack fizzles"*), but that's after
the fact, in the log. A player who doesn't know about seals just sees a card
that does nothing.

**Size:** Small. `isImmuneToStatDebuff`/seal state is on the unit; the card face
needs a disabled treatment and a reason tooltip.

### D2. Show merge partners before the drag — **Medium**

**Player:** Cards that would merge with the one you're touching light up on
press, not only once you're dragging.

**Why:** Partners already light on hold (`partnerIds`), but the discovery path
is press-and-hold, which nobody finds by accident. Merging is the whole ranking
system.

**Size:** Small — mostly a timing change to an existing highlight.

### D3. A "what happens if I merge these" hint — **Low**

**Player:** While two partners are lit, show the resulting rank.

**Why:** Rank drives `damageRanked` and `*Ranked` values, so R2→R3 is often a
large jump the player can't see coming.

**Size:** Small.

---

## Roster and archive

### R1. Compare two characters side by side — **Medium**

**Player:** Pick two units in the archive and see their kits and stats in
parallel columns.

**Why:** Team building currently means opening one page, remembering it, and
opening another. The archive already renders a full kit document per character
and `CharacterBrowser` already sorts and filters across the population.

**Size:** Medium. Mostly layout; the data projection (`CharacterKitView`)
already exists and is shared by the archive and the battle panel.

### R2. "Who else has this mechanic?" — **Medium**

**Player:** Tap **Corrosion** anywhere and get the list of characters whose kits
use it.

**Why:** `CharacterListOverlay` already does this for *tags*, and
`getCharacterMechanics` already collects every mechanic a kit uses, including
per-phase and SP. Same pattern, different index. Mechanics are the thing players
actually build teams around.

**Size:** Small-to-medium — the pieces exist.

### R3. Mark a character as a favourite — **Low**

**Player:** Star a unit; starred units sort first everywhere.

**Why:** 27 kits and growing, with a `showUnownedCharacters` toggle already
acknowledging the list is long.

**Size:** Small. A `Set<string>` in `playerStore` and a sort key.

---

## Progression and materials

### P1. Tell the player what they're short of, before they open ascension — **High**

**Player:** The character card shows "needs 6 more seaweed" rather than making
you open the ascension screen to find out.

**Why:** This is exactly the wall he hit in playtesting — sitting on 8 eyes and
4 seaweed against a band asking 3:10, with nothing surfacing the imbalance until
he counted it himself. The audit that came out of it now asserts the drop ratio
covers every band, but the *player* still has no readout.

**Size:** Small. `canAscend` already compares inventory to `ASCENSION_COSTS`; it
just needs to return the shortfall instead of a boolean.

### P2. "Runs remaining" on the world boss — **Medium**

**Player:** The boss entry shows "3 runs from your next ascension" using your
current materials and average drops.

**Why:** A farming loop with no visible end feels endless. The numbers are all
known constants (`BASE_SEA_MONSTER_EYE`, `BASE_CORRODED_SEAWEED`,
`ASCENSION_COSTS`).

**Size:** Small.

**His call:** whether to show an estimate at all — it makes the grind legible,
which is good for trust and bad for mystique.

### P3. Post-battle rewards, itemised and animated — **Medium**

**Player:** The victory screen counts up each drop, with new-item emphasis.

**Why:** A clear currently pays eye, seaweed, 3–6 manuals, 2k–10k coin, 20–50
gems, 1–3 tickets and 100 account XP — **seven currencies**, and the design doc
itself had forgotten four of them. If the doc lost track, the player has too.

**Size:** Medium. Presentation over an existing `rollWorldBossRewards` result.

---

## Home, navigation, profile

### N1. Replace the native `prompt()` and `alert()` — **High**

**Player:** Naming or renaming a team preset uses an in-game dialog, not the
browser's grey box.

**Why:** `TeamPicker.tsx` calls `window.prompt` twice and `window.alert` once.
It breaks the Combat Terminal look completely, it's unstyleable, and on mobile
it's a system sheet over your game. This is the single most obvious "this is a
prototype" tell left in the UI.

**Size:** Small. A `DetailOverlay`-based input modal; the primitive exists.

**Confidence:** High — I read the calls.

### N2. A real settings screen — **Medium**

**Player:** One place for battle speed, music volume, reduced motion, the grey-
effects toggle, and unowned-character visibility.

**Why:** `settingsStore` carries at least six player-facing preferences and they
surface in scattered places — speed in the arena, volume in a TopNav popover,
the grey toggle formerly inline in the info panel. A player who changed one
can't find where they changed it.

**Size:** Medium.

### N3. Show stamina regen as a countdown — **Low**

**Player:** "Next point in 2:41", not just `84/120`.

**Why:** Regen is computed, never a timer (`current + floor((now - updatedAt) /
5min)`), so the number is exactly derivable. Knowing when you can play again is
the difference between closing the tab and waiting.

**Size:** Small.

---

## Cross-cutting

### X1. An in-game glossary for mechanics — **High**

**Player:** Tap **Concentrate**, **Pierce**, **Corrosion**, **Extort** anywhere
and get a plain-language explanation.

**Why:** `KeyworkHighlighter` already exists and the wording system already
generates tiered phrases with per-skill hover values. But the *rules* — that
Concentrate is ×1.5 at one target and ×1.1 at three, that Pierce ignores 50% of
DEF, that Corrosion stacks uncapped off remaining HP — live only in the design
docs. A player cannot learn them from the game.

**Size:** Medium. One authored glossary keyed by mechanic type, surfaced through
the existing highlighter.

**Note:** this is also the cheapest fix for the thing that made P2 feel unfair —
Concentrate scaling *up* as your team shrinks is invisible unless you're told.

### X2. Damage numbers should say where they came from — **Low**

**Player:** A hit that crit, pierced, or was boosted by Corrosion says so on the
floater, not just in the log.

**Why:** The engine already collects exactly this per target (`targetEffects`
carries "+20% vs Corroded", "a CRITICAL hit") and then flattens it into a
string. The sequencer shows `CRIT` and now `TANKED`; the rest is available.

**Size:** Small-to-medium.

### X3. Let the player replay the last battle's log after it ends — **Low**

**Player:** The victory/defeat screen keeps the log drawer reachable.

**Why:** Right now the fight ends and the record goes with it. Ruling #72 says
the drawer is a player-facing feature; the moment a player most wants it is
right after losing.

**Size:** Small — the events are still in the store when the result screen
shows.

---

## Ranked shortlist

If only three get built, these are the three I'd pick — highest confidence,
lowest risk, each fixing something a player hits in the first session:

1. **N1** — the native `prompt()` boxes. Small, and it's the most visible
   remaining prototype tell.
2. **P1** — tell the player what they're short of. This is his own playtest
   complaint, still unaddressed on the player's side.
3. **X1** — the mechanics glossary. The rules exist only in `docs/`, and the
   game asks players to beat a boss built around one of them.

**B1 (auto-battle)** was the biggest single quality-of-life win in the list and
was the right thing to put in front of him rather than in a build queue: he
rejected the approach and replaced it with **Auto Clear**, which solves the same
player problem without an AI. That spec is
`docs/superpowers/specs/2026-08-13-auto-clear-design.md` and is the one item
from this document with a decision already on it.

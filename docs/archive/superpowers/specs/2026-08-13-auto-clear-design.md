# Auto Clear — design

> Spec written 2026-08-13 from Tanveer's direction, and **built the same day**
> once he settled the open numbers — see "BUILT" at the end for what landed and
> what changed along the way. Uncommitted, like the rest of that batch.

## Why this and not auto-battle

Auto-battle was the obvious answer to the world-boss grind and he rejected it
for a concrete reason: *"it would also mean designing a auto battle ai too and
that's a big work."* He is right — the enemy AI (`lib/game/ai.ts`) picks moves
for a boss with a fixed kit against a known board. A player-side AI has to
handle 27 kits, ally targeting, ult timing, and merge decisions, and it would be
judged against how *he* plays.

Auto Clear sidesteps the problem entirely: it does not simulate a fight, it
**pays the cost and grants the reward** for a fight the player has already
proven they can win.

The design's load-bearing property, in his words: auto clear *"would still use
same amount of sta it needs for each instance of fights it's skipping."*
**Stamina stays the only throughput gate.** The ticket buys time, never
resources. That is what makes the feature unexploitable — it cannot produce a
single material the player could not have farmed by sitting through the fights.

## Rules (all settled by Tanveer, 2026-08-13)

| Rule | Decision |
| --- | --- |
| Cost per skipped fight | **Full stamina**, identical to fighting (Molvarr = 40) |
| Ticket value | **1 ticket = 1 fight** |
| Rewards | **Full roll per fight**, identical to fighting |
| Unlock | **Must have cleared that fight manually at least once** |
| Eligible content | **Molvarr only for now.** More as the game grows |
| Sources | **Bureau Orders missions** + **5 tickets per account rank-up**. More sources later |

### Why full rewards

A reduced roll would make auto-clear a punishment, and players would fight
manually to avoid the tax — which is the feature failing at its only job. Since
stamina is unchanged, "full roll" costs the economy nothing: the ceiling on
materials per day is the stamina bar, not the ticket count.

### Why a manual clear first

A new account should not be able to skip Molvarr without ever seeing the phase
transition, the knockdown beat, or the boss's kit. The gate also means a ticket
can never be spent on a fight the player would lose.

## New currency: Auto Clear Ticket

**Not a material.** `playerStore.inventory` is documented as "materials only"
and materials are spent on ascension; a ticket is neither. It sits alongside
`permanentTicket` as a top-level count.

```ts
// store/playerStore.ts
autoClearTickets: number;
```

**Migration v7 → v8**: initialise to `0` for existing saves. No back-pay — the
grant hooks below will fill it naturally.

### Grant: account rank-up

`grantAccountXpAction` already detects `rankedUp` and refills stamina there.
The ticket grant goes in the same place, with one trap worth naming:

**A single XP grant can cross more than one rank.** `grantAccountXp` applies
banked XP in a loop, and `clearRankWall` deliberately re-applies everything
banked while the player was stuck at a wall — which can jump several ranks at
once. So the grant must be **5 × (ranks gained)**, not a flat 5. Getting this
wrong silently underpays exactly the players who were blocked longest.

### Grant: Bureau Orders

`lib/game/orders.ts` already validates rewards through a Zod schema. Add:

```ts
autoClearTickets: z.number().int().nonnegative().optional(),
```

and pay it in the same claim path as `gems` / `permanentTicket` / `materials`.
The evaluator itself needs no change — it is already general, which is why
daily missions were described as "mostly a data change".

**Order content is Tanveer's**, like every other reward number. The goal types
that already exist and suit ticket rewards: `bossClears`, `accountRank`,
`characterAscension`.

## Eligibility

`lib/game/events.ts` already models each fight as an entry with its own
`staminaCost`, and its own comment says the page used to be "hardcoded to one
boss id and one stamina cost". Auto Clear extends that shape rather than
special-casing Molvarr:

```ts
/** Auto Clear may be spent on this event. Absent = manual only. */
autoClearEligible?: boolean;
```

Molvarr's entry sets it. The trials and any future event leave it off until he
says otherwise.

**"Cleared manually at least once"** needs a per-event record. `playerStore`
already tracks lifetime stats; the cheapest honest version is a set of event ids
the player has beaten:

```ts
clearedEvents: string[];
```

Recorded on a **manual** victory only — an auto-clear must never be what
unlocks auto-clear.

## Flow

1. On the event card, next to ENTER: **AUTO CLEAR ×N** where N is the ticket
   count. Hidden entirely if the event isn't eligible; shown disabled with the
   reason if it is eligible but unclearedered ("Clear this once to unlock").
2. Tapping opens a confirm sheet: how many runs (capped by tickets, by stamina,
   and by any inventory cap), the total stamina, the total tickets.
3. Confirm resolves **N independent reward rolls** — `rollWorldBossRewards` per
   run, not one roll multiplied. The 10% bonus branches must roll per fight or
   the variance disappears and the average shifts.
4. A results screen itemises the combined haul. This is the same summary the
   manual victory screen wants (idea **P3** in `UX_IDEAS.md`) — build it once,
   use it twice.
5. Account XP applies per run, so a batch can rank the player up mid-sequence.
   Since a rank-up grants tickets **and** refills stamina, resolve runs
   sequentially and re-read both after each.

## Edge cases that need to be right

- **Not enough stamina for all N** — clamp to what's affordable and say so
  before spending, never after.
- **Rank-up mid-batch refills stamina.** Do not pre-compute the whole batch's
  affordability up front; a mid-batch refill legitimately allows more runs than
  the opening state suggested.
- **Tickets and stamina must be spent atomically per run.** A failure halfway
  through must not consume a ticket without paying out.
- **Do auto-clears count toward `bossClears` orders?** They are real clears
  paying real rewards, so yes — but flag it, because an order rewarding tickets
  for boss clears that auto-clears satisfy is a small loop. Not a problem at
  1 ticket = 1 fight with full stamina cost, but worth stating.
- **First-clear bonuses** are not in play: the manual-clear gate means the first
  clear already happened.

## Testing

Pure logic in `lib/game/autoClear.ts` — how many runs are affordable given
tickets, stamina and cost; the rank-up ticket grant across a multi-rank jump.
Store tests for atomic spend and the v7→v8 migration. The existing
`worldBossRewards.test.ts` invariants already cover the reward roll itself.

## Open — Tanveer's numbers

1. **How many tickets do the starter orders pay**, and which orders carry them.
2. **Is there a cap** on banked tickets? (Recommend no cap — stamina already
   limits use, and a cap punishes the player for not logging in.)
3. **Ticket name in-game.** "Auto Clear Ticket" is his working name and reads
   fine; flagging only because item names are his.

---

## BUILT 2026-08-13

Shipped in the same session the spec was written, after Tanveer settled the
three open numbers. **Uncommitted**, like everything else in that batch.

**His answers:** 10 tickets across the authored orders (placeholder, his to
tune), **no cap** on banked tickets, and "Auto Clear Ticket" confirmed as the
name.

**What landed:**

- `lib/game/autoClear.ts` — `runsAffordable`, `autoClearAvailability` (one
  actionable blocker, not a list), `maxBatchSize`, `AUTO_CLEAR_TICKETS_PER_RANK`.
- `playerStore` **v7 → v8** — `autoClearTickets` and `clearedEvents`, both
  additive. `spendAutoClearRun` takes ticket and stamina atomically or neither.
  `recordManualClear` is called only from a real victory.
- Rank-up pays `5 × ranks gained`, not a flat 5.
- `autoClearEligible` on the event registry; Molvarr only, and a test asserts
  no non-repeatable event ever carries it.
- The events brief gains AUTO CLEAR beside ENTER, hidden when ineligible and
  explained when the fight hasn't been beaten yet.
- Batch resolution is sequential and re-reads the store each run, because a
  rank-up mid-batch refills stamina and pays tickets.

**Found while building, both corrected:**

- The results screen listed **four** of a clear's seven payouts — no gems, no
  permanent ticket, no account XP. Same three the design doc had lost. Now
  built from the reward object so a new field can't be dropped twice.
- The brief's reward preview was wrong on **every line**: it promised 2–4 eyes
  (ships 1 +10%), 1–3 seaweed (ships 4 +10%), 1–2 manuals (ships 3–6) and
  3,000–6,000 coin (ships 2,000–10,000).

**Still open:** which orders carry tickets, and how many, is placeholder like
every other order reward.

### Corrected after his review

**Gems were leaking through auto clear** — he caught it immediately. The world
boss paid 20–50 gems per clear and Auto Clear inherited that, which would have
made a ticket a gem printer. Gems are now first-clear only game-wide (ruling
#80), and Auto Clear passes `AUTO_CLEAR_IS_NEVER_FIRST_CLEAR` — safe by its own
unlock gate, since a manual clear must already have happened.

This is exactly the failure mode the "buys time, never resources" rule exists to
prevent, and it slipped in through a reward that was already wrong before Auto
Clear existed.

**Results are a table, per his spec:** one row per run (instance id, stamina
used, stamina remaining, a button to that run's rewards), then a totals row with
a button for the combined haul. Both open the same modal.

**Still open:** the boss pays 1–3 Permanent Tickets on every clear. Same class
of problem as the gems, other currency, not yet ruled.

### Rewards restructured (ruling #80) — supersedes the gem note above

My first gem fix was wrong: it gated gems behind a flag but left the amounts
rolled. Tanveer: *"first clear rewards aren't supposed to be chance based with
amounts."* The real defect was one roll table doing two jobs.

**Every fight now pays two lists.** First clear = bundle + farm, together.
Every clear after = farm only.

Molvarr's bundle is fixed: 50 gems, 3 eyes, 10 seaweed, 50,000 coin, 50 account
XP, 15/10/5 manuals by tier, 1 Permanent Ticket. Molvarr's farm is eyes,
seaweed, coin, basic manuals and account XP at the existing rates, and nothing
else — so **neither summon currency is farmable**, which also closed the
Permanent Ticket question without a separate ruling.

For Auto Clear specifically this changes nothing structurally: a ticket already
could not produce a first clear, so it pays the farm and only the farm. It does
mean the earlier note's "still open: permanent tickets" is now resolved.

### Difficulty tiers (ruling #81) — changes the unlock model

Molvarr is now several fights, one per world level, each with its own reward
tables. **Auto Clear unlocks per tier**, not per event: `clearedEvents` keys as
`molvarr@3` via `tierKey`, so a world-level-1 clear cannot open auto clear on
the world-level-4 fight.

This resolves the question raised when the earlier reward-multiplier model was
still on the table — "Auto Clear doesn't record which difficulty you beat it
at" — by making the difficulty part of the record.

`autoClearAvailability` takes `difficulty` and reports `locked` for a tier the
player hasn't personally beaten, whatever they've cleared elsewhere.

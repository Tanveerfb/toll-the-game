---
name: newevent
description: Author a new PvE event the way he decides it - a world boss, an ascension trial, or an Epic Battles arc or stage. Gets his two answers (may it be seen, may it be entered) and the rest of the brief before writing a line, then authors the entry, the encounter, the two reward lists, the guards and the measurement in one fixed order. Use when he says "new event", "add a boss", "another trial", "new arc", "new stage", "put <enemy> on the events board", or any PvE content that is not a character kit. Never invents a number, a reward or a gate.
---

# newevent

A new event needs **two answers, not one** (ruling #127): *when may it be
seen* and *when may it be entered*. The board answers them differently for
every event it has, and he said to log this so the question gets put to him
when he forgets to volunteer it. This skill is that log, plus everything else
an event turned out to need.

## Where the truth lives

- `lib/game/events.ts`: `GameEvent`, `GAME_EVENTS`, `visibleWhen` /
  `isEventVisible` (seen), `requiredRank` / `eventLockReason` (entered),
  `hasEncounter` (a fight exists behind it).
- `lib/game/eventTabs.ts`: the tabs, filled by `kind`, never by id (#177).
- `lib/game/trialEncounters.ts`: a trial's multi-fight `RunnableEncounter`
  (`lib/game/fightRun.ts`, #103, #136).
- `lib/game/worldBossRewards.ts`: a boss's tiers, each with a fixed
  `firstClear` bundle and a `farmable` table (#80); `lib/game/autoClear.ts`.
- `lib/game/epicBattles.ts` + `data/arcs/*.json`: Epic Battles arcs, zod
  parsed; `lib/game/epicClears.ts` the clear record (#175).
- `lib/game/accountRank.ts` (`RANK_WALLS`), `lib/game/worldLevel.ts`.
- `store/playerStore.ts`: `clearedEvents`, `account.clearedWalls`,
  `epicClears`, `autoClearTickets`; the `savefield` skill for any new field.
- Tests: `eventVisibility`, `eventTabs`, `trialEncounter`, `ascensionTrial`,
  `worldBossRewards`, `autoClear`, `epicClears`.
- Rulings: #127 (two questions), #80 (two reward lists), #86 (be frugal),
  #78 (Auto Clear: Molvarr only, never a one-off), #136 (trial structure,
  **PROVISIONAL**), #137 (stage / fight / phase vocabulary), #138 (no
  counter, never a nerf), #177 and #178 (no counts, less is more).
- `Plans/2026-09-16-pve-structure.md`: his vision in his words. **Read it
  before designing any PvE content.** `docs/design/WORLD_BOSS_AND_ASCENSION_PLAN.md`
  for the locked boss rewards and ascension costs.

If `lib/game/events.ts` is deleted, delete this skill in the same commit.

## Step 0: which kind

| He wants | It is | Authored in |
| --- | --- | --- |
| A boss on the board | `GameEvent` `kind: "boss"` + a character with `tier: "elite"` and phases + reward tiers | `events.ts`, `data/characters/`, `worldBossRewards.ts` |
| A trial on the board | `GameEvent` `kind: "trial"`, `enemyId: null`, a `RunnableEncounter` | `events.ts`, `trialEncounters.ts` |
| An arc or a stage | not a `GameEvent`: an arc JSON, sequential unlock, no rewards yet | `data/arcs/`, parsed by `epicBattles.ts` |
| A new category or tab | a design question, not an authoring job | ask him; `#137` names the categories |

A wave, a phase and a fight are different things (#137). Use his words.

## Step 1: the brief, before any code

Ask with the question tool where there are options and in prose where he has
to explain. Every row below is his; Claude never fills one in.

1. **Seen when?** From the start, from a rank, after a wall or another clear.
   Goes to `visibleWhen` (`minRank`, `clearedWalls`). Absent = visible from
   rank 1. The first trial is the only event seen wider than it unlocks, on
   purpose: an invisible wall was the whole reason it was authored.
2. **Entered when?** `requiredRank`, and whether a one-off is "Already
   cleared" after (`clearsWall`). Expect him to give one answer and ask for
   the other; #127 says so.
3. **What is fought.** A boss: which character, phases, SP cadence, world
   levels (one fight per level, #80). A trial: the fights in order, one HP
   bar, the levels. He designs the encounter; Claude builds it.
4. **Stamina cost** and **repeatable or one-off**.
5. **Rewards, as two lists** (#80): a fixed first-clear bundle, never
   rolled, and a farmable roll. Tiers pay better by a better table, never
   by a multiplier. Frugal by default (#86): a short resource is future
   content, not a bigger number. Arcs pay nothing yet.
6. **Auto Clear**: only a repeatable event, only when he says. Molvarr alone
   today (#78).
7. **Difficulty band**: which player band it is tuned against (`playerBand`
   in the simulator, 2026-09-16), in his words (*"a team of all level 20
   chars would have a 4/10 difficulty feel"*).
8. **Copy**: kicker, name, summary. Draft it, show it, apply on a yes.

## Step 2: author, in this order

1. The `GameEvent` entry (or the arc JSON), copying the nearest existing
   entry's shape. Write the visibility rule as a comment in his words, as
   the three existing entries do.
2. The encounter through `buildBattleUnit` only: a boss's phases and stage
   effects go through `battleStats` like everything else (AGENTS.md engine
   rules). A trial's fights are a `RunnableEncounter`.
3. The reward tiers, both lists, fixed amounts in `firstClear`.
4. Any new save field through the `savefield` skill (cloud-sync decision,
   migration, `CLOUD_FIELDS`); a clear record is `clearedEvents` or
   `epicClears`, not a new shape.
5. Art: the brief's portrait and the board card. Never block (AGENTS.md);
   `comfypending` queues it and the event ships with the fallback.

## Step 3: the guards

- `tests/eventVisibility.test.ts`: add a case per new event pinning **both
  answers**, and keep its reachability guard green (no authored event is
  unreachable by any player state).
- `tests/eventTabs.test.ts` if the event is a new kind.
- Rewards: a test that the first clear pays both lists and the second pays
  the farmable list alone, as `worldBossRewards.test.ts` does.
- **One question, one check.** The Enter button reads `eventLockReason` and
  `hasEncounter`; a screen never adds a second condition of its own. On
  2026-09-17 the brief gated Enter on `!!event.enemyId`, which is null on a
  trial, while `eventLockReason` reported the same trial unlocked, and the
  First Ascension Trial shipped unenterable. Prove a new guard fails before
  trusting it (reintroduce the bug, watch it go red).

## Step 4: measure, then report it his way

`npm run sim -- --roster <enemy>` for a boss; `simulateRun` with the band he
named for a trial. Read the limits at the top of `lib/game/simulate.ts`
first: the AI plays the player side too, so a clear rate is a **floor**.
Report the band, the clear rate, where the losses happen. A team that
clears at 100% is *"X currently has no counter"* with the interaction named
(#138), never a defect, never a nerf, never an encounter tuned to route
around a kit he can change.

## Step 5: record

The brief's answers go into the ledger with the `ruling` skill (his words,
both questions), the board state into `docs/STATUS.md`, and the art request
into `docs/ART_REQUESTS.md`. A trial built before he settles its structure
is marked PROVISIONAL like #136, not presented as done.

## Do not

- Author an event with one of the two answers missing. Ask.
- Invent a stamina cost, a reward amount, a level, a band or a gate.
- Roll a first-clear amount, multiply a farmable table by difficulty, or put
  Auto Clear on a one-off.
- Show a count, a clear tally, a best-turns readout or a progress chip on
  the board or the brief (#177, #178).
- Gate a screen on a second condition that answers a question
  `eventLockReason` or `hasEncounter` already answers.
- Add story hooks or chapter gates: story is parked (#152); Molvarr's
  chapter-9 gate returns with it, not before.

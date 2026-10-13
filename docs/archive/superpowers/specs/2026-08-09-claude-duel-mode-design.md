# Duel Mode — Play Against Claude

> Date: 2026-08-09 · Status: design, not yet built · Dev-only

## Problem

Tanveer can't learn how his kits behave against an opponent that plans, and Claude can't learn how they *feel* to pilot. The scripted AI never exploits a kit's weakness, never holds a stance for an incoming ultimate, and never punishes a wasted cleanse — so kits look balanced right up until a thinking opponent abuses them.

Both goals are served by the same thing: let Claude control the enemy side of a real battle.

## What this is (and isn't)

**It is a swap of who decides the enemy's actions.** Nothing else changes. Rewards, stamina, first-clear detection, story progress, drops, boss phases and the enemy's hidden hand all behave exactly as they do today — Tanveer winning a story chapter against Claude pays out normally. The only altered behaviour is the source of the enemy's `Action`.

**It is not** a new game mode, a new screen, a multiplayer system, or anything a player will ever see. Development builds only.

## Decisions (Tanveer, 2026-08-09)

| # | Decision |
|---|---|
| 1 | Available on **every PvE battle** — practice, story, world boss. |
| 2 | Opt-in per session via a **"Use Claude"** control; battles run against the scripted AI unless it's on. |
| 3 | **Rewards are unaffected.** Winning against Claude grants exactly what winning against the AI grants. |
| 4 | Claude does **not** watch the browser. A module writes the battle state to a text file; Claude reads it and responds on its turn. |
| 5 | Purpose is **fun and training, both.** |

## Architecture

### The seam

`hooks/BattleProvider.tsx:566` is the single call to `getAIMove`. Duel mode branches there: instead of asking the AI for an `Action`, park and wait for one to arrive from disk. Everything around it — action budget (`enemyActionsForTurn`), the enemy hand, refills, merges, gauge, forced boss SP — is untouched.

**Boss mechanics stay automatic.** Molvarr's forced SP every 3rd phase-turn (`bossForcedSpAction`) and phase transitions are *mechanics*, not decisions. Suppressing them would mean fighting a different boss than the one authored. Claude controls the remaining actions of the turn.

### Files — `.duel/` (gitignored)

| File | Written by | Purpose |
|---|---|---|
| `state.md` | the game | The full picture the moment it becomes Claude's turn |
| `move.json` | Claude | The actions to take |
| `result.md` | the game | End-of-battle signal and final standings |
| `duel-log.md` | both | Append-only history: every state, every move, and Claude's reasoning |

**`result.md` exists because the first duel exposed its absence.** A finished
battle writes no new state, so a watcher polling `state.md` waits forever and
never learns the fight ended — Claude simply went quiet after its last move.
The game now posts a result when the phase reaches victory or defeat, and a
fresh battle clears any stale one. Anything watching should watch **both**
files.

`duel-log.md` is the training artefact. Without a record of *why* each move was chosen, we get entertaining games and no durable improvement to `getAIMove`. Turning that log into heuristics is a **separate future batch**, not this one.

### `state.md` contents

Written as readable markdown, not JSON — it is read by a language model, and prose costs nothing here.

- Turn number, phase, how many actions Claude gets this turn
- **Claude's units**: name, HP current/max, effective ATK/DEF, ult gauge, every buff/debuff/effect with values and remaining turns, passive state (stacks etc.)
- **Claude's units' full kits** — every skill with its resolved description, the ultimate, and the passive in full. Piloting a unit means knowing what it can do, not just what its stats are (Tanveer, 2026-08-09). For a phased boss this is the **active phase's** kit.
- **Scheduled and forced behaviour**, so it can be planned around rather than discovered: Molvarr's forced SP every 3rd phase-turn (which turn it next fires), turn-N passives like `bossStatSpike`, and the current phase turn counter. Claude respects these the same way the scripted AI does — they consume an action and are not Claude's to suppress.
- **Claude's hand**: each card, its rank, its skill, and what that skill does at that rank
- **Tanveer's living field units**: same stat and status detail, plus their kits — a player can read an opponent's kit from the archive, so this is public information
- Recent battle events, so Claude knows what just happened to it

**Deliberately excluded: Tanveer's hand and his queued cards.** Seeing them would mean reading his plan rather than testing his kits, which destroys the balance signal. Claude sees exactly what a player sees on the board.

### `move.json` contents

```jsonc
{
  "turn": 3,                    // guards against a stale move being applied
  "actions": [
    { "cardIndex": 2, "targetInstanceId": "duke" },
    { "cardIndex": 0 },         // no target = engine picks a living field unit
    { "pass": true }
  ],
  "reasoning": "Held the stance..."  // appended to duel-log.md
}
```

Validated before use: the turn must match, cards must exist in the hand, targets must be alive and on the field. An invalid move is rejected and the turn falls back to the AI rather than corrupting the battle.

### `/api/dev/duel` — the bridge

The browser cannot read the filesystem, so a dev-only route mediates. `POST` writes `state.md`; `GET` returns a pending move if one exists. **404s outside development**, checked server-side — the route must not exist in a production build regardless of what the client sends.

### UI

- **Toggle in `TopNav`, beside the audio control, dev-only.** One placement covers practice, story and world boss without touching three separate start screens. Persisted in `settingsStore`.
- **A `DUEL` badge in the battle status strip**, so it's never ambiguous who is playing the enemy.
- **A waiting overlay** on the enemy turn showing that Claude is thinking, with the escape hatch on it.

### Escape hatch — mandatory

A **"Let the AI take this turn"** button, visible the entire time the battle is waiting, plus an automatic fallback after a timeout. Tanveer must never be stuck because the conversation ended mid-fight. This is the single most important requirement in the document: without it, duel mode can brick a battle in progress.

## Testing

- `move.json` validation: stale turn rejected, unknown card rejected, dead/benched target rejected, malformed JSON rejected — each falls back to the AI rather than throwing.
- State serialisation: a known battle produces a state file containing both teams' units, the hand, and no reference to the player's hand or queued cards.
- The API route 404s when `NODE_ENV !== "development"`.
- Existing battle tests must stay green — duel mode is off by default and must change nothing when off.

## Reading duel results: the 1v1 distortion

**A 1v1 duel is not a balance sample.** Learned the hard way in the first
session (2026-08-09): Duke looked dominant, and the conclusion drawn from it —
"Flowing Ruin is overtuned" — was wrong, caught by Tanveer.

The deck is the reason. Hand capacity is 4/5/7/8 cards for 1/2/3/4 living field
units, and draws are uniform across those units' skills. So a character's cards
are ~100% of the hand in a 1v1 and ~25% in a 4v4. Simulated empowerment
cadence for Duke, assuming the player always plays his card first (his best
case):

| Format | Empowered hits / 8 turns | Cadence |
|---|---|---|
| 1v1 | 7.0 | every 1.1 turns |
| 4v4 | 1.7 | every 4.6 turns |

A **4× swing** in the uptime of the passive that defines him. Any attack rider
also narrows: an empowered AoE spreads its debuff across the enemy team, an
empowered single-target doesn't.

**Before concluding anything from a duel, ask whether the effect scales with
card frequency.** Formats systematically distort:

- **Overrated in 1v1** — stack builders, ramp passives, anything charging off
  its own card draws (Duke's Flowing Ruin, Diane's Giant's Will, Seras's
  Charged).
- **Underrated in 1v1** — supports, tag synergies, taunt/protect units, and
  anyone whose kit reads on teammates (Sara and Yalina measure as *1 damage* in
  a raw damage table; their value is entirely in a team).

Encounter-specific tuning is still valid when the encounter itself is 1v1 —
Lyra's boss-exclusive ATK-down immunity exists because the canon Duke-vs-Lyra
duel really does let him empower every turn.

## Project damage by running the engine, never by hand

Every hand-rolled damage estimate in the first two duel sessions came out wrong
in the same direction, because the arithmetic kept omitting modifiers the
engine applies. The three that bit:

1. **Type advantage** — ±20%/−10% (ruling #11). Duke is blue, Lyra red, so he
   was getting +20% and she −10%: a **30% swing** absent from every hand
   estimate. Measured against the log: predicted 232 → actual 208 (×0.9),
   predicted 1117 → actual 1339 (×1.2).
2. **Universal 5% lifesteal** — scales with damage dealt, so the side already
   winning heals more and the gap *widens*. Duke healed ~200 in a turn where
   Lyra healed ~33.
3. **Mid-turn stat changes** — a defender's DEF climbs as it plays its own
   self-buffs, so later cards in the same turn hit softer than a static model
   predicts.

**Use `executeSkill` against real kits for any projection that informs tuning.**
The Surge retune to 1850 was engine-computed and held exactly; Lyra's HP and
multiplier tuning was hand-computed and needed two further corrections to reach
the same target. A short throwaway script driving the real engine costs a
minute and removes the entire class of error.

## Risks

- **A stalled battle** is the main failure mode. Mitigated by the escape hatch and timeout.
- **Leaking hidden information** into `state.md` would silently invalidate every balance conclusion drawn from these games. Covered by a test asserting the player's hand never appears.
- **Turn desync** if a move arrives late. Mitigated by the `turn` guard.
- **Pace:** one message exchange per enemy turn. Fine for a dedicated session, unusable as a casual game — which is what the escape hatch is for.

## Explicitly out of scope

Reasoning→heuristic analysis, spectating, Claude drafting its own team, and any form of matchmaking. First version is: Tanveer sets up a battle as he does today, flips the toggle, and plays it.

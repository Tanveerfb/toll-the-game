# World Boss + Character Ascension — Implementation Plan

> Status: DESIGN LOCKED (core), NOT BUILT. Drafted 2026-07-18.
> Owner: Tanveer (design). Kit for the monster is deferred (premium boss pass).
> This plan covers the *meta* systems that wrap the fight, not the monster's kit.

Retrofits meta-progression onto a game that currently has none (fixed kits, ranks r1/r2/r3, `playerStore` is a stub). The lake behemoth (`public/npc/sea_monster.png`) is the first world boss.

---

## Locked decisions

| Decision | Value |
|---|---|
| World boss = story boss? | Same fight, second framing (also the one-time 2nd main story boss after Tao) |
| Entry gate | Stamina: cap **120**, regen **+1 / 5 min** (full in 10h), **40 per run** (3 runs/full bar) |
| Rewards | Common **level-up mats** (per clear) + signature rare drop **"Sea Monster's Eye"** (working name) |
| Sink | Every playable character gains a **level system** |
| Stat growth | **Flat** per level, **per-character constant**, ~**2x base at cap** |
| Stat formula | per-level gain = `base_stat / (cap - 1)` for ATK/DEF/HP → auto role-weighted, no hand-authored numbers |
| Cap / bands | Tentative **Lv60, 6 ascension bands of 10** (Tanveer to confirm) |
| Ascension gate | Crossing a band consumes **Eyes + other items**, **per-character requirements** (e.g. Duke = 6x Eye + extras) |

---

## Data model

### Firestore `users/{uid}` (extends existing `storyProgress`)
```
users/{uid} {
  storyProgress: { completed: [...] },        // existing
  stamina: { current: number, updatedAt: ts },// offline regen: current + floor((now-updatedAt)/5min), cap 120
  inventory: {                                 // materials by id
    "sea_monster_eye": number,
    "<common_mat_id>": number,
    ...
  },
  characters: {                                // per-character progression
    "duke": { level: number, ascension: number },
    ...
  }
}
```
- **Stamina regen is computed, never a timer.** On load: `current = min(120, stored.current + floor((now - updatedAt)/300s))`; write back `updatedAt` when spent. Works offline, no cron.
- Guest mode: mirror the same shape in `playerStore` (localStorage) so unsigned players still progress; sync-up on login (union/merge like storyProgress).

### Stat application
- `lib/game/stats.ts` gains a pre-step: `leveledBase = base + perLevelGain * (level - 1)`, applied before buffs/debuffs (which stay multiplicative on top).
- `perLevelGain[stat] = round(base[stat] / (cap - 1))`.
- Ascension caps the level: `maxLevel = ascension * 10` (band gating). Leveling past a band is blocked until the ascension item cost is paid.

---

## Build order (each phase self-contained + testable)

1. **Character level system** (foundation — nothing to farm for without it)
   - `level`/`ascension` on the progression store; `stats.ts` leveled-base step; unit tests on the 2x-at-cap curve.
   - A character-detail level/ascension UI (reuse archive/KitDetails surface).
2. **Stamina** — user-doc field + computed regen + spend guard; a small HUD readout.
3. **World-boss encounter** — new menu route + boss-select; reuses `startCustomBattle` + battle shell; a results/reward screen.
4. **Drop tables + inventory** — roll mats + Eye on clear into inventory; ascension spend flow; material/inventory UI.

The monster's **fight kit** (Concept A "Topple" / Concept B "Fury", see below) is independent of all four — same fight core whether story or farmed.

---

## New engine mechanics still needed

- **HP-threshold phase transitions** with per-phase skill pools (7DSGC-demon backbone) — for the multi-phase boss.
- One signature combat mechanic per kit concept:
  - **Concept A — Stagger → Topple**: provoke hits build a Stagger meter; full = Toppled turn (skips actions, takes bonus damage, "lurches toward island").
  - **Concept B — Wind-Up (telegraph + interrupt)**: boss charges a named attack over a turn; meeting a counter-condition fizzles it and Overextends the boss (self-stun + DEF down).
- Signature passives: A = **Corrosive Depths** (uncleansable team DoT each turn + boss self-heal in water); B = **Acid Carapace** (damage reflect as decay + enrage stacks, stripped on Overextend).
- The story loop (provoke → big swing → counter → progress) maps best to **B's Wind-Up + A's Topple fused**.

---

## Open design items (Tanveer)

- Confirm cap/bands (Lv60 / 6× 10?).
- Per-character ascension costs (Eye counts scaling per band + other items).
- Common level-mat: name + drop quantity per clear.
- World-boss **difficulty tiers** (scale HP/rewards so it stays a threat as rosters level).
- Whether ascension grants bonuses beyond unlocking the next cap (Genshin gives ascension stat bumps + talent unlocks).
- The monster's premium multi-phase kit (up to 12 skills).

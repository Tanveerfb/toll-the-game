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
| Stat growth | **Flat** per level, **per-character constant**. Leveling alone ~**2x base at Lv60**; **ascension stat bumps** add up to another ~1x → **~3x base total** at fully-ascended Lv60 |
| Stat formula | leveling gain = `base_stat / (cap - 1)` per ATK/DEF/HP (auto role-weighted, no hand-authored numbers), PLUS a discrete flat bump at each ascension unlock (6 bumps summing to ~+1x base) |
| Cap / bands | **Lv60, 6 ascension bands of 10** eventual. **This update caps reachable level at Lv40** (4 bands) — 50/60 come later |
| Ascension gate | Crossing a band consumes `[boss signature drop] + [local specialty] + [currency]` (Genshin model), **per-character requirements** (e.g. Duke = 6x Sea Monster's Eye + local specialty + coin) |
| Ultimate Level | Separate axis fed by **gacha dupes**, 1/6 -> 6/6. **Stat/multiplier bump only for now** (no Lv4/6 special effects yet; future chars may add them). Resolves STATUS open issue #6. See GACHA_DESIGN.md |

## Ascension costs (LOCKED — first 3 bands)

Signature boss material = **Sea Monster's Eye**. Local specialty = per-character theme-linked item. Currency = in-world money coin.

| Band unlock | Boss material | Local specialty | Currency |
|---|---|---|---|
| Band 1 (→Lv20) | 3 | 10 | 10,000 |
| Band 2 (→Lv30) | 6 | 15 | 25,000 |
| Band 3 (→Lv40) | 10 | 25 | 50,000 |
| Bands 4-6 (→Lv50/60) | TODO (later update) | TODO | TODO |

Each band unlock also grants a **flat stat bump** (the ascension contribution toward ~3x total). Per-band bump distribution = tuning TODO.

## World-boss rewards (LOCKED)

Single fight, single multiplier for now (difficulty tiers = future / player-rank unlock). Per clear:
- **1× Sea Monster's Eye guaranteed** + **10% chance of +1**.
- **Up to 5× local-specialty materials** (random).
- **Currency: random 2,000–10,000**.
- Entry: **40 stamina**.

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
- `lib/game/stats.ts` gains a pre-step: `leveledBase = base + perLevelGain*(level-1) + ascensionBump(ascension)`, applied before buffs/debuffs (which stay multiplicative on top).
- `perLevelGain[stat] = round(base[stat] / 59)` (leveling portion → ~2x at Lv60).
- `ascensionBump` = discrete flat per stat added at each ascension unlock, summing to ~+1x base across 6 unlocks → **~3x base at fully-ascended Lv60**. Per-band distribution = tuning TODO.
- Ascension caps the level: `maxLevel = ascension * 10`. Leveling past a band is blocked until the band's cost is paid. **This update: reachable cap = Lv40 (ascension 4 / band 3).**

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

- **Per-level leveling fuel** — within a band, Lv→Lv cost: currency only, or currency + a common mat? (ascension band gates are specced above.)
- **Ascension stat-bump distribution** — the flat per-stat bump at each of the 6 unlocks (sum ≈ +1x base).
- **Ult per-level multiplier step** (stat-only for now).
- **Bands 4-6 ascension costs** (later update; Lv40 is the current ceiling).
- **Local specialty items** per remaining character (theme/backstory-linked).
- **[TODO] The monster's premium multi-phase kit** (up to 12 skills) — Tanveer to bring. Concept A "Topple" / B "Wind-Up" above are the reference starting points.

## Resolved (2026-07-18)
Cap Lv60 eventual / **Lv40 reachable now**; ascension = boss drop + local specialty + currency (bands 1-3 costed above); ascension grants flat stat bumps (→~3x total); world boss = single fight/multiplier now (tiers = future); rewards = 1 Eye (+10% for +1) + up to 5 specialty mats + 2k-10k currency per clear; ult level = stat bump only for now.

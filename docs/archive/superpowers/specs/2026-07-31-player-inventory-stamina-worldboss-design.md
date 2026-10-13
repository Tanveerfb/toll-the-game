# Player Profile, Inventory, Stamina & World-Boss Foundation — Design

> Status: DESIGN, pending implementation plan.
> Builds the meta-progression layer speced (but not built) in
> `docs/design/WORLD_BOSS_AND_ASCENSION_PLAN.md`, now that Molvarr's fight kit is
> confirmed complete (`data/characters/molvarr.json`, built 2026-07-19, 235 tests).
> Closes roadmap step 3 ("World Boss + Ascension update"). Patch notes (roadmap
> step 5) is a separate, independent spec — not covered here.

## Context

`store/playerStore.ts` today is a stub: `uid`, `roster`, `inventory` (just
`{gems: 1000}`), `pity`. No level, no stamina, no materials, no way to spend
anything. Molvarr's fight engine is done but has no menu entry point, no
stamina gate, and no reward flow — the only way to fight him today is
`/practice`'s dev-facing "Boss Battle" sandbox toggle, which uses the full
character catalog (not roster-gated) and grants nothing.

This spec builds the real loop: enter World Boss (costs stamina) → fight
Molvarr (existing engine, unchanged) → get rewards (Eye, Corroded Sea Weed,
Training Manuals, coin) → spend them to level and ascend characters.

Confirmed via repo-wide grep + git log (2026-07-31): zero code exists for any
of stamina, ascension, xp, training manuals, or a world-boss route — this is
fully greenfield, nothing to reconcile with prior partial work.

## Locked decisions (this session)

| Decision | Value |
|---|---|
| Player scope | Full level + ascension model, not just account profile (deliberately built ahead of real earning content, per Tanveer) |
| Test/grant tooling | Dev-only grant panel (`NODE_ENV !== "production"`), mirrors the existing debug-button convention |
| Currencies | Two separate fields: `gems` (premium/gacha) and `coin` (in-world/leveling/ascension) |
| UI surface | New dedicated `/profile` page (rebuilds the current email+logout stub) |
| Spend flows | Real interactive level-up and ascend actions, not display-only |
| Per-level cost | Coin **+** XP-from-manuals (not currency-only) |
| Leveling model | XP-based: Training Manuals feed XP; `xpToNext(L) = 100 * L`; coin cost per feed = `xpAmount * 2` |
| Local specialty (ascension band material) | Real named item now: **Corroded Sea Weed**, not a placeholder token |
| Molvarr reward roll | Eye: `1 + (10% ? 1 : 0)`. Corroded Sea Weed: `2 + (10% ? 1 : 0)`. Training Manual (tier 1 only): `random(3,6)`. Coin: `random(2000,10000)` |
| Training Manual tiers | 3 tiers — Training Manual / Advanced / Premium — grant 100 / 400 / 1000 XP respectively. Only tier 1 is currently obtainable (Molvarr drop); tiers 2-3 exist in the data model, granted via dev panel until a real source is built |
| World-boss encounter scope | Full loop this session (menu entry, roster-gated team pick, stamina gate, fight, reward screen) — nothing blocks it now that Molvarr's kit is done |

## Data model

### `store/playerStore.ts` (extended, version bump 1→2)

```ts
export interface PlayerState {
  uid: string | null;
  roster: string[];
  currencies: { gems: number; coin: number };
  inventory: Record<string, number>; // materials only: see ids below
  characters: Record<string, { level: number; ascension: number; xp: number }>;
  stamina: { current: number; updatedAt: number }; // epoch ms
  pity: { standard: number; limited: number };
  hasHydrated: boolean;
  setPlayerState: (state: Partial<PlayerState>) => void;
  addCharacterToRoster: (characterId: string) => void;
  resetPlayerState: () => void;
  // new actions — see "Actions" below
}
```

**Material ids:** `sea_monster_eye`, `corroded_seaweed`, `training_manual`,
`training_manual_advanced`, `training_manual_premium`.

**Migration (v1 → v2):** `inventory.gems` (old shape) moves to
`currencies.gems`; `currencies.coin` defaults to `0`; `characters`, `stamina`
default to `{}` / `{current: 120, updatedAt: Date.now()}` for existing saves.
`inventory` after migration retains only material keys (gems removed from it).

**Reading an untouched character** (`characters[id]` absent) returns
`{level: 1, ascension: 0, xp: 0}` via a selector helper, not by pre-seeding
every roster id — avoids a migration write explosion as the roster grows.

### `characters` progression

- `level`: current level, starts at 1.
- `ascension`: 0-4 this update (bands 1-3 costed; 0 = unascended).
- `xp`: progress toward `xpToNext(level)`, resets to overflow amount on level-up.
- `maxLevel` is looked up from the ascension table, not a closed-form formula
  (bands 1-3 are the only ones costed so far; a formula would silently invent
  numbers for bands 4-6 that don't exist yet):
  ```ts
  const ASCENSION_MAX_LEVEL: Record<number, number> = { 0: 1, 1: 20, 2: 30, 3: 40 };
  export function maxLevelForAscension(ascension: number): number {
    return ASCENSION_MAX_LEVEL[ascension] ?? 40; // bands 4-6 TODO, clamp at current ceiling
  }
  ```
  At `ascension: 0`, `maxLevel = 1` — a character starts at level 1 with
  nothing to feed (feeding is refused, `level >= maxLevel`), matching
  "ascension gates leveling": **must ascend once (Band 1) before any leveling
  past 1 is possible.**

### Firestore `users/{uid}` (extends existing shape, `AuthProvider.tsx` pattern)

Same field list as `playerStore`, widened directly into the existing
cloud-sync code path (see "Cloud sync" below) — no new merge mechanism.

## Systems

### 1. Stamina — `lib/game/stamina.ts`

```ts
export const STAMINA_CAP = 120;
export const STAMINA_REGEN_MS = 5 * 60 * 1000; // +1 per 5 min

export function getCurrentStamina(stored: { current: number; updatedAt: number }, now = Date.now()): number {
  const regenerated = Math.floor((now - stored.updatedAt) / STAMINA_REGEN_MS);
  return Math.min(STAMINA_CAP, stored.current + regenerated);
}

export function spendStamina(stored: { current: number; updatedAt: number }, amount: number, now = Date.now()):
  | { ok: true; next: { current: number; updatedAt: number } }
  | { ok: false } {
  const current = getCurrentStamina(stored, now);
  if (current < amount) return { ok: false };
  return { ok: true, next: { current: current - amount, updatedAt: now } };
}
```

Computed on every read, never a timer/interval — works offline, no cron.
`playerStore` gets a `spendStaminaAction(amount): boolean` wrapper that calls
`spendStamina` against current state and commits `next` if `ok`, returning
whether the spend succeeded (callers branch on this instead of re-deriving).

### 2. Leveling — `lib/game/leveling.ts`

```ts
export const XP_PER_MANUAL_TIER = { training_manual: 100, training_manual_advanced: 400, training_manual_premium: 1000 } as const;
export const COIN_PER_XP = 2;

export function xpToNext(level: number): number {
  return 100 * level;
}

/** Feeds one manual's XP into a character, chaining level-ups on overflow,
 *  capped at maxLevel. Returns the new {level, xp} and coin cost, or null if
 *  already at maxLevel (feed refused). */
export function feedManual(
  progress: { level: number; xp: number },
  maxLevel: number,
  manualTier: keyof typeof XP_PER_MANUAL_TIER,
): { level: number; xp: number; coinCost: number } | null {
  if (progress.level >= maxLevel) return null;
  const xpGained = XP_PER_MANUAL_TIER[manualTier];
  let { level, xp } = progress;
  xp += xpGained;
  while (level < maxLevel && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level >= maxLevel) xp = 0; // no banking XP past the reachable cap
  return { level, xp, coinCost: xpGained * COIN_PER_XP };
}
```

Stat application (`lib/game/stats.ts`) already has a pre-step planned in the
design doc (`leveledBase = base + perLevelGain*(level-1) + ascensionBump(ascension)`)
— this spec adds the `level`/`ascension` fields that feed it; wiring the
actual stat formula into `stats.ts` is one of this plan's tasks (not yet done
anywhere).

### 3. Ascension — reuses the locked cost table verbatim

| Band unlock | Sea Monster's Eye | Corroded Sea Weed | Coin | `maxLevel` after |
|---|---|---|---|---|
| Band 1 (ascension 0→1) | 3 | 10 | 10,000 | 20 |
| Band 2 (ascension 1→2) | 6 | 15 | 25,000 | 30 |
| Band 3 (ascension 2→3) | 10 | 25 | 50,000 | 40 |

Bands 4-6 stay TODO (later update, per the design doc — this update's ceiling
is ascension 3 / Lv40). Ascend action checks current ascension+1 against this
table, deducts materials+coin atomically, no partial-spend on insufficient
funds (button disabled client-side, guarded server/store-side too).

### 4. World-boss encounter — `app/world-boss/page.tsx`

Story-page-style view state machine: `select → battle → results`.

- **select**: Molvarr card (art, name, `ELITE`, phase count — same info
  already rendered by `TeamSelect`'s boss card, extracted or duplicated as a
  small presentational piece), a live stamina readout (`current/120`, regen
  countdown to next tick), and a new `WorldBossTeamSelect` component — visually
  the same slot-picker as `TeamSelect`'s player side, but its roster source is
  `usePlayerStore().roster` (owned characters only) instead of
  `getPlayableCharacters()` (full catalog). "ENTER" disabled when
  `stamina < 40` or team is empty.
- **battle**: `BattleArena` + `Deck`, given a `worldBoss` handler prop.
  `BattleArena`'s existing `StoryBattleHandlers` interface (currently
  story-only) is renamed `BattleEndHandlers` (one-line rename + JSDoc update,
  shared by both `story` and the new `worldBoss` prop) — the victory/defeat
  button block's `story &&` checks become `(story ?? worldBoss) &&`, calling
  whichever is present.
- **results**: reward reveal card showing what `rollWorldBossRewards()`
  granted, "Continue" returns to `select`.

Flow: Enter → `spendStaminaAction(40)` (blocks if it returns false) →
`startCustomBattle(playerPicks, [{id: "molvarr"}])` → `select` becomes
`battle`. Victory → roll rewards, grant into `playerStore`, `battle` becomes
`results`. Defeat → `onRetry` re-spends 40 stamina (blocked the same way,
shows an inline "not enough stamina" message instead of silently no-oping if
insufficient) and relaunches; `onQuit` resets to `select`, no grant, stamina
already spent stays spent.

### 5. Reward roll — `lib/game/worldBossRewards.ts`

```ts
export function rollWorldBossRewards(rng: () => number = Math.random): {
  sea_monster_eye: number;
  corroded_seaweed: number;
  training_manual: number;
  coin: number;
} {
  return {
    sea_monster_eye: 1 + (rng() < 0.1 ? 1 : 0),
    corroded_seaweed: 2 + (rng() < 0.1 ? 1 : 0),
    training_manual: 3 + Math.floor(rng() * 4), // 3-6 inclusive
    coin: 2000 + Math.floor(rng() * 8001), // 2000-10000 inclusive
  };
}
```

`rng` is injectable so tests can assert both the base and +1-bonus branches
deterministically (e.g. `() => 0` forces every bonus roll, `() => 0.99` forces
none).

### 6. Dev-only grant panel

New component (exact location TBD in the plan — likely a section within the
new `/profile` page, gated `process.env.NODE_ENV !== "production"`, matching
the existing "SAVE BATTLE LOG" button convention in `BattleArena.tsx`). Lets
you: set gems/coin directly, set any material quantity directly, set a
character's level/ascension/xp directly, add/remove roster characters, and a
"simulate a run (-40 stamina)" button so the regen/spend-guard math is
exercised without waiting on real fights.

## UI

**`app/profile/page.tsx` rebuild** (currently just email + logout):
- Stamina bar (live value via `getCurrentStamina`, ticking countdown to next
  point).
- Currencies (gems, coin).
- Materials grid (all 5 material ids, 0 renders as owned-but-empty not
  hidden).
- Roster list: each owned character's level/ascension, linking out to that
  character's detail page for the actual spend actions.
- Dev panel section (dev-only).
- Existing auth identity/logout block stays, moved below the above.

**Character detail page** (`app/archive/[id]/page.tsx` / `KitDetails.tsx`):
adds a level/ascension section with the feed-manual and ascend actions —
buttons disabled + tooltip-explained when unaffordable or already maxed.

**`components/ui/TopNav.tsx`**: add `{ href: "/world-boss", label: "World Boss" }`
to `LINKS`.

## Cloud sync

No new merge mechanism. `hooks/AuthProvider.tsx`'s existing pattern — cloud
wins wholesale if a `users/{uid}` doc exists, else seed cloud from local —
gets its field lists (`onAuthStateChanged` handler, `saveToCloud`) widened to
include `currencies`, `characters`, `stamina` alongside the existing
`roster`/`inventory`/`pity`. This intentionally does **not** match
`storyStore.ts`'s union-merge (`{...cloud, ...local}`) — that pattern suits
booleans/sets (idempotent), not numeric balances or level progress, and
`playerStore` never adopted it in the first place.

## Testing

- `lib/game/stamina.ts`: regen math (partial ticks don't round up), cap
  clamping, spend guard (exact-amount edge, insufficient-amount rejection),
  offline-regen-then-spend composition.
- `lib/game/leveling.ts`: `xpToNext` curve values, `feedManual` overflow
  chaining across multiple level-ups from one feed, `maxLevel` cap refusing
  further feeds and not banking excess XP, coin-cost calculation per tier.
- Ascension cost table: gating by current ascension, atomic deduct, refusal
  on insufficient materials/coin.
- `lib/game/worldBossRewards.ts`: base/bonus branches for Eye and Corroded Sea
  Weed via injected deterministic `rng`, training-manual and coin ranges
  respect their bounds across many samples.
- `playerStore` migration: v1 `{inventory: {gems: N}}` → v2
  `{currencies: {gems: N, coin: 0}, inventory: {}, characters: {}, stamina: {current: 120, ...}}`.
- World-boss route: stamina gate blocks entry under 40, `WorldBossTeamSelect`
  only lists roster-owned characters, reward grant lands in `playerStore`
  after a scripted victory.

## Out of scope / deferred (explicit, not forgotten)

- Ascension bands 4-6 (Lv50/60) — later update, doc's own TODO.
- Ult-level per-pull stat step — separate system, `GACHA_DESIGN.md`'s concern.
- Training Manual tiers 2-3 real drop sources — only reachable via dev panel
  until a second world-boss/dungeon exists to drop them.
- Difficulty tiers for the world-boss fight (Normal/Hard/Extreme/Hell from the
  7DSGC reference) — single fight/multiplier only, per the doc's own lock.
- Patch notes system — fully separate spec, not started here.
- Ascension stat-bump distribution (the actual per-stat numbers at each of the
  3 bands) and `stats.ts` wiring of the leveled-base formula — flagged as an
  implementation-plan task, numbers still need Tanveer's tuning pass; this
  spec defines the *shape* (level/ascension/xp fields, gating), not the final
  combat-facing stat curve.
